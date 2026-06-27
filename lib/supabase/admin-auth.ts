import { createAdminClient } from "@/lib/supabase/admin";

export async function requireAdmin(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      error: "Oturum bulunamadı.",
    };
  }

  const supabase = createAdminClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      ok: false as const,
      status: 401,
      error: "Geçersiz oturum.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      ok: false as const,
      status: 403,
      error: "Kullanıcı profili bulunamadı.",
    };
  }

  if (!profile.is_active) {
    return {
      ok: false as const,
      status: 403,
      error: "Kullanıcı pasif durumda.",
    };
  }

  if (profile.role !== "admin") {
    return {
      ok: false as const,
      status: 403,
      error: "Bu işlem için admin yetkisi gerekir.",
    };
  }

  return {
    ok: true as const,
    user,
    profile,
  };
}