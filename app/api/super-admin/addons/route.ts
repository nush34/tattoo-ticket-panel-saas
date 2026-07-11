import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type BillingType = "monthly" | "yearly" | "one_time";
type LicenseStatus =
  | "inactive"
  | "trial"
  | "active"
  | "expired"
  | "cancelled";

type AuthenticatedSuperAdmin = {
  admin: SupabaseClient;
  userId: string;
};

const BILLING_TYPES: BillingType[] = ["monthly", "yearly", "one_time"];
const LICENSE_STATUSES: LicenseStatus[] = [
  "inactive",
  "trial",
  "active",
  "expired",
  "cancelled",
];

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}

async function requireSuperAdmin(
  request: NextRequest
): Promise<AuthenticatedSuperAdmin | NextResponse> {
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json(
      { error: "Yetkilendirme anahtarı bulunamadı." },
      { status: 401 }
    );
  }

  const admin = getAdminClient();
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json(
      { error: "Oturum doğrulanamadı." },
      { status: 401 }
    );
  }

  const { data: superAdmin, error: superAdminError } = await admin
    .from("super_admins")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (superAdminError) {
    return NextResponse.json(
      { error: superAdminError.message },
      { status: 500 }
    );
  }

  if (!superAdmin) {
    return NextResponse.json(
      { error: "Bu işlem yalnızca Super Admin tarafından yapılabilir." },
      { status: 403 }
    );
  }

  return { admin, userId: user.id };
}

function isNextResponse(
  value: AuthenticatedSuperAdmin | NextResponse
): value is NextResponse {
  return value instanceof NextResponse;
}

function nullablePrice(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Fiyat sıfırdan küçük olamaz.");
  }

  return parsed;
}

function nullableText(value: unknown) {
  if (typeof value !== "string") return null;

  const cleanValue = value.trim();
  return cleanValue || null;
}

function dateToStartIso(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Başlangıç tarihi geçersiz.");
  }

  return date.toISOString();
}

