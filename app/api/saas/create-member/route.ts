import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/adminClient";

type StudioRole = "admin" | "designer" | "artist";

function isValidRole(role: string): role is StudioRole {
  return role === "admin" || role === "designer" || role === "artist";
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Oturum doğrulanamadı." },
        { status: 401 }
      );
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: "Kullanıcı doğrulanamadı." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const studioId = String(body.studioId || body.studio_id || "").trim();
    const fullName = String(body.fullName || body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "").trim();

    if (!studioId) {
      return NextResponse.json(
        { error: "Stüdyo bilgisi eksik." },
        { status: 400 }
      );
    }

    if (!fullName) {
      return NextResponse.json(
        { error: "Ad soyad zorunlu." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "E-posta zorunlu." },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Şifre en az 6 karakter olmalı." },
        { status: 400 }
      );
    }

    if (!isValidRole(role)) {
      return NextResponse.json(
        { error: "Geçersiz kullanıcı rolü." },
        { status: 400 }
      );
    }

    const { data: requesterMember, error: requesterError } =
      await supabaseAdmin
        .from("studio_members")
        .select("id, role, is_active")
        .eq("studio_id", studioId)
        .eq("user_id", userData.user.id)
        .maybeSingle();

    if (requesterError) {
      return NextResponse.json(
        { error: requesterError.message },
        { status: 500 }
      );
    }

    if (
      !requesterMember ||
      requesterMember.is_active !== true ||
      !["owner", "admin"].includes(requesterMember.role)
    ) {
      return NextResponse.json(
        { error: "Bu işlem için admin yetkisi gerekli." },
        { status: 403 }
      );
    }

    const { data: studioData, error: studioError } = await supabaseAdmin
      .from("studios")
      .select("id, status, user_limit, trial_ends_at")
      .eq("id", studioId)
      .maybeSingle();

    if (studioError) {
      return NextResponse.json(
        { error: studioError.message },
        { status: 500 }
      );
    }

    if (!studioData) {
      return NextResponse.json(
        { error: "Stüdyo bulunamadı." },
        { status: 404 }
      );
    }

    if (studioData.status === "suspended" || studioData.status === "cancelled") {
      return NextResponse.json(
        { error: "Bu stüdyo şu anda aktif değil." },
        { status: 403 }
      );
    }

    if (
      studioData.status === "trial" &&
      studioData.trial_ends_at &&
      new Date(studioData.trial_ends_at).getTime() < Date.now()
    ) {
      await supabaseAdmin
        .from("studios")
        .update({ status: "suspended" })
        .eq("id", studioId);

      return NextResponse.json(
        { error: "Deneme süresi dolduğu için stüdyo askıya alındı." },
        { status: 403 }
      );
    }

    const { count: activeUserCount, error: countError } = await supabaseAdmin
      .from("studio_members")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("is_active", true);

    if (countError) {
      return NextResponse.json(
        { error: countError.message },
        { status: 500 }
      );
    }

    const userLimit = Number(studioData.user_limit || 0);

    if (userLimit > 0 && Number(activeUserCount || 0) >= userLimit) {
      return NextResponse.json(
        {
          error: `Bu stüdyonun kullanıcı limiti dolu. Limit: ${userLimit}, aktif kullanıcı: ${activeUserCount}.`,
        },
        { status: 400 }
      );
    }

    const { data: existingMember, error: existingMemberError } =
      await supabaseAdmin
        .from("studio_members")
        .select("id, user_id, is_active")
        .eq("studio_id", studioId)
        .eq("email", email)
        .maybeSingle();

    if (existingMemberError) {
      return NextResponse.json(
        { error: existingMemberError.message },
        { status: 500 }
      );
    }

    if (existingMember?.is_active) {
      return NextResponse.json(
        { error: "Bu e-posta ile aktif bir kullanıcı zaten var." },
        { status: 400 }
      );
    }

    if (existingMember && !existingMember.is_active) {
      const { error: updateAuthError } =
        await supabaseAdmin.auth.admin.updateUserById(existingMember.user_id, {
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            role,
          },
        });

      if (updateAuthError) {
        return NextResponse.json(
          { error: updateAuthError.message },
          { status: 400 }
        );
      }

      const { data: reactivatedMember, error: reactivateError } =
        await supabaseAdmin
          .from("studio_members")
          .update({
            full_name: fullName,
            email,
            role,
            is_active: true,
          })
          .eq("id", existingMember.id)
          .select("id, full_name, email, role, is_active")
          .single();

      if (reactivateError) {
        return NextResponse.json(
          { error: reactivateError.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        reactivated: true,
        member: reactivatedMember,
      });
    }

    const { data: createdUser, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role,
        },
      });

    if (createUserError || !createdUser.user) {
      return NextResponse.json(
        {
          error:
            createUserError?.message ||
            "Kullanıcı oluşturulamadı. Bu e-posta Auth sisteminde zaten kayıtlı olabilir.",
        },
        { status: 400 }
      );
    }

    const { data: createdMember, error: memberError } = await supabaseAdmin
      .from("studio_members")
      .insert({
        studio_id: studioId,
        user_id: createdUser.user.id,
        full_name: fullName,
        email,
        role,
        is_active: true,
      })
      .select("id, full_name, email, role, is_active")
      .single();

    if (memberError) {
      await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);

      return NextResponse.json(
        { error: memberError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      reactivated: false,
      member: createdMember,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Bilinmeyen hata oluştu.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}