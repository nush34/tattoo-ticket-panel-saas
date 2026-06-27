import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/admin-auth";

type UserRole = "admin" | "tasarimci" | "dovmeci";

const allowedRoles: UserRole[] = ["admin", "tasarimci", "dovmeci"];

export async function POST(request: Request) {
  const auth = await requireAdmin(request);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const body = await request.json();

  const fullName = String(body.full_name || body.fullName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const role = String(body.role || "tasarimci") as UserRole;

  if (!fullName) {
    return NextResponse.json(
      { error: "İsim soyisim zorunlu." },
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

  if (!allowedRoles.includes(role)) {
    return NextResponse.json(
      { error: "Geçersiz kullanıcı rolü." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: createdUserData, error: createUserError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
      },
    });

  if (createUserError || !createdUserData.user) {
    return NextResponse.json(
      {
        error:
          createUserError?.message ||
          "Auth kullanıcısı oluşturulamadı.",
      },
      { status: 400 }
    );
  }

  const userId = createdUserData.user.id;

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    email,
    role,
    is_active: true,
  });

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      id: userId,
      full_name: fullName,
      email,
      role,
      is_active: true,
    },
  });
}