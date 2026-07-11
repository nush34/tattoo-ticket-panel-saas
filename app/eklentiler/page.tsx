"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import {
  getCurrentStudio,
  getPanelPathByRole,
} from "../../lib/saas/studio";

type LicenseStatus =
  | "not_purchased"
  | "inactive"
  | "scheduled"
  | "trial"
  | "active"
  | "expired"
  | "cancelled";

type AddonRow = {
  addon_id: string;
  addon_code: string;
  addon_name: string;
  addon_description: string | null;

  billing_type: "monthly" | "yearly" | "one_time";

  monthly_price: number | string | null;
  yearly_price: number | string | null;
  one_time_price: number | string | null;

  is_enabled: boolean;
  license_status: LicenseStatus;

  starts_at: string | null;
  ends_at: string | null;

  agreed_price: number | string | null;
  auto_renew: boolean;
};

type FilterType = "all" | "active" | "available";

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Fiyat belirlenmedi";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "Fiyat belirlenmedi";
  }

  return `${numberValue.toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
  })} TL`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function daysLeft(value?: string | null) {
  if (!value) return null;

  const endDate = new Date(value);
  const today = new Date();

  if (Number.isNaN(endDate.getTime())) {
    return null;
  }

  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  const difference = endDate.getTime() - today.getTime();

  return Math.ceil(difference / (1000 * 60 * 60 * 24));
}

function billingTypeLabel(
  billingType: "monthly" | "yearly" | "one_time"
) {
  if (billingType === "yearly") return "Yıllık";
  if (billingType === "one_time") return "Tek Seferlik";

  return "Aylık";
}

function getMainPrice(addon: AddonRow) {
  if (
    addon.agreed_price !== null &&
    addon.agreed_price !== undefined &&
    addon.agreed_price !== ""
  ) {
    return addon.agreed_price;
  }

  if (addon.billing_type === "yearly") {
    return addon.yearly_price;
  }

  if (addon.billing_type === "one_time") {
    return addon.one_time_price;
  }

  return addon.monthly_price;
}

function licenseStatusLabel(status: LicenseStatus) {
  if (status === "active") return "Aktif";
  if (status === "trial") return "Deneme";
  if (status === "scheduled") return "Planlandı";
  if (status === "inactive") return "Pasif";
  if (status === "expired") return "Süresi Doldu";
  if (status === "cancelled") return "İptal Edildi";

  return "Satın Alınmadı";
}

function licenseStatusClass(status: LicenseStatus) {
  if (status === "active") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "trial") {
    return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
  }

  if (status === "scheduled") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  }

  if (status === "expired") {
    return "border-orange-500/30 bg-orange-500/10 text-orange-200";
  }

  if (status === "cancelled") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }

  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

function getLicenseDescription(addon: AddonRow) {
  if (addon.license_status === "active") {
    const remainingDays = daysLeft(addon.ends_at);

    if (remainingDays === null) {
      return "Eklenti hesabında aktif.";
    }

    if (remainingDays === 0) {
      return "Eklentinin kullanım süresi bugün sona eriyor.";
    }

    if (remainingDays < 0) {
      return "Eklentinin kullanım süresi sona erdi.";
    }

    return `${remainingDays} gün kullanım süresi kaldı.`;
  }

  if (addon.license_status === "trial") {
    const remainingDays = daysLeft(addon.ends_at);

    if (remainingDays === null) {
      return "Eklenti deneme kapsamında aktif.";
    }

    if (remainingDays === 0) {
      return "Deneme süresi bugün sona eriyor.";
    }

    if (remainingDays < 0) {
      return "Deneme süresi sona erdi.";
    }

    return `${remainingDays} günlük deneme süresi kaldı.`;
  }

  if (addon.license_status === "scheduled") {
    return `Eklenti ${formatDate(addon.starts_at)} tarihinde açılacak.`;
  }

  if (addon.license_status === "expired") {
    return "Eklentinin kullanım süresi sona erdi. Yeniden satın alabilirsin.";
  }

  if (addon.license_status === "cancelled") {
    return "Eklenti lisansı iptal edilmiş.";
  }

  if (addon.license_status === "inactive") {
    return "Eklenti lisansı şu anda pasif.";
  }

  return "Bu eklenti henüz hesabına tanımlanmamış.";
}