function dateToEndIso(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  const date = new Date(`${value.slice(0, 10)}T23:59:59.999Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Bitiş tarihi geçersiz.");
  }

  return date.toISOString();
}

async function getAddonManagementData(admin: SupabaseClient) {
  const nowIso = new Date().toISOString();

  const { error: expirationError } = await admin
    .from("studio_addons")
    .update({ status: "expired", updated_at: nowIso })
    .in("status", ["trial", "active"])
    .lte("ends_at", nowIso);

  if (expirationError) {
    throw new Error(expirationError.message);
  }

  const [addonsResult, licensesResult] = await Promise.all([
    admin
      .from("addons")
      .select(
        "id, code, name, description, billing_type, monthly_price, yearly_price, one_time_price, is_active, available_for_studio, available_for_individual, sort_order, created_at, updated_at"
      )
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    admin
      .from("studio_addons")
      .select(
        "id, studio_id, addon_id, status, starts_at, ends_at, billing_type, agreed_price, auto_renew, notes, created_at, updated_at"
      )
      .order("created_at", { ascending: true }),
  ]);

  if (addonsResult.error) {
    throw new Error(addonsResult.error.message);
  }

  if (licensesResult.error) {
    throw new Error(licensesResult.error.message);
  }

  return {
    addons: addonsResult.data || [],
    studioAddons: licensesResult.data || [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin(request);

    if (isNextResponse(authResult)) {
      return authResult;
    }

    const result = await getAddonManagementData(authResult.admin);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Eklenti bilgileri alınamadı.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin(request);

    if (isNextResponse(authResult)) {
      return authResult;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "");
    const { admin, userId } = authResult;

    if (action === "create_catalog_addon") {
      const code = String(body.code || "").trim().toLowerCase();
      const name = String(body.name || "").trim();
      const billingType = String(body.billingType || "monthly") as BillingType;

      if (!code || !/^[a-z0-9_]+$/.test(code)) {
        return NextResponse.json(
          {
            error:
              "Eklenti kodu yalnızca küçük harf, rakam ve alt çizgi içerebilir.",
          },
          { status: 400 }
        );
      }

      if (!name) {
        return NextResponse.json(
          { error: "Eklenti adı zorunludur." },
          { status: 400 }
        );
      }

      if (!BILLING_TYPES.includes(billingType)) {
        return NextResponse.json(
          { error: "Faturalandırma türü geçersiz." },
          { status: 400 }
        );
      }

      const { error } = await admin.from("addons").insert({
        code,
        name,
        description: nullableText(body.description),
        billing_type: billingType,
        monthly_price: nullablePrice(body.monthlyPrice),
        yearly_price: nullablePrice(body.yearlyPrice),
        one_time_price: nullablePrice(body.oneTimePrice),
        is_active: body.isActive !== false,
        available_for_studio: body.availableForStudio !== false,
        available_for_individual: body.availableForIndividual === true,
        sort_order: Math.max(0, Number(body.sortOrder || 0)),
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    } else if (action === "update_catalog_addon") {
      const addonId = String(body.addonId || "");
      const name = String(body.name || "").trim();
      const billingType = String(body.billingType || "monthly") as BillingType;

      if (!addonId || !name) {
        return NextResponse.json(
          { error: "Eklenti kimliği ve adı zorunludur." },
          { status: 400 }
        );
      }

      if (!BILLING_TYPES.includes(billingType)) {
        return NextResponse.json(
          { error: "Faturalandırma türü geçersiz." },
          { status: 400 }
        );
      }

      const { error } = await admin
        .from("addons")
        .update({
          name,
          description: nullableText(body.description),
          billing_type: billingType,
          monthly_price: nullablePrice(body.monthlyPrice),
          yearly_price: nullablePrice(body.yearlyPrice),
          one_time_price: nullablePrice(body.oneTimePrice),
          is_active: body.isActive === true,
          available_for_studio: body.availableForStudio === true,
          available_for_individual: body.availableForIndividual === true,
          sort_order: Math.max(0, Number(body.sortOrder || 0)),
          updated_at: new Date().toISOString(),
        })
        .eq("id", addonId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    } else if (action === "upsert_studio_addon") {
      const studioId = String(body.studioId || "");
      const addonId = String(body.addonId || "");
      const status = String(body.status || "inactive") as LicenseStatus;
      const billingType = String(body.billingType || "monthly") as BillingType;

      if (!studioId || !addonId) {
        return NextResponse.json(
          { error: "Stüdyo ve eklenti seçimi zorunludur." },
          { status: 400 }
        );
      }

      if (!LICENSE_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: "Eklenti lisans durumu geçersiz." },
          { status: 400 }
        );
      }

      if (!BILLING_TYPES.includes(billingType)) {
        return NextResponse.json(
          { error: "Faturalandırma türü geçersiz." },
          { status: 400 }
        );
      }

      const [studioResult, addonResult] = await Promise.all([
        admin
          .from("studios")
          .select("id, account_type")
          .eq("id", studioId)
          .maybeSingle(),
        admin
          .from("addons")
          .select(
            "id, available_for_studio, available_for_individual, is_active"
          )
          .eq("id", addonId)
          .maybeSingle(),
      ]);

      if (studioResult.error || !studioResult.data) {
        return NextResponse.json(
          { error: studioResult.error?.message || "Hesap bulunamadı." },
          { status: 404 }
        );
      }

      if (addonResult.error || !addonResult.data) {
        return NextResponse.json(
          { error: addonResult.error?.message || "Eklenti bulunamadı." },
          { status: 404 }
        );
      }

      const accountType = String(studioResult.data.account_type || "studio");
      const addon = addonResult.data;

      if (
        (accountType === "studio" && !addon.available_for_studio) ||
        (accountType === "individual" && !addon.available_for_individual)
      ) {
        return NextResponse.json(
          { error: "Bu eklenti seçilen hesap türünde kullanılamaz." },
          { status: 400 }
        );
      }

      const startsAt = dateToStartIso(body.startsAt);
      let endsAt = dateToEndIso(body.endsAt);

      if (
        startsAt &&
        endsAt &&
        new Date(endsAt).getTime() <= new Date(startsAt).getTime()
      ) {
        return NextResponse.json(
          { error: "Eklenti bitiş tarihi başlangıçtan sonra olmalıdır." },
          { status: 400 }
        );
      }

      if ((status === "expired" || status === "cancelled") && !endsAt) {
        endsAt = new Date().toISOString();
      }

      const { error } = await admin.from("studio_addons").upsert(
        {
          studio_id: studioId,
          addon_id: addonId,
          status,
          starts_at:
            startsAt ||
            (status === "active" || status === "trial"
              ? new Date().toISOString()
              : null),
          ends_at: endsAt,
          billing_type: billingType,
          agreed_price: nullablePrice(body.agreedPrice),
          auto_renew: body.autoRenew === true,
          granted_by: userId,
          notes: nullableText(body.notes),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "studio_id,addon_id" }
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    } else if (action === "cancel_studio_addon") {
      const studioId = String(body.studioId || "");
      const addonId = String(body.addonId || "");

      if (!studioId || !addonId) {
        return NextResponse.json(
          { error: "Stüdyo ve eklenti seçimi zorunludur." },
          { status: 400 }
        );
      }

      const { error } = await admin
        .from("studio_addons")
        .update({
          status: "cancelled",
          auto_renew: false,
          ends_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("studio_id", studioId)
        .eq("addon_id", addonId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    } else {
      return NextResponse.json(
        { error: "Geçersiz eklenti işlemi." },
        { status: 400 }
      );
    }

    const result = await getAddonManagementData(admin);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Eklenti işlemi tamamlanamadı.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
