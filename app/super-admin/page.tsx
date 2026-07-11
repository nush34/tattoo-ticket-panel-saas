"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { getCurrentStudio, getPanelPathByRole } from "../../lib/saas/studio";

type StudioStatus = "trial" | "active" | "suspended" | "cancelled";
type AccountType = "studio" | "individual";

type AddonBillingType = "monthly" | "yearly" | "one_time";
type AddonLicenseStatus =
  | "inactive"
  | "trial"
  | "active"
  | "expired"
  | "cancelled";

type Addon = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billing_type: AddonBillingType;
  monthly_price: number | null;
  yearly_price: number | null;
  one_time_price: number | null;
  is_active: boolean;
  available_for_studio: boolean;
  available_for_individual: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type StudioAddonLicense = {
  id: string;
  studio_id: string;
  addon_id: string;
  status: AddonLicenseStatus;
  starts_at: string | null;
  ends_at: string | null;
  billing_type: AddonBillingType;
  agreed_price: number | null;
  auto_renew: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type AddonEditState = {
  name: string;
  description: string;
  billing_type: AddonBillingType;
  monthly_price: string;
  yearly_price: string;
  one_time_price: string;
  is_active: boolean;
  available_for_studio: boolean;
  available_for_individual: boolean;
  sort_order: string;
};

type StudioAddonEditState = {
  status: AddonLicenseStatus;
  starts_at: string;
  ends_at: string;
  billing_type: AddonBillingType;
  agreed_price: string;
  auto_renew: boolean;
  notes: string;
};

type NewAddonState = {
  code: string;
  name: string;
  description: string;
  billing_type: AddonBillingType;
  monthly_price: string;
  yearly_price: string;
  one_time_price: string;
  available_for_studio: boolean;
  available_for_individual: boolean;
  sort_order: string;
};

type AddonApiResponse = {
  addons: Addon[];
  studioAddons: StudioAddonLicense[];
  error?: string;
};

type AddonSummary = {
  activeLicenses: number;
  trialLicenses: number;
  recurringMonthlyEstimate: number;
  oneTimeSales: number;
};

type SuperAdminStudio = {
  studio_id: string;
  studio_name: string;
  studio_slug: string;
  studio_status: StudioStatus;
  account_type: AccountType;
  owner_name: string | null;
  owner_email: string | null;
  user_count: number;
  user_limit: number;
  plan_name: string | null;
  payment_status: string | null;
  monthly_price: number | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  super_admin_note: string | null;
  created_at: string;
};

type StudioEditState = {
  studio_status: StudioStatus;
  plan_name: string;
  payment_status: string;
  monthly_price: string;
  subscription_start_date: string;
  subscription_end_date: string;
  super_admin_note: string;
  user_limit: string;
};

type Summary = {
  totalStudios: number;
  studioAccounts: number;
  individualAccounts: number;
  trialStudios: number;
  activeStudios: number;
  suspendedStudios: number;
  cancelledStudios: number;
  totalUsers: number;
  expectedMonthlyRevenue: number;
  paidMonthlyRevenue: number;
  freeAccounts: number;
  expiringTrials: number;
  expiringSubscriptions: number;
};

function emptySummary(): Summary {
  return {
    totalStudios: 0,
    studioAccounts: 0,
    individualAccounts: 0,
    trialStudios: 0,
    activeStudios: 0,
    suspendedStudios: 0,
    cancelledStudios: 0,
    totalUsers: 0,
    expectedMonthlyRevenue: 0,
    paidMonthlyRevenue: 0,
    freeAccounts: 0,
    expiringTrials: 0,
    expiringSubscriptions: 0,
  };
}

function statusLabel(status: StudioStatus) {
  if (status === "trial") return "Deneme";
  if (status === "active") return "Aktif";
  if (status === "suspended") return "Askıda";
  if (status === "cancelled") return "İptal";
  return status;
}

function accountTypeLabel(type: AccountType) {
  if (type === "individual") return "Bireysel";
  return "Stüdyo";
}

function paymentStatusLabel(status?: string | null) {
  if (!status) return "-";
  if (status === "trial") return "Deneme";
  if (status === "free") return "Ücretsiz";
  if (status === "paid") return "Ödendi";
  if (status === "pending") return "Bekliyor";
  if (status === "overdue") return "Gecikti";
  if (status === "expired") return "Süresi Doldu";
  if (status === "cancelled") return "İptal";
  return status;
}

function statusBadgeClass(status: StudioStatus) {
  if (status === "active") {
    return "rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-200";
  }

  if (status === "trial") {
    return "rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs font-semibold text-yellow-200";
  }

  if (status === "suspended") {
    return "rounded-full bg-orange-500/10 border border-orange-500/30 px-3 py-1 text-xs font-semibold text-orange-200";
  }

  return "rounded-full bg-red-500/10 border border-red-500/30 px-3 py-1 text-xs font-semibold text-red-200";
}

function accountTypeBadgeClass(type: AccountType) {
  if (type === "individual") {
    return "rounded-full bg-purple-500/10 border border-purple-500/30 px-3 py-1 text-xs font-semibold text-purple-200";
  }

  return "rounded-full bg-sky-500/10 border border-sky-500/30 px-3 py-1 text-xs font-semibold text-sky-200";
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(value?: number | null) {
  return `${Number(value || 0).toLocaleString("tr-TR")} TL`;
}

function daysLeft(value?: string | null) {
  if (!value) return null;

  const today = new Date();
  const endDate = new Date(value);

  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  const diff = endDate.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getProgressPercent(startValue?: string | null, endValue?: string | null) {
  if (!startValue || !endValue) return 0;

  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  const now = Date.now();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;

  const total = end - start;
  const remaining = end - now;

  return clamp(Math.round((remaining / total) * 100), 0, 100);
}

function getSubscriptionProgressPercent(studio: SuperAdminStudio) {
  if (!studio.subscription_end_date) return 0;

  const start = studio.subscription_start_date || studio.created_at;
  return getProgressPercent(start, studio.subscription_end_date);
}

function getTrialProgressPercent(studio: SuperAdminStudio) {
  if (!studio.trial_ends_at) return 0;

  const start = studio.trial_started_at || studio.created_at;
  return getProgressPercent(start, studio.trial_ends_at);
}

function getRenewalDaysLabel(value?: string | null) {
  const left = daysLeft(value);

  if (left === null) return "Tarih yok";
  if (left < 0) return `${Math.abs(left)} gün geçti`;
  if (left === 0) return "Bugün bitiyor";
  return `${left} gün kaldı`;
}

function billingTypeLabel(type: AddonBillingType) {
  if (type === "yearly") return "Yıllık";
  if (type === "one_time") return "Tek Seferlik";
  return "Aylık";
}

function addonStatusLabel(status: AddonLicenseStatus) {
  if (status === "trial") return "Deneme";
  if (status === "active") return "Aktif";
  if (status === "expired") return "Süresi Doldu";
  if (status === "cancelled") return "İptal";
  return "Pasif";
}

function addonStatusClass(status: AddonLicenseStatus) {
  if (status === "active") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "trial") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
  }

  if (status === "expired") {
    return "border-orange-500/30 bg-orange-500/10 text-orange-200";
  }

  if (status === "cancelled") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }

  return "border-white/10 bg-white/5 text-zinc-300";
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function getStudioAddonKey(studioId: string, addonId: string) {
  return `${studioId}:${addonId}`;
}

function isAddonAvailableForAccount(addon: Addon, accountType: AccountType) {
  if (accountType === "individual") {
    return addon.available_for_individual;
  }

  return addon.available_for_studio;
}

function getCatalogPrice(addon: Addon, billingType: AddonBillingType) {
  if (billingType === "yearly") return Number(addon.yearly_price || 0);
  if (billingType === "one_time") return Number(addon.one_time_price || 0);
  return Number(addon.monthly_price || 0);
}

function emptyNewAddon(): NewAddonState {
  return {
    code: "",
    name: "",
    description: "",
    billing_type: "monthly",
    monthly_price: "",
    yearly_price: "",
    one_time_price: "",
    available_for_studio: true,
    available_for_individual: false,
    sort_order: "100",
  };
}

export default function SuperAdminPage() {
  const router = useRouter();

  const [studios, setStudios] = useState<SuperAdminStudio[]>([]);
  const [edits, setEdits] = useState<Record<string, StudioEditState>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [newAccountType, setNewAccountType] = useState<AccountType>("studio");
  const [newStudioName, setNewStudioName] = useState("");
  const [newOwnerFullName, setNewOwnerFullName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newUserLimit, setNewUserLimit] = useState(3);


  const [addons, setAddons] = useState<Addon[]>([]);
  const [studioAddons, setStudioAddons] = useState<StudioAddonLicense[]>([]);
  const [addonEdits, setAddonEdits] = useState<Record<string, AddonEditState>>(
    {}
  );
  const [studioAddonEdits, setStudioAddonEdits] = useState<
    Record<string, StudioAddonEditState>
  >({});
  const [newAddon, setNewAddon] = useState<NewAddonState>(emptyNewAddon());
  const [addonSavingKey, setAddonSavingKey] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session?.user) {
      router.replace("/login");
      return;
    }

    const loggedUserId = sessionData.session.user.id;

    const { data: superAdminRow, error: superAdminError } = await supabase
      .from("super_admins")
      .select("id, user_id, is_active")
      .eq("user_id", loggedUserId)
      .eq("is_active", true)
      .maybeSingle();

    if (superAdminError) {
      console.error("Super admin kontrol hatası:", superAdminError.message);
    }

    if (!superAdminRow) {
      const currentStudio = await getCurrentStudio();

      if (currentStudio) {
        router.replace(getPanelPathByRole(currentStudio.role));
        return;
      }

      await supabase.auth.signOut();
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase.rpc("get_super_admin_studios", {});

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const cleanStudios = ((data || []) as SuperAdminStudio[]).map((studio) => ({
      ...studio,
      user_count: Number(studio.user_count || 0),
      user_limit: Number(studio.user_limit || 1),
      monthly_price: Number(studio.monthly_price || 0),
      account_type: studio.account_type || "studio",
    }));

    setStudios(cleanStudios);

    const editMap: Record<string, StudioEditState> = {};

    cleanStudios.forEach((studio) => {
      editMap[studio.studio_id] = {
        studio_status: studio.studio_status,
        plan_name:
          studio.plan_name ||
          (studio.account_type === "individual"
            ? "Ücretsiz Solo"
            : "Studio Trial"),
        payment_status:
          studio.payment_status ||
          (studio.account_type === "individual" ? "free" : "trial"),
        monthly_price: String(studio.monthly_price || 0),
        subscription_start_date: studio.subscription_start_date || "",
        subscription_end_date: studio.subscription_end_date || "",
        super_admin_note: studio.super_admin_note || "",
        user_limit: String(
          studio.account_type === "individual" ? 1 : studio.user_limit || 3
        ),
      };
    });

    setEdits(editMap);

    try {
      const addonData = await fetchAddonManagementData(
        sessionData.session.access_token
      );
      applyAddonManagementData(addonData, cleanStudios);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Eklenti yönetim bilgileri yüklenemedi.";
      setErrorMessage(message);
    }
    setLoading(false);
  }


  async function fetchAddonManagementData(token: string) {
    const response = await fetch("/api/super-admin/addons", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const result = (await response.json()) as AddonApiResponse;

    if (!response.ok || result.error) {
      throw new Error(result.error || "Eklenti bilgileri alınamadı.");
    }

    return result;
  }

  function applyAddonManagementData(
    result: AddonApiResponse,
    studioList: SuperAdminStudio[]
  ) {
    const cleanAddons = (result.addons || []).map((addon) => ({
      ...addon,
      monthly_price:
        addon.monthly_price === null ? null : Number(addon.monthly_price || 0),
      yearly_price:
        addon.yearly_price === null ? null : Number(addon.yearly_price || 0),
      one_time_price:
        addon.one_time_price === null
          ? null
          : Number(addon.one_time_price || 0),
      sort_order: Number(addon.sort_order || 0),
    }));

    const cleanLicenses = (result.studioAddons || []).map((license) => ({
      ...license,
      agreed_price:
        license.agreed_price === null
          ? null
          : Number(license.agreed_price || 0),
    }));

    setAddons(cleanAddons);
    setStudioAddons(cleanLicenses);

    const nextAddonEdits: Record<string, AddonEditState> = {};

    cleanAddons.forEach((addon) => {
      nextAddonEdits[addon.id] = {
        name: addon.name,
        description: addon.description || "",
        billing_type: addon.billing_type,
        monthly_price:
          addon.monthly_price === null ? "" : String(addon.monthly_price),
        yearly_price:
          addon.yearly_price === null ? "" : String(addon.yearly_price),
        one_time_price:
          addon.one_time_price === null ? "" : String(addon.one_time_price),
        is_active: addon.is_active,
        available_for_studio: addon.available_for_studio,
        available_for_individual: addon.available_for_individual,
        sort_order: String(addon.sort_order || 0),
      };
    });

    setAddonEdits(nextAddonEdits);

    const licenseMap = new Map<string, StudioAddonLicense>();

    cleanLicenses.forEach((license) => {
      licenseMap.set(
        getStudioAddonKey(license.studio_id, license.addon_id),
        license
      );
    });

    const nextStudioAddonEdits: Record<string, StudioAddonEditState> = {};

    studioList.forEach((studio) => {
      cleanAddons.forEach((addon) => {
        if (!isAddonAvailableForAccount(addon, studio.account_type)) return;

        const key = getStudioAddonKey(studio.studio_id, addon.id);
        const license = licenseMap.get(key);
        const billingType = license?.billing_type || addon.billing_type;

        nextStudioAddonEdits[key] = {
          status: license?.status || "inactive",
          starts_at: toDateInput(license?.starts_at),
          ends_at: toDateInput(license?.ends_at),
          billing_type: billingType,
          agreed_price:
            license?.agreed_price === null ||
            license?.agreed_price === undefined
              ? String(getCatalogPrice(addon, billingType) || "")
              : String(license.agreed_price),
          auto_renew: Boolean(license?.auto_renew),
          notes: license?.notes || "",
        };
      });
    });

    setStudioAddonEdits(nextStudioAddonEdits);
  }

  async function getAccessToken() {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      throw new Error("Oturum bulunamadı.");
    }

    return token;
  }

  async function sendAddonAction(body: Record<string, unknown>) {
    const token = await getAccessToken();

    const response = await fetch("/api/super-admin/addons", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const result = (await response.json()) as AddonApiResponse & {
      success?: boolean;
    };

    if (!response.ok || result.error) {
      throw new Error(result.error || "Eklenti işlemi tamamlanamadı.");
    }

    applyAddonManagementData(result, studios);
    return result;
  }

  function updateAddonEdit<K extends keyof AddonEditState>(
    addonId: string,
    field: K,
    value: AddonEditState[K]
  ) {
    setAddonEdits((prev) => ({
      ...prev,
      [addonId]: {
        ...prev[addonId],
        [field]: value,
      },
    }));
  }

  function updateStudioAddonEdit<K extends keyof StudioAddonEditState>(
    studioId: string,
    addonId: string,
    field: K,
    value: StudioAddonEditState[K]
  ) {
    const key = getStudioAddonKey(studioId, addonId);

    setStudioAddonEdits((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  }

  function updateNewAddon<K extends keyof NewAddonState>(
    field: K,
    value: NewAddonState[K]
  ) {
    setNewAddon((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleCreateAddon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setAddonSavingKey("new-addon");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await sendAddonAction({
        action: "create_catalog_addon",
        code: newAddon.code,
        name: newAddon.name,
        description: newAddon.description,
        billingType: newAddon.billing_type,
        monthlyPrice: newAddon.monthly_price,
        yearlyPrice: newAddon.yearly_price,
        oneTimePrice: newAddon.one_time_price,
        availableForStudio: newAddon.available_for_studio,
        availableForIndividual: newAddon.available_for_individual,
        sortOrder: newAddon.sort_order,
        isActive: true,
      });

      setNewAddon(emptyNewAddon());
      setSuccessMessage("Yeni ücretli eklenti kataloğa eklendi.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Eklenti oluşturulamadı."
      );
    } finally {
      setAddonSavingKey(null);
    }
  }

  async function handleSaveCatalogAddon(addon: Addon) {
    const edit = addonEdits[addon.id];
    if (!edit) return;

    setAddonSavingKey(`catalog:${addon.id}`);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await sendAddonAction({
        action: "update_catalog_addon",
        addonId: addon.id,
        name: edit.name,
        description: edit.description,
        billingType: edit.billing_type,
        monthlyPrice: edit.monthly_price,
        yearlyPrice: edit.yearly_price,
        oneTimePrice: edit.one_time_price,
        isActive: edit.is_active,
        availableForStudio: edit.available_for_studio,
        availableForIndividual: edit.available_for_individual,
        sortOrder: edit.sort_order,
      });

      setSuccessMessage(`${edit.name} eklentisi güncellendi.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Eklenti güncellenemedi."
      );
    } finally {
      setAddonSavingKey(null);
    }
  }

  async function handleSaveStudioAddon(
    studio: SuperAdminStudio,
    addon: Addon
  ) {
    const key = getStudioAddonKey(studio.studio_id, addon.id);
    const edit = studioAddonEdits[key];
    if (!edit) return;

    if (
      edit.starts_at &&
      edit.ends_at &&
      new Date(edit.ends_at).getTime() <= new Date(edit.starts_at).getTime()
    ) {
      setErrorMessage("Eklenti bitiş tarihi başlangıçtan sonra olmalıdır.");
      return;
    }

    setAddonSavingKey(`license:${key}`);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await sendAddonAction({
        action: "upsert_studio_addon",
        studioId: studio.studio_id,
        addonId: addon.id,
        status: edit.status,
        startsAt: edit.starts_at,
        endsAt: edit.ends_at,
        billingType: edit.billing_type,
        agreedPrice: edit.agreed_price,
        autoRenew: edit.auto_renew,
        notes: edit.notes,
      });

      setSuccessMessage(
        `${addon.name}, ${studio.studio_name} hesabı için güncellendi.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Eklenti lisansı kaydedilemedi."
      );
    } finally {
      setAddonSavingKey(null);
    }
  }

  async function handleCancelStudioAddon(
    studio: SuperAdminStudio,
    addon: Addon
  ) {
    const existingLicense = studioAddons.find(
      (license) =>
        license.studio_id === studio.studio_id && license.addon_id === addon.id
    );

    if (!existingLicense) {
      setErrorMessage("Bu hesap için kaydedilmiş bir eklenti lisansı yok.");
      return;
    }

    const confirmed = window.confirm(
      `${studio.studio_name} hesabındaki ${addon.name} eklentisini iptal etmek istediğine emin misin?`
    );

    if (!confirmed) return;

    const key = getStudioAddonKey(studio.studio_id, addon.id);
    setAddonSavingKey(`license:${key}`);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await sendAddonAction({
        action: "cancel_studio_addon",
        studioId: studio.studio_id,
        addonId: addon.id,
      });

      setSuccessMessage(
        `${addon.name}, ${studio.studio_name} hesabında iptal edildi.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Eklenti iptal edilemedi."
      );
    } finally {
      setAddonSavingKey(null);
    }
  }

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.replace("/login");
  }

  async function handleCreateStudio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setErrorMessage("Oturum bulunamadı.");
      setSaving(false);
      return;
    }

    const response = await fetch("/api/super-admin/create-studio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        accountType: newAccountType,
        studioName: newStudioName,
        ownerFullName: newOwnerFullName,
        ownerEmail: newOwnerEmail,
        ownerPassword: newOwnerPassword,
        userLimit: newAccountType === "individual" ? 1 : newUserLimit,
      }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      setErrorMessage(result.error || "Hesap oluşturulamadı.");
      setSaving(false);
      return;
    }

    setSuccessMessage(
      newAccountType === "individual"
        ? "Bireysel solo hesap oluşturuldu."
        : "Stüdyo hesabı oluşturuldu."
    );

    setNewAccountType("studio");
    setNewStudioName("");
    setNewOwnerFullName("");
    setNewOwnerEmail("");
    setNewOwnerPassword("");
    setNewUserLimit(3);

    setSaving(false);

    await loadData();
  }

  function updateStudioEdit<K extends keyof StudioEditState>(
    studioId: string,
    field: K,
    value: StudioEditState[K]
  ) {
    setEdits((prev) => ({
      ...prev,
      [studioId]: {
        ...prev[studioId],
        [field]: value,
      },
    }));
  }

  async function handleSaveStudio(studio: SuperAdminStudio) {
    const edit = edits[studio.studio_id];

    if (!edit) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const finalUserLimit =
      studio.account_type === "individual"
        ? 1
        : Math.max(1, Number(edit.user_limit || 1));

    const { error } = await supabase.rpc("super_admin_update_studio_billing", {
      target_studio_id: studio.studio_id,
      p_status: edit.studio_status,
      p_plan_name: edit.plan_name,
      p_payment_status: edit.payment_status,
      p_monthly_price: Number(edit.monthly_price || 0),
      p_subscription_start_date: edit.subscription_start_date || null,
      p_subscription_end_date: edit.subscription_end_date || null,
      p_super_admin_note: edit.super_admin_note || null,
      p_user_limit: finalUserLimit,
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setSuccessMessage("Hesap bilgileri güncellendi.");
    setSaving(false);

    await loadData();
  }

  async function handleDeleteStudio(studio: SuperAdminStudio) {
    const confirmed = window.confirm(
      `${studio.studio_name} hesabını silmek istediğine emin misin?\n\nBu işlem hesabı Super Admin listesinden kaldırır ve kullanıcılarını pasif yapar.`
    );

    if (!confirmed) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase.rpc("super_admin_delete_studio", {
      target_studio_id: studio.studio_id,
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setSuccessMessage("Hesap silindi.");
    setSaving(false);

    await loadData();
  }

  const summary = useMemo<Summary>(() => {
    if (!studios.length) return emptySummary();

    return studios.reduce<Summary>((total, studio) => {
      const monthlyPrice = Number(studio.monthly_price || 0);
      const subscriptionLeft = daysLeft(studio.subscription_end_date);
      const trialLeft = daysLeft(studio.trial_ends_at);

      total.totalStudios += 1;
      total.totalUsers += Number(studio.user_count || 0);

      if (studio.account_type === "individual") {
        total.individualAccounts += 1;
      } else {
        total.studioAccounts += 1;
      }

      if (studio.studio_status === "trial") total.trialStudios += 1;
      if (studio.studio_status === "active") total.activeStudios += 1;
      if (studio.studio_status === "suspended") total.suspendedStudios += 1;
      if (studio.studio_status === "cancelled") total.cancelledStudios += 1;

      if (studio.payment_status === "free") total.freeAccounts += 1;

      if (studio.studio_status !== "cancelled" && studio.studio_status !== "suspended") {
        total.expectedMonthlyRevenue += monthlyPrice;
      }

      if (studio.payment_status === "paid") {
        total.paidMonthlyRevenue += monthlyPrice;
      }

      if (
        studio.account_type === "studio" &&
        studio.studio_status === "trial" &&
        trialLeft !== null &&
        trialLeft >= 0 &&
        trialLeft <= 7
      ) {
        total.expiringTrials += 1;
      }

      if (
        studio.subscription_end_date &&
        subscriptionLeft !== null &&
        subscriptionLeft >= 0 &&
        subscriptionLeft <= 7
      ) {
        total.expiringSubscriptions += 1;
      }

      return total;
    }, emptySummary());
  }, [studios]);



  const addonSummary = useMemo<AddonSummary>(() => {
    return studioAddons.reduce<AddonSummary>(
      (total, license) => {
        if (license.status !== "active" && license.status !== "trial") {
          return total;
        }

        if (license.status === "active") total.activeLicenses += 1;
        if (license.status === "trial") total.trialLicenses += 1;

        const price = Number(license.agreed_price || 0);

        if (license.billing_type === "monthly") {
          total.recurringMonthlyEstimate += price;
        } else if (license.billing_type === "yearly") {
          total.recurringMonthlyEstimate += price / 12;
        } else if (license.billing_type === "one_time") {
          total.oneTimeSales += price;
        }

        return total;
      },
      {
        activeLicenses: 0,
        trialLicenses: 0,
        recurringMonthlyEstimate: 0,
        oneTimeSales: 0,
      }
    );
  }, [studioAddons]);

  if (loading) {
    return (
      <main className="min-h-screen elegant-page text-white flex items-center justify-center p-4 md:p-6">
        <div className="rounded-[2rem] elegant-card p-6 md:p-8">
          <h1 className="text-2xl font-bold">Super Admin yükleniyor...</h1>
          <p className="text-zinc-400 mt-2 text-sm md:text-base">
            Hesaplar, deneme süreleri ve kullanıcı limitleri hazırlanıyor.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen elegant-page text-white p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
              SaaS Yönetimi
            </p>

            <h1 className="text-3xl md:text-4xl font-black mt-4">
              Super Admin Paneli
            </h1>

            <p className="text-zinc-400 mt-2 text-sm md:text-base">
              Stüdyo ve bireysel solo hesapları, deneme sürelerini, kullanıcı
              limitlerini, paketleri ve abonelik durumunu yönet.
            </p>

            <p className="text-zinc-500 mt-2 text-xs md:text-sm">
              Ciro alanı, stüdyoların müşteri cirosu değil panel abonelik / paket
              gelir tahminidir.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-200 hover:bg-red-500/20 transition"
          >
            Çıkış Yap
          </button>
        </div>

        {errorMessage && (
          <div className="rounded-3xl bg-red-500/10 border border-red-500/30 p-4 md:p-5 mb-6">
            <p className="text-red-200 font-semibold">Hata</p>
            <p className="text-red-100/80 mt-2 text-sm">{errorMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="rounded-3xl bg-emerald-500/10 border border-emerald-500/30 p-4 md:p-5 mb-6">
            <p className="text-emerald-200 font-semibold">Başarılı</p>
            <p className="text-emerald-100/80 mt-2 text-sm">
              {successMessage}
            </p>
          </div>
        )}

        <section className="grid grid-cols-2 lg:grid-cols-7 gap-3 md:gap-4 mb-8">
          <SummaryCard title="Toplam Hesap" value={summary.totalStudios} />
          <SummaryCard title="Stüdyo" value={summary.studioAccounts} />
          <SummaryCard title="Bireysel" value={summary.individualAccounts} />
          <SummaryCard title="Aktif" value={summary.activeStudios} />
          <SummaryCard title="Deneme" value={summary.trialStudios} />
          <SummaryCard title="Askıda" value={summary.suspendedStudios} />
          <SummaryCard title="Kullanıcı" value={summary.totalUsers} />
        </section>

        <ReportSection studios={studios} summary={summary} />


        <AddonCatalogSection
          addons={addons}
          addonEdits={addonEdits}
          newAddon={newAddon}
          addonSummary={addonSummary}
          savingKey={addonSavingKey}
          onUpdateNewAddon={updateNewAddon}
          onCreateAddon={handleCreateAddon}
          onUpdateAddonEdit={updateAddonEdit}
          onSaveAddon={handleSaveCatalogAddon}
        />

        <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-black mb-4">
            Yeni Hesap Oluştur
          </h2>

          <form
            onSubmit={handleCreateStudio}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4"
          >
            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Hesap Türü
              </label>

              <select
                value={newAccountType}
                onChange={(event) =>
                  setNewAccountType(event.target.value as AccountType)
                }
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="studio">Stüdyo</option>
                <option value="individual">Bireysel</option>
              </select>

              <p className="text-xs text-zinc-500 mt-2">
                Bireysel hesap ücretsiz solo paneldir.
              </p>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                {newAccountType === "individual"
                  ? "Sanatçı / Hesap Adı"
                  : "Stüdyo Adı"}
              </label>

              <input
                value={newStudioName}
                onChange={(event) => setNewStudioName(event.target.value)}
                required
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                placeholder={
                  newAccountType === "individual"
                    ? "Solo Artist"
                    : "Studio Name"
                }
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Owner Adı
              </label>

              <input
                value={newOwnerFullName}
                onChange={(event) => setNewOwnerFullName(event.target.value)}
                required
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                placeholder="Ad Soyad"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Owner E-posta
              </label>

              <input
                type="email"
                value={newOwnerEmail}
                onChange={(event) => setNewOwnerEmail(event.target.value)}
                required
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                placeholder="mail@ornek.com"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Şifre
              </label>

              <input
                type="password"
                value={newOwnerPassword}
                onChange={(event) => setNewOwnerPassword(event.target.value)}
                required
                minLength={6}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                placeholder="En az 6 karakter"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Kullanıcı Limiti
              </label>

              <input
                type="number"
                min={1}
                value={newAccountType === "individual" ? 1 : newUserLimit}
                onChange={(event) => setNewUserLimit(Number(event.target.value))}
                disabled={newAccountType === "individual"}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white disabled:opacity-50"
              />

              <p className="text-xs text-zinc-500 mt-2">
                Bireysel hesapta limit otomatik 1 olur.
              </p>
            </div>

            <div className="md:col-span-2 xl:col-span-6">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl elegant-button-gold px-4 py-4 font-black transition disabled:opacity-50"
              >
                {saving
                  ? "Oluşturuluyor..."
                  : newAccountType === "individual"
                    ? "Bireysel Solo Hesap Oluştur"
                    : "Stüdyo Hesabı Oluştur"}
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-5">
          {studios.length === 0 ? (
            <div className="rounded-[2rem] elegant-card p-6 text-zinc-400">
              Henüz hesap yok.
            </div>
          ) : (
            studios.map((studio) => {
              const edit = edits[studio.studio_id];
              const leftDays = daysLeft(studio.trial_ends_at);
              const trialPercent = getTrialProgressPercent(studio);
              const subscriptionPercent = getSubscriptionProgressPercent(studio);

              return (
                <div
                  key={studio.studio_id}
                  className="rounded-[2rem] elegant-card p-4 md:p-6"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl md:text-2xl font-black">
                          {studio.studio_name}
                        </h3>

                        <span className={statusBadgeClass(studio.studio_status)}>
                          {statusLabel(studio.studio_status)}
                        </span>

                        <span
                          className={accountTypeBadgeClass(studio.account_type)}
                        >
                          {accountTypeLabel(studio.account_type)}
                        </span>
                      </div>

                      <p className="text-zinc-500 text-sm mt-2">
                        Slug: {studio.studio_slug}
                      </p>

                      <p className="text-zinc-500 text-sm mt-1">
                        Oluşturulma: {formatDateTime(studio.created_at)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteStudio(studio)}
                      disabled={saving}
                      className="rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200 px-5 py-3 text-sm font-bold hover:bg-red-500/20 transition disabled:opacity-50"
                    >
                      Hesabı Sil
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
                    <InfoCard
                      title="Owner"
                      value={studio.owner_name || "-"}
                      subValue={studio.owner_email || "-"}
                    />

                    <InfoCard
                      title="Kullanıcı"
                      value={`${studio.user_count} / ${studio.user_limit}`}
                      subValue="Aktif kullanıcı / limit"
                    />

                    <InfoCard
                      title="Paket"
                      value={studio.plan_name || "-"}
                      subValue={paymentStatusLabel(studio.payment_status)}
                    />

                    <InfoCard
                      title="Paket Tutarı"
                      value={formatPrice(studio.monthly_price)}
                      subValue="Panel abonelik bedeli"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                    <ProgressCard
                      title="Deneme Süresi"
                      description={
                        studio.account_type === "individual"
                          ? "Bireysel solo hesapta deneme süresi kullanılmaz."
                          : `Başlangıç: ${formatDate(studio.trial_started_at)} / Bitiş: ${formatDate(studio.trial_ends_at)}`
                      }
                      label={
                        studio.account_type === "individual"
                          ? "Ücretsiz Solo"
                          : getRenewalDaysLabel(studio.trial_ends_at)
                      }
                      percent={studio.account_type === "individual" ? 100 : trialPercent}
                    />

                    <ProgressCard
                      title="Üyelik Yenileme Süresi"
                      description={`Başlangıç: ${formatDate(studio.subscription_start_date)} / Bitiş: ${formatDate(studio.subscription_end_date)}`}
                      label={getRenewalDaysLabel(studio.subscription_end_date)}
                      percent={subscriptionPercent}
                    />
                  </div>

                  {edit && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm text-zinc-400 mb-2">
                          Hesap Durumu
                        </label>

                        <select
                          value={edit.studio_status}
                          onChange={(event) =>
                            updateStudioEdit(
                              studio.studio_id,
                              "studio_status",
                              event.target.value as StudioStatus
                            )
                          }
                          className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                        >
                          {studio.account_type === "studio" && (
                            <option value="trial">Deneme</option>
                          )}
                          <option value="active">Aktif</option>
                          <option value="suspended">Askıda</option>
                          <option value="cancelled">İptal</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm text-zinc-400 mb-2">
                          Paket
                        </label>

                        <input
                          value={edit.plan_name}
                          onChange={(event) =>
                            updateStudioEdit(
                              studio.studio_id,
                              "plan_name",
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-zinc-400 mb-2">
                          Ödeme Durumu
                        </label>

                        <select
                          value={edit.payment_status}
                          onChange={(event) =>
                            updateStudioEdit(
                              studio.studio_id,
                              "payment_status",
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                        >
                          {studio.account_type === "individual" && (
                            <option value="free">Ücretsiz</option>
                          )}
                          <option value="trial">Deneme</option>
                          <option value="paid">Ödendi</option>
                          <option value="pending">Bekliyor</option>
                          <option value="overdue">Gecikti</option>
                          <option value="expired">Süresi Doldu</option>
                          <option value="cancelled">İptal</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm text-zinc-400 mb-2">
                          Aylık Ücret
                        </label>

                        <input
                          type="number"
                          min={0}
                          value={edit.monthly_price}
                          onChange={(event) =>
                            updateStudioEdit(
                              studio.studio_id,
                              "monthly_price",
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                        />

                        <p className="text-xs text-zinc-500 mt-2">
                          Şu an: {formatPrice(Number(edit.monthly_price || 0))}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm text-zinc-400 mb-2">
                          Kullanıcı Limiti
                        </label>

                        <input
                          type="number"
                          min={1}
                          value={
                            studio.account_type === "individual"
                              ? 1
                              : edit.user_limit
                          }
                          onChange={(event) =>
                            updateStudioEdit(
                              studio.studio_id,
                              "user_limit",
                              event.target.value
                            )
                          }
                          disabled={studio.account_type === "individual"}
                          className="w-full rounded-2xl elegant-input px-4 py-4 text-white disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-zinc-400 mb-2">
                          Abonelik Başlangıç
                        </label>

                        <input
                          type="date"
                          value={edit.subscription_start_date}
                          onChange={(event) =>
                            updateStudioEdit(
                              studio.studio_id,
                              "subscription_start_date",
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-zinc-400 mb-2">
                          Abonelik Bitiş
                        </label>

                        <input
                          type="date"
                          value={edit.subscription_end_date}
                          onChange={(event) =>
                            updateStudioEdit(
                              studio.studio_id,
                              "subscription_end_date",
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                        />
                      </div>

                      <div className="md:col-span-2 xl:col-span-4">
                        <label className="block text-sm text-zinc-400 mb-2">
                          Super Admin Notu
                        </label>

                        <textarea
                          value={edit.super_admin_note}
                          onChange={(event) =>
                            updateStudioEdit(
                              studio.studio_id,
                              "super_admin_note",
                              event.target.value
                            )
                          }
                          rows={3}
                          className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                          placeholder="Ödeme, paket, müşteri notu..."
                        />
                      </div>

                      <div className="md:col-span-2 xl:col-span-4">
                        <button
                          type="button"
                          onClick={() => handleSaveStudio(studio)}
                          disabled={saving}
                          className="w-full rounded-2xl elegant-button-gold px-4 py-4 font-black transition disabled:opacity-50"
                        >
                          {saving ? "Kaydediliyor..." : "Hesabı Güncelle"}
                        </button>
                      </div>
                    </div>
                  )}

                  <StudioAddonManager
                    studio={studio}
                    addons={addons}
                    licenses={studioAddons}
                    edits={studioAddonEdits}
                    savingKey={addonSavingKey}
                    onUpdateEdit={updateStudioAddonEdit}
                    onSave={handleSaveStudioAddon}
                    onCancel={handleCancelStudioAddon}
                  />
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}


function AddonCatalogSection({
  addons,
  addonEdits,
  newAddon,
  addonSummary,
  savingKey,
  onUpdateNewAddon,
  onCreateAddon,
  onUpdateAddonEdit,
  onSaveAddon,
}: {
  addons: Addon[];
  addonEdits: Record<string, AddonEditState>;
  newAddon: NewAddonState;
  addonSummary: AddonSummary;
  savingKey: string | null;
  onUpdateNewAddon: <K extends keyof NewAddonState>(
    field: K,
    value: NewAddonState[K]
  ) => void;
  onCreateAddon: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUpdateAddonEdit: <K extends keyof AddonEditState>(
    addonId: string,
    field: K,
    value: AddonEditState[K]
  ) => void;
  onSaveAddon: (addon: Addon) => Promise<void>;
}) {
  return (
    <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
            Ücretli Modüller
          </p>
          <h2 className="text-xl md:text-2xl font-black mt-3">
            Eklenti Kataloğu
          </h2>
          <p className="text-zinc-500 text-sm mt-2 max-w-3xl">
            Eklenti fiyatlarını, hangi hesap türlerinde satılacağını ve katalogda
            aktif olup olmayacağını buradan yönetebilirsin.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <InfoCard
          title="Aktif Lisans"
          value={String(addonSummary.activeLicenses)}
          subValue="Ücretli olarak açık eklentiler"
        />
        <InfoCard
          title="Deneme Lisansı"
          value={String(addonSummary.trialLicenses)}
          subValue="Deneme süresindeki eklentiler"
        />
        <InfoCard
          title="Aylık Eklenti Geliri"
          value={formatPrice(addonSummary.recurringMonthlyEstimate)}
          subValue="Yıllık ücretler 12 aya bölünür"
        />
        <InfoCard
          title="Tek Seferlik Satış"
          value={formatPrice(addonSummary.oneTimeSales)}
          subValue="Aktif tek seferlik lisanslar"
        />
      </div>

      <details className="rounded-3xl elegant-card-soft p-4 md:p-5 mb-6">
        <summary className="cursor-pointer list-none font-black text-white">
          + Yeni Eklenti Oluştur
        </summary>

        <form
          onSubmit={onCreateAddon}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-5"
        >
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Eklenti Kodu
            </label>
            <input
              value={newAddon.code}
              onChange={(event) =>
                onUpdateNewAddon(
                  "code",
                  event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                )
              }
              required
              className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
              placeholder="ornek_eklenti"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Eklenti Adı
            </label>
            <input
              value={newAddon.name}
              onChange={(event) => onUpdateNewAddon("name", event.target.value)}
              required
              className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
              placeholder="Örnek Eklenti"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Varsayılan Faturalandırma
            </label>
            <select
              value={newAddon.billing_type}
              onChange={(event) =>
                onUpdateNewAddon(
                  "billing_type",
                  event.target.value as AddonBillingType
                )
              }
              className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
            >
              <option value="monthly">Aylık</option>
              <option value="yearly">Yıllık</option>
              <option value="one_time">Tek Seferlik</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Sıralama
            </label>
            <input
              type="number"
              min={0}
              value={newAddon.sort_order}
              onChange={(event) =>
                onUpdateNewAddon("sort_order", event.target.value)
              }
              className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Aylık Fiyat
            </label>
            <input
              type="number"
              min={0}
              value={newAddon.monthly_price}
              onChange={(event) =>
                onUpdateNewAddon("monthly_price", event.target.value)
              }
              className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Yıllık Fiyat
            </label>
            <input
              type="number"
              min={0}
              value={newAddon.yearly_price}
              onChange={(event) =>
                onUpdateNewAddon("yearly_price", event.target.value)
              }
              className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Tek Seferlik Fiyat
            </label>
            <input
              type="number"
              min={0}
              value={newAddon.one_time_price}
              onChange={(event) =>
                onUpdateNewAddon("one_time_price", event.target.value)
              }
              className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
            />
          </div>

          <div className="flex flex-col justify-end gap-3">
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={newAddon.available_for_studio}
                onChange={(event) =>
                  onUpdateNewAddon("available_for_studio", event.target.checked)
                }
              />
              Stüdyo hesabında satılabilir
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={newAddon.available_for_individual}
                onChange={(event) =>
                  onUpdateNewAddon(
                    "available_for_individual",
                    event.target.checked
                  )
                }
              />
              Bireysel hesapta satılabilir
            </label>
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <label className="block text-sm text-zinc-400 mb-2">
              Açıklama
            </label>
            <textarea
              value={newAddon.description}
              onChange={(event) =>
                onUpdateNewAddon("description", event.target.value)
              }
              rows={3}
              className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
            />
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <button
              type="submit"
              disabled={savingKey === "new-addon"}
              className="w-full rounded-2xl elegant-button-gold px-4 py-4 font-black disabled:opacity-50"
            >
              {savingKey === "new-addon"
                ? "Eklenti Oluşturuluyor..."
                : "Eklentiyi Kataloğa Ekle"}
            </button>
          </div>
        </form>
      </details>

      <div className="space-y-4">
        {addons.length === 0 ? (
          <div className="rounded-2xl elegant-card-soft p-4 text-zinc-400">
            Katalogda henüz eklenti yok.
          </div>
        ) : (
          addons.map((addon) => {
            const edit = addonEdits[addon.id];
            if (!edit) return null;

            const isSaving = savingKey === `catalog:${addon.id}`;

            return (
              <details
                key={addon.id}
                className="rounded-3xl elegant-card-soft p-4 md:p-5"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-white">{addon.name}</p>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                          {addon.code}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            edit.is_active
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                              : "border-red-500/30 bg-red-500/10 text-red-200"
                          }`}
                        >
                          {edit.is_active ? "Katalogda Aktif" : "Katalogda Pasif"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-2">
                        Varsayılan: {billingTypeLabel(edit.billing_type)}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-500">
                      Düzenlemek için aç
                    </span>
                  </div>
                </summary>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Ad</label>
                    <input
                      value={edit.name}
                      onChange={(event) =>
                        onUpdateAddonEdit(addon.id, "name", event.target.value)
                      }
                      className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Varsayılan Tür
                    </label>
                    <select
                      value={edit.billing_type}
                      onChange={(event) =>
                        onUpdateAddonEdit(
                          addon.id,
                          "billing_type",
                          event.target.value as AddonBillingType
                        )
                      }
                      className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
                    >
                      <option value="monthly">Aylık</option>
                      <option value="yearly">Yıllık</option>
                      <option value="one_time">Tek Seferlik</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Aylık Fiyat
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={edit.monthly_price}
                      onChange={(event) =>
                        onUpdateAddonEdit(
                          addon.id,
                          "monthly_price",
                          event.target.value
                        )
                      }
                      className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Yıllık Fiyat
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={edit.yearly_price}
                      onChange={(event) =>
                        onUpdateAddonEdit(
                          addon.id,
                          "yearly_price",
                          event.target.value
                        )
                      }
                      className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Tek Seferlik Fiyat
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={edit.one_time_price}
                      onChange={(event) =>
                        onUpdateAddonEdit(
                          addon.id,
                          "one_time_price",
                          event.target.value
                        )
                      }
                      className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Sıralama
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={edit.sort_order}
                      onChange={(event) =>
                        onUpdateAddonEdit(
                          addon.id,
                          "sort_order",
                          event.target.value
                        )
                      }
                      className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
                    />
                  </div>

                  <div className="flex flex-col justify-end gap-3">
                    <label className="flex items-center gap-3 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={edit.is_active}
                        onChange={(event) =>
                          onUpdateAddonEdit(
                            addon.id,
                            "is_active",
                            event.target.checked
                          )
                        }
                      />
                      Katalogda aktif
                    </label>
                    <label className="flex items-center gap-3 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={edit.available_for_studio}
                        onChange={(event) =>
                          onUpdateAddonEdit(
                            addon.id,
                            "available_for_studio",
                            event.target.checked
                          )
                        }
                      />
                      Stüdyo hesabına açık
                    </label>
                  </div>

                  <div className="flex flex-col justify-end gap-3">
                    <label className="flex items-center gap-3 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={edit.available_for_individual}
                        onChange={(event) =>
                          onUpdateAddonEdit(
                            addon.id,
                            "available_for_individual",
                            event.target.checked
                          )
                        }
                      />
                      Bireysel hesaba açık
                    </label>
                  </div>

                  <div className="md:col-span-2 xl:col-span-4">
                    <label className="block text-sm text-zinc-400 mb-2">
                      Açıklama
                    </label>
                    <textarea
                      value={edit.description}
                      onChange={(event) =>
                        onUpdateAddonEdit(
                          addon.id,
                          "description",
                          event.target.value
                        )
                      }
                      rows={3}
                      className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
                    />
                  </div>

                  <div className="md:col-span-2 xl:col-span-4">
                    <button
                      type="button"
                      onClick={() => onSaveAddon(addon)}
                      disabled={isSaving}
                      className="w-full rounded-2xl elegant-button-gold px-4 py-4 font-black disabled:opacity-50"
                    >
                      {isSaving ? "Kaydediliyor..." : "Eklentiyi Güncelle"}
                    </button>
                  </div>
                </div>
              </details>
            );
          })
        )}
      </div>
    </section>
  );
}

