import { createClient } from "../supabase/client";

export type CreateStudioMemberInput = {
  studioId: string;
  fullName: string;
  email: string;
  password: string;
  role: "admin" | "designer" | "artist";
};

export async function createStudioMember(
  input: CreateStudioMemberInput
): Promise<{ error: string | null }> {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Oturum bulunamadı." };
  }

  const response = await fetch("/api/saas/create-member", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      error: result.error || "Kullanıcı oluşturulamadı.",
    };
  }

  return { error: null };
}
export type UpdateStudioMemberInput = {
  studioId: string;
  memberId: string;
  action: "update_info" | "update_password" | "set_active" | "delete_member";
  fullName?: string;
  email?: string;
  role?: "admin" | "designer" | "artist";
  password?: string;
  isActive?: boolean;
};

export async function updateStudioMember(
  input: UpdateStudioMemberInput
): Promise<{ error: string | null }> {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Oturum bulunamadı." };
  }

  const response = await fetch("/api/saas/update-member", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      error: result.error || "Kullanıcı işlemi tamamlanamadı.",
    };
  }

  return { error: null };
}