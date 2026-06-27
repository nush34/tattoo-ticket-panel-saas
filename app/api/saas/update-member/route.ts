import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/adminClient";

type SaasRole = "admin" | "designer" | "artist";

type UpdateMemberBody = {
  studioId: string;
  memberId: string;
  action: "update_info" | "update_password" | "set_active" | "delete_member";
  fullName?: string;
  email?: string;
  role?: SaasRole;
  password?: string;
  isActive?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdateMemberBody;

    const studioId = body.studioId?.trim();
    const memberId = body.memberId?.trim();
    const action = body.action;

    if (!studioId || !memberId || !action) {
      return NextResponse.json(
        { error: "Eksik bilgi var." },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "Oturum bilgisi yok." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user: requester },
      error: requesterError,
    } = await adminSupabase.auth.getUser(token);

    if (requesterError || !requester) {
      return NextResponse.json(
        {
          error: `Oturum doğrulanamadı: ${
            requesterError?.message || "Kullanıcı bulunamadı"
          }`,
        },
        { status: 401 }
      );
    }

    const { data: requesterMember, error: requesterMemberError } =
      await adminSupabase
        .from("studio_members")
        .select("id, role")
        .eq("studio_id", studioId)
        .eq("user_id", requester.id)
        .eq("is_active", true)
        .single();

    if (requesterMemberError || !requesterMember) {
      return NextResponse.json(
        { error: "Bu stüdyoda yetkin yok." },
        { status: 403 }
      );
    }

    if (!["owner", "admin"].includes(requesterMember.role)) {
      return NextResponse.json(
        { error: "Bu işlem için owner veya admin olmalısın." },
        { status: 403 }
      );
    }

    const { data: targetMember, error: targetMemberError } =
      await adminSupabase
        .from("studio_members")
        .select("id, user_id, role, full_name, email, is_active")
        .eq("id", memberId)
        .eq("studio_id", studioId)
        .single();

    if (targetMemberError || !targetMember) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı." },
        { status: 404 }
      );
    }

    const targetIsOwner = targetMember.role === "owner";
    const targetIsRequester = targetMember.user_id === requester.id;

    if (targetIsOwner && action !== "update_info" && action !== "update_password") {
      return NextResponse.json(
        { error: "Owner kullanıcı pasifleştirilemez veya silinemez." },
        { status: 400 }
      );
    }

    if (action === "update_info") {
      const fullName = body.fullName?.trim();
      const email = body.email?.trim().toLowerCase();
      const role = body.role;

      if (!fullName || !email || !role) {
        return NextResponse.json(
          { error: "Ad soyad, e-posta ve rol zorunlu." },
          { status: 400 }
        );
      }

      if (!["admin", "designer", "artist"].includes(role)) {
        return NextResponse.json(
          { error: "Geçersiz rol." },
          { status: 400 }
        );
      }

      if (targetIsOwner && role !== "admin") {
        return NextResponse.json(
          { error: "Owner rolü bu ekrandan değiştirilemez." },
          { status: 400 }
        );
      }

      if (targetIsRequester && role !== requesterMember.role) {
        return NextResponse.json(
          { error: "Kendi rolünü değiştiremezsin." },
          { status: 400 }
        );
      }

      const { error: authUpdateError } =
        await adminSupabase.auth.admin.updateUserById(targetMember.user_id, {
          email,
        });

      if (authUpdateError) {
        return NextResponse.json(
          { error: authUpdateError.message || "Auth e-postası güncellenemedi." },
          { status: 400 }
        );
      }

      const { error: memberUpdateError } = await adminSupabase
        .from("studio_members")
        .update({
          full_name: fullName,
          email,
          role,
        })
        .eq("id", memberId)
        .eq("studio_id", studioId);

      if (memberUpdateError) {
        return NextResponse.json(
          { error: memberUpdateError.message || "Kullanıcı güncellenemedi." },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === "update_password") {
      const password = body.password || "";

      if (password.length < 6) {
        return NextResponse.json(
          { error: "Şifre en az 6 karakter olmalı." },
          { status: 400 }
        );
      }

      const { error: passwordError } =
        await adminSupabase.auth.admin.updateUserById(targetMember.user_id, {
          password,
        });

      if (passwordError) {
        return NextResponse.json(
          { error: passwordError.message || "Şifre güncellenemedi." },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === "set_active") {
      if (targetIsRequester) {
        return NextResponse.json(
          { error: "Kendi hesabını pasifleştiremezsin." },
          { status: 400 }
        );
      }

      const nextActive = Boolean(body.isActive);

      const { error: activeError } = await adminSupabase
        .from("studio_members")
        .update({
          is_active: nextActive,
        })
        .eq("id", memberId)
        .eq("studio_id", studioId);

      if (activeError) {
        return NextResponse.json(
          { error: activeError.message || "Kullanıcı durumu güncellenemedi." },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === "delete_member") {
      if (targetIsRequester) {
        return NextResponse.json(
          { error: "Kendi hesabını silemezsin." },
          { status: 400 }
        );
      }

      const { error: deleteError } = await adminSupabase
        .from("studio_members")
        .update({
          is_active: false,
        })
        .eq("id", memberId)
        .eq("studio_id", studioId);

      if (deleteError) {
        return NextResponse.json(
          { error: deleteError.message || "Kullanıcı silinemedi." },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Geçersiz işlem." },
      { status: 400 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Bilinmeyen hata oluştu.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}