function StudioAddonManager({
  studio,
  addons,
  licenses,
  edits,
  savingKey,
  onUpdateEdit,
  onSave,
  onCancel,
}: {
  studio: SuperAdminStudio;
  addons: Addon[];
  licenses: StudioAddonLicense[];
  edits: Record<string, StudioAddonEditState>;
  savingKey: string | null;
  onUpdateEdit: <K extends keyof StudioAddonEditState>(
    studioId: string,
    addonId: string,
    field: K,
    value: StudioAddonEditState[K]
  ) => void;
  onSave: (studio: SuperAdminStudio, addon: Addon) => Promise<void>;
  onCancel: (studio: SuperAdminStudio, addon: Addon) => Promise<void>;
}) {
  const availableAddons = addons.filter((addon) =>
    isAddonAvailableForAccount(addon, studio.account_type)
  );

  const activeCount = licenses.filter(
    (license) =>
      license.studio_id === studio.studio_id &&
      (license.status === "active" || license.status === "trial")
  ).length;

  return (
    <details className="rounded-3xl border border-yellow-400/20 bg-yellow-400/[0.04] p-4 md:p-5 mt-5">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="font-black text-white">Ücretli Eklentiler</p>
            <p className="text-xs text-zinc-500 mt-1">
              Bu hesaba özel lisans, süre ve fiyat yönetimi.
            </p>
          </div>
          <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-200">
            {activeCount} aktif / deneme
          </span>
        </div>
      </summary>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-5">
        {availableAddons.length === 0 ? (
          <div className="rounded-2xl elegant-card p-4 text-zinc-400 xl:col-span-2">
            Bu hesap türü için kullanılabilir eklenti yok.
          </div>
        ) : (
          availableAddons.map((addon) => {
            const key = getStudioAddonKey(studio.studio_id, addon.id);
            const edit = edits[key];
            if (!edit) return null;

            const license = licenses.find(
              (item) =>
                item.studio_id === studio.studio_id &&
                item.addon_id === addon.id
            );
            const isSaving = savingKey === `license:${key}`;

            return (
              <div key={addon.id} className="rounded-3xl elegant-card p-4 md:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-white">{addon.name}</p>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${addonStatusClass(
                          edit.status
                        )}`}
                      >
                        {addonStatusLabel(edit.status)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                      {addon.code} · Katalog fiyatı: {formatPrice(
                        getCatalogPrice(addon, edit.billing_type)
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-2">
                      Lisans Durumu
                    </label>
                    <select
                      value={edit.status}
                      onChange={(event) =>
                        onUpdateEdit(
                          studio.studio_id,
                          addon.id,
                          "status",
                          event.target.value as AddonLicenseStatus
                        )
                      }
                      className="w-full rounded-2xl elegant-input px-3 py-3 text-white"
                    >
                      <option value="inactive">Pasif</option>
                      <option value="trial">Deneme</option>
                      <option value="active">Aktif</option>
                      <option value="expired">Süresi Doldu</option>
                      <option value="cancelled">İptal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-2">
                      Faturalandırma
                    </label>
                    <select
                      value={edit.billing_type}
                      onChange={(event) => {
                        const nextType = event.target.value as AddonBillingType;
                        onUpdateEdit(
                          studio.studio_id,
                          addon.id,
                          "billing_type",
                          nextType
                        );
                        onUpdateEdit(
                          studio.studio_id,
                          addon.id,
                          "agreed_price",
                          String(getCatalogPrice(addon, nextType) || "")
                        );
                      }}
                      className="w-full rounded-2xl elegant-input px-3 py-3 text-white"
                    >
                      <option value="monthly">Aylık</option>
                      <option value="yearly">Yıllık</option>
                      <option value="one_time">Tek Seferlik</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-2">
                      Anlaşılan Fiyat
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={edit.agreed_price}
                      onChange={(event) =>
                        onUpdateEdit(
                          studio.studio_id,
                          addon.id,
                          "agreed_price",
                          event.target.value
                        )
                      }
                      className="w-full rounded-2xl elegant-input px-3 py-3 text-white"
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-3 rounded-2xl elegant-input px-3 py-3 w-full text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={edit.auto_renew}
                        onChange={(event) =>
                          onUpdateEdit(
                            studio.studio_id,
                            addon.id,
                            "auto_renew",
                            event.target.checked
                          )
                        }
                      />
                      Otomatik yenileme
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-2">
                      Başlangıç
                    </label>
                    <input
                      type="date"
                      value={edit.starts_at}
                      onChange={(event) =>
                        onUpdateEdit(
                          studio.studio_id,
                          addon.id,
                          "starts_at",
                          event.target.value
                        )
                      }
                      className="w-full rounded-2xl elegant-input px-3 py-3 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-2">
                      Bitiş
                    </label>
                    <input
                      type="date"
                      value={edit.ends_at}
                      onChange={(event) =>
                        onUpdateEdit(
                          studio.studio_id,
                          addon.id,
                          "ends_at",
                          event.target.value
                        )
                      }
                      className="w-full rounded-2xl elegant-input px-3 py-3 text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs text-zinc-400 mb-2">
                      Not
                    </label>
                    <textarea
                      rows={2}
                      value={edit.notes}
                      onChange={(event) =>
                        onUpdateEdit(
                          studio.studio_id,
                          addon.id,
                          "notes",
                          event.target.value
                        )
                      }
                      className="w-full rounded-2xl elegant-input px-3 py-3 text-white"
                      placeholder="Ödeme veya lisans notu..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => onSave(studio, addon)}
                    disabled={isSaving}
                    className="rounded-2xl elegant-button-gold px-4 py-3 font-black disabled:opacity-50"
                  >
                    {isSaving ? "Kaydediliyor..." : "Lisansı Kaydet"}
                  </button>

                  <button
                    type="button"
                    onClick={() => onCancel(studio, addon)}
                    disabled={isSaving || !license}
                    className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-bold text-red-200 hover:bg-red-500/20 disabled:opacity-40"
                  >
                    Lisansı İptal Et
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </details>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl elegant-card p-4 md:p-5">
      <p className="text-zinc-400 text-xs md:text-sm">{title}</p>
      <p className="text-2xl md:text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}

function InfoCard({
  title,
  value,
  subValue,
}: {
  title: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="rounded-2xl elegant-card-soft p-4">
      <p className="text-zinc-500 text-xs">{title}</p>
      <p className="font-bold mt-1">{value}</p>
      {subValue && <p className="text-zinc-500 text-xs mt-1">{subValue}</p>}
    </div>
  );
}

function ProgressCard({
  title,
  description,
  label,
  percent,
}: {
  title: string;
  description: string;
  label: string;
  percent: number;
}) {
  const safePercent = clamp(percent, 0, 100);

  return (
    <div className="rounded-3xl elegant-card-soft p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-bold text-white">{title}</p>
          <p className="text-xs text-zinc-500 mt-1">{description}</p>
        </div>

        <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-semibold text-zinc-300 whitespace-nowrap">
          {label}
        </span>
      </div>

      <div className="mt-4 h-4 rounded-full bg-zinc-900 border border-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-yellow-400 transition-all"
          style={{ width: `${safePercent}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
        <span>Kalan oran</span>
        <span>%{safePercent}</span>
      </div>
    </div>
  );
}

function ReportSection({
  studios,
  summary,
}: {
  studios: SuperAdminStudio[];
  summary: Summary;
}) {
  const totalAccounts = summary.studioAccounts + summary.individualAccounts;
  const studioPercent = totalAccounts
    ? Math.round((summary.studioAccounts / totalAccounts) * 100)
    : 0;
  const individualPercent = totalAccounts ? 100 - studioPercent : 0;

  const expiringTrials = studios
    .filter((studio) => studio.account_type === "studio")
    .filter((studio) => {
      const left = daysLeft(studio.trial_ends_at);
      return left !== null && left >= 0 && left <= 7;
    });

  const expiringSubscriptions = studios.filter((studio) => {
    const left = daysLeft(studio.subscription_end_date);
    return left !== null && left >= 0 && left <= 7;
  });

  return (
    <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
            Raporlar
          </p>

          <h2 className="text-xl md:text-2xl font-black mt-3">
            Panel Kullanım ve Gelir Raporu
          </h2>

          <p className="text-zinc-500 text-sm mt-2">
            Bu bölüm panel aboneliği / paket ücretleri üzerinden hesaplanır.
            Stüdyoların kendi müşteri cirosu burada gösterilmez.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <InfoCard
          title="Beklenen Aylık Ciro"
          value={formatPrice(summary.expectedMonthlyRevenue)}
          subValue="Aktif / deneme panel paketleri"
        />

        <InfoCard
          title="Ödenmiş Aylık Ciro"
          value={formatPrice(summary.paidMonthlyRevenue)}
          subValue="Ödeme durumu ödendi olanlar"
        />

        <InfoCard
          title="Ücretsiz Hesap"
          value={String(summary.freeAccounts)}
          subValue="Bireysel solo / ücretsiz plan"
        />

        <InfoCard
          title="Yaklaşan Süreler"
          value={`${summary.expiringTrials + summary.expiringSubscriptions}`}
          subValue="7 gün içinde deneme / üyelik bitişi"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="rounded-3xl elegant-card-soft p-4 md:p-5">
          <p className="font-bold text-white">Bireysel / Stüdyo Kullanımı</p>
          <p className="text-xs text-zinc-500 mt-1">
            Açılmış panel tiplerinin kullanım kıyaslaması.
          </p>

          <div className="mt-5 flex flex-col sm:flex-row items-center gap-5">
            <div
              className="h-40 w-40 rounded-full border border-white/10"
              style={{
                background: `conic-gradient(#38bdf8 0 ${studioPercent}%, #c084fc ${studioPercent}% 100%)`,
              }}
            />

            <div className="space-y-3 w-full">
              <PieLegend
                label="Stüdyo paneli"
                value={`${summary.studioAccounts} hesap / %${studioPercent}`}
              />
              <PieLegend
                label="Bireysel solo panel"
                value={`${summary.individualAccounts} hesap / %${individualPercent}`}
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl elegant-card-soft p-4 md:p-5 xl:col-span-2">
          <p className="font-bold text-white">Yaklaşan Deneme ve Yenilemeler</p>
          <p className="text-xs text-zinc-500 mt-1">
            Deneme ve üyelik süreleri azalan bar mantığıyla takip edilir.
          </p>

          <div className="mt-5 space-y-4">
            {[...expiringTrials, ...expiringSubscriptions].length === 0 ? (
              <div className="rounded-2xl elegant-card p-4 text-zinc-400 text-sm">
                Önümüzdeki 7 gün içinde biten deneme veya üyelik yok.
              </div>
            ) : (
              [...expiringTrials, ...expiringSubscriptions]
                .slice(0, 6)
                .map((studio) => {
                  const isTrial =
                    studio.account_type === "studio" &&
                    studio.studio_status === "trial" &&
                    daysLeft(studio.trial_ends_at) !== null;

                  const endDate = isTrial
                    ? studio.trial_ends_at
                    : studio.subscription_end_date;

                  const percent = isTrial
                    ? getTrialProgressPercent(studio)
                    : getSubscriptionProgressPercent(studio);

                  return (
                    <MiniProgressRow
                      key={`${studio.studio_id}-${isTrial ? "trial" : "sub"}`}
                      title={studio.studio_name}
                      subtitle={isTrial ? "Deneme süresi" : "Üyelik yenileme"}
                      label={getRenewalDaysLabel(endDate)}
                      percent={percent}
                    />
                  );
                })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PieLegend({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl elegant-card p-3">
      <p className="text-sm font-bold text-white">{label}</p>
      <p className="text-xs text-zinc-500 mt-1">{value}</p>
    </div>
  );
}

function MiniProgressRow({
  title,
  subtitle,
  label,
  percent,
}: {
  title: string;
  subtitle: string;
  label: string;
  percent: number;
}) {
  const safePercent = clamp(percent, 0, 100);

  return (
    <div className="rounded-2xl elegant-card p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
        <div>
          <p className="font-bold text-white">{title}</p>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
        <span className="text-xs font-semibold text-yellow-200">{label}</span>
      </div>

      <div className="h-3 rounded-full bg-zinc-900 border border-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-yellow-400 transition-all"
          style={{ width: `${safePercent}%` }}
        />
      </div>
    </div>
  );
}