export default function EklentilerPage() {
  const router = useRouter();

  const [addons, setAddons] = useState<AddonRow[]>([]);
  const [accountType, setAccountType] = useState<
    "studio" | "individual" | null
  >(null);

  const [filter, setFilter] = useState<FilterType>("all");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPage() {
    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();
    const studio = await getCurrentStudio();

    if (!studio) {
      router.replace("/login");
      return;
    }

    if (
      studio.studio_status === "suspended" ||
      studio.studio_status === "cancelled"
    ) {
      router.replace("/abonelik");
      return;
    }

    if (
      studio.role !== "owner" &&
      studio.role !== "admin" &&
      studio.account_type !== "individual"
    ) {
      router.replace(getPanelPathByRole(studio.role));
      return;
    }

    setAccountType(studio.account_type);

    const { data, error } = await supabase.rpc("get_my_addons");

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const cleanAddons = ((data || []) as AddonRow[]).map((addon) => ({
      ...addon,
      monthly_price:
        addon.monthly_price === null
          ? null
          : Number(addon.monthly_price),

      yearly_price:
        addon.yearly_price === null
          ? null
          : Number(addon.yearly_price),

      one_time_price:
        addon.one_time_price === null
          ? null
          : Number(addon.one_time_price),

      agreed_price:
        addon.agreed_price === null
          ? null
          : Number(addon.agreed_price),

      is_enabled: Boolean(addon.is_enabled),
      auto_renew: Boolean(addon.auto_renew),
    }));

    setAddons(cleanAddons);
    setLoading(false);
  }

  const filteredAddons = useMemo(() => {
    if (filter === "active") {
      return addons.filter((addon) => addon.is_enabled);
    }

    if (filter === "available") {
      return addons.filter((addon) => !addon.is_enabled);
    }

    return addons;
  }, [addons, filter]);

  const summary = useMemo(() => {
    const activeCount = addons.filter(
      (addon) => addon.license_status === "active"
    ).length;

    const trialCount = addons.filter(
      (addon) => addon.license_status === "trial"
    ).length;

    const availableCount = addons.filter(
      (addon) => !addon.is_enabled
    ).length;

    return {
      totalCount: addons.length,
      activeCount,
      trialCount,
      availableCount,
    };
  }, [addons]);

  function handlePurchase(addon: AddonRow) {
    const query = new URLSearchParams({
      addon: addon.addon_code,
      addonName: addon.addon_name,
    });

    router.push(`/uyelik-satin-al?${query.toString()}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen elegant-page p-4 text-white md:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2rem] elegant-card p-6">
            <h1 className="text-2xl font-black">
              Eklenti mağazası yükleniyor...
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Kullanılabilir eklentiler ve lisans durumları hazırlanıyor.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen elegant-page p-4 text-white md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
            Panel Mağazası
          </p>

          <h1 className="mt-4 text-3xl font-black md:text-4xl">
            Ücretli Eklentiler
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400 md:text-base">
            Paneline ihtiyacın olan özellikleri ayrı ayrı ekle. Yalnızca
            kullandığın eklentiler için ödeme yap.
          </p>

          <p className="mt-2 text-xs text-zinc-500">
            Hesap türü:{" "}
            {accountType === "individual"
              ? "Bireysel Solo Panel"
              : "Stüdyo Paneli"}
          </p>
        </header>

        {errorMessage ? (
          <div className="mb-6 rounded-3xl border border-red-500/30 bg-red-500/10 p-5">
            <p className="font-bold text-red-200">Hata</p>
            <p className="mt-2 text-sm text-red-100/80">
              {errorMessage}
            </p>
          </div>
        ) : null}

        <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <SummaryCard
            title="Toplam Eklenti"
            value={summary.totalCount}
          />

          <SummaryCard
            title="Aktif"
            value={summary.activeCount}
          />

          <SummaryCard
            title="Deneme"
            value={summary.trialCount}
          />

          <SummaryCard
            title="Satın Alınabilir"
            value={summary.availableCount}
          />
        </section>

        <section className="mb-6 flex flex-wrap gap-2">
          <FilterButton
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Tüm Eklentiler
          </FilterButton>

          <FilterButton
            active={filter === "active"}
            onClick={() => setFilter("active")}
          >
            Aktif Eklentiler
          </FilterButton>

          <FilterButton
            active={filter === "available"}
            onClick={() => setFilter("available")}
          >
            Satın Alınabilir
          </FilterButton>
        </section>

        {filteredAddons.length === 0 ? (
          <section className="rounded-[2rem] elegant-card p-6 text-zinc-400">
            Bu filtreye uygun eklenti bulunamadı.
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {filteredAddons.map((addon) => {
              const mainPrice = getMainPrice(addon);

              return (
                <article
                  key={addon.addon_id}
                  className={`rounded-[2rem] border p-5 md:p-6 ${
                    addon.is_enabled
                      ? "border-yellow-400/30 bg-yellow-400/[0.05]"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black md:text-2xl">
                          {addon.addon_name}
                        </h2>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${licenseStatusClass(
                            addon.license_status
                          )}`}
                        >
                          {licenseStatusLabel(addon.license_status)}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-zinc-400">
                        {addon.addon_description ||
                          "Bu eklenti için açıklama bulunmuyor."}
                      </p>
                    </div>

                    {addon.is_enabled ? (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-xl text-emerald-300">
                        ✓
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl text-zinc-400">
                        +
                      </div>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl elegant-card-soft p-4">
                      <p className="text-xs text-zinc-500">
                        {billingTypeLabel(addon.billing_type)} Ücret
                      </p>

                      <p className="mt-2 text-xl font-black text-white">
                        {formatPrice(mainPrice)}
                      </p>
                    </div>

                    <div className="rounded-2xl elegant-card-soft p-4">
                      <p className="text-xs text-zinc-500">
                        Lisans Durumu
                      </p>

                      <p className="mt-2 text-sm font-bold text-white">
                        {getLicenseDescription(addon)}
                      </p>
                    </div>
                  </div>

                  {(addon.starts_at || addon.ends_at) && (
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 px-4 py-3">
                        <p className="text-xs text-zinc-500">
                          Başlangıç Tarihi
                        </p>

                        <p className="mt-1 text-sm font-bold">
                          {formatDate(addon.starts_at)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 px-4 py-3">
                        <p className="text-xs text-zinc-500">
                          Bitiş Tarihi
                        </p>

                        <p className="mt-1 text-sm font-bold">
                          {formatDate(addon.ends_at)}
                        </p>
                      </div>
                    </div>
                  )}

                  {addon.auto_renew && addon.is_enabled ? (
                    <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] px-4 py-3 text-sm text-sky-200">
                      Otomatik yenileme açık.
                    </div>
                  ) : null}

                  <div className="mt-5">
                    {addon.is_enabled ? (
                      <button
                        type="button"
                        disabled
                        className="w-full cursor-not-allowed rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 font-black text-emerald-200"
                      >
                        Eklenti Aktif
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePurchase(addon)}
                        className="w-full rounded-2xl elegant-button-gold px-4 py-4 font-black transition"
                      >
                        {addon.license_status === "expired" ||
                        addon.license_status === "cancelled"
                          ? "Yeniden Satın Al"
                          : "Satın Al"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <section className="mt-8 rounded-[2rem] elegant-card p-5 md:p-6">
          <h2 className="text-xl font-black">
            Eklenti satın alma işlemi
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Ödeme sistemi tamamlanana kadar satın alma talepleri manuel
            onaylanacaktır. Ödeme sonrasında eklenti Super Admin tarafından
            hesabına tanımlanır ve kullanım süresi başlatılır.
          </p>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl elegant-card p-4 md:p-5">
      <p className="text-xs text-zinc-400 md:text-sm">{title}</p>
      <p className="mt-2 text-2xl font-black md:text-3xl">{value}</p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
        active
          ? "border-yellow-400 bg-yellow-400 text-black"
          : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]"
      }`}
    >
      {children}
    </button>
  );
}