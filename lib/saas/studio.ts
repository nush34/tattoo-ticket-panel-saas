import { createClient } from "../supabase/client";

export type StudioRole = "owner" | "admin" | "designer" | "artist";
export type AccountType = "studio" | "individual";

export type CurrentStudio = {
  studio_id: string;
  studio_name: string;
  studio_slug: string;
  studio_status: "trial" | "active" | "suspended" | "cancelled";
  account_type: AccountType;
  member_id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  role: StudioRole;
  is_active: boolean;
  user_limit?: number | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  plan_name?: string | null;
  payment_status?: string | null;
};

export type StudioStaffMember = {
  member_id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  role: StudioRole;
  is_active: boolean;
  created_at?: string | null;
};

function firstRow<T>(data: T[] | T | null): T | null {
  if (!data) return null;
  if (Array.isArray(data)) return data[0] || null;
  return data;
}

export async function getCurrentStudio() {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_my_current_studio", {});

  if (error) {
    console.error("get_my_current_studio error:", error.message);
    return null;
  }

  return firstRow<CurrentStudio>(data as CurrentStudio[] | CurrentStudio | null);
}

export async function getMyStudios() {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_my_studios", {});

  if (error) {
    console.error("get_my_studios error:", error.message);
    return [];
  }

  return (data || []) as CurrentStudio[];
}

export async function getStudioStaff(studioId: string) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_studio_staff", {
    target_studio_id: studioId,
  });

  if (error) {
    console.error("get_studio_staff error:", error.message);
    return [];
  }

  return (data || []) as StudioStaffMember[];
}

export function getPanelPathByRole(role: StudioRole) {
  if (role === "owner" || role === "admin") {
    return "/admin-panel";
  }

  if (role === "designer") {
    return "/tasarimci-panel";
  }

  if (role === "artist") {
    return "/dovmeci-panel";
  }

  return "/login";
}

export function getPanelPathByStudio(studio: CurrentStudio) {
  if (studio.account_type === "individual") {
    return "/solo-panel";
  }

  return getPanelPathByRole(studio.role);
}
