import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/admin-auth";

type UserRole = "admin" | "tasarimci" | "dovmeci";

const allowedRoles: UserRole[] = ["admin", "tasarimci", "dovmeci"];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const { id: userId } = await context.params;
  const body = await request.json();

  const supabase = createAdminClient();

  const profileUpdate: Record<string, unknown> = {};
  const authUpdate: Record<string, unknown> = {};
  const metadataUpdate: Record<string, unknown> = {};

  const hasFullName =
    Object.prototype.hasOwnProperty.call(body, "full_name") ||
    Object.prototype.hasOwnProperty.call(body, "fullName");

  if (hasFullName) {
    const fullName = String(body.full_name || body.fullName || "").trim();

    if (!fullName) {
      return NextResponse.json(
        { error: "İsim soyisim boş olamaz." },
        { status: 400 }
      );
    }

    profileUpdate.full_name = fullName;
    metadataUpdate.full_name = fullName;
  }

  if (Object.prototype.hasOwnProperty.call(body, "email")) {
    const email = String(body.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "E-posta boş olamaz." },
        { status: 400 }
      );
    }

    profileUpdate.email = email;
    authUpdate.email = email;
  }

  if (Object.prototype.hasOwnProperty.call(body, "role")) {
    const role = String(body.role || "") as UserRole;

    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Geçersiz kullanıcı rolü." },
        { status: 400 }
      );
    }

    profileUpdate.role = role;
    metadataUpdate.role = role;
  }

  if (Object.prototype.hasOwnProperty.call(body, "is_active")) {
    const isActive = Boolean(body.is_active);

    if (userId === auth.profile.id && !isActive) {
      return NextResponse.json(
        { error: "Kendi hesabını pasif yapamazsın." },
        { status: 400 }
      );
    }

    profileUpdate.is_active = isActive;
  }

  if (Object.prototype.hasOwnProperty.call(body, "password")) {
    const password = String(body.password || "");

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Şifre en az 6 karakter olmalı." },
        { status: 400 }
      );
    }

    authUpdate.password = password;
  }

  if (Object.keys(metadataUpdate).length > 0) {
    authUpdate.user_metadata = metadataUpdate;
  }

  if (Object.keys(authUpdate).length > 0) {
    const { error: authUpdateError } =
      await supabase.auth.admin.updateUserById(userId, authUpdate);

    if (authUpdateError) {
      return NextResponse.json(
        { error: authUpdateError.message },
        { status: 400 }
      );
    }
  }

  if (Object.keys(profileUpdate).length > 0) {
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);

    if (profileUpdateError) {
      return NextResponse.json(
        { error: profileUpdateError.message },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({
    success: true,
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const { id: userId } = await context.params;

  if (userId === auth.profile.id) {
    return NextResponse.json(
      { error: "Kendi hesabını silemezsin." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: relatedTickets, error: relatedTicketsError } = await supabase
    .from("tickets")
    .select("id")
    .or(`tasarimci_id.eq.${userId},dovmeci_id.eq.${userId}`)
    .limit(1);

  if (relatedTicketsError) {
    return NextResponse.json(
      { error: relatedTicketsError.message },
      { status: 400 }
    );
  }

  if (relatedTickets && relatedTickets.length > 0) {
    return NextResponse.json(
      {
        error:
          "Bu kullanıcıya bağlı bilet olduğu için silinemez. Kullanıcıyı pasif yapabilirsin.",
      },
      { status: 409 }
    );
  }

  const { error: profileDeleteError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (profileDeleteError) {
    return NextResponse.json(
      { error: profileDeleteError.message },
      { status: 400 }
    );
  }

  const { error: authDeleteError } =
    await supabase.auth.admin.deleteUser(userId);

  if (authDeleteError) {
    return NextResponse.json(
      { error: authDeleteError.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}