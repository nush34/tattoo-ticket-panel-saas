"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { getCurrentStudio, getPanelPathByRole, type CurrentStudio } from "../../lib/saas/studio";

type StudioBilling = {
  id: string;
  name: string;
  status: "trial" | "active" | "suspended" | "cancelled";
  account_type: "studio" | "individual";
  plan_name: string | null;
  payment_status: string | null;
  monthly_price: number | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  user_limit: number | null;
};

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function daysBetween(start: Date, end: Date) {
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.ceil((end.getTime() - start.getTime()) / oneDay);
}

function getProgress(start?: string | null, end?: string | null) {
  if (!start || !end) {
    return {
      percent: 0,
      remainingDays: null as number | null,
      totalDays: null as number | null,
      isExpired: false,
    };
  }

  const now = new Date();
  const startDate = new Date(start);
  const endDate = new Date(end);

  const totalMs = endDate.getTime() - startDate.getTime();
  const remainingMs = endDate.getTime() - now.getTime();

  const totalDays = Math.max(1, daysBetween(startDate, endDate));
  const remainingDays = daysBetween(now, endDate);

  if (totalMs <= 0) {
    return {
      percent: 0,
      remainingDays,
      totalDays,
      isExpired: true,
    };
  }

  const rawPercent = (remainingMs / totalMs) * 100;
  const percent = Math.max(0, Math.min(100, Math.round(rawPercent)));

  return {
    percent,
    remainingDays,
    totalDays,
    isExpired: remainingMs <= 0,
  };
}

function statusText(status?: string | null) {
  if (status === "trial") return "Deneme sürümü";
  if (status === "active") return "Aktif";
  if (status === "suspended") return "Askıya alınmış";
  if (status === "cancelled") return "İptal edilmiş";
  return status || "-";
}

function paymentText(status?: string | null) {
  if (status === "trial") return "Deneme";
  if (status === "paid") return "Ödendi";
  if (status === "free") return "Ücretsiz";
  if (status === "pending") return "Bekliyor";
  if (status === "expired") return "Süresi doldu";
  if (status === "cancelled") return "İptal";
  return status || "-";
}

function ProgressBar({
  title,
  start,
  end,
}: {
  title: string;
  start?: string | null;
  end?: string | null;
}) {
  const progress = getProgress(start, end);

  if (!start || !end) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="text-sm font-black text-white">{title}</div>
        <p className="mt-2 text-sm text-zinc-400">Bu hesap için süre bilgisi yok.</p>
      </div>
    );
  }

  const remainingLabel = progress.isExpired
    ? `${Math.abs(progress.remainingDays || 0)} gün geçti`
    : `${progress.remainingDays} gün kaldı`;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-black text-white">{title}</div>
          <div className="mt-1 text-xs text-zinc-400">
            {formatDate(start)} - {formatDate(end)}
          </div>
        </div>

        <div className={progress.isExpired ? "text-sm font-black text-red-300" : "text-sm font-black text-emerald-300"}>
          {remainingLabel}
        </div>
      </div>

      <div className="mt-4 h-4 overflow-hidden rounded-full bg-white/10">
        <div
          className={progress.isExpired ? "h-full rounded-full bg-red-500" : "h-full rounded-full bg-emerald-400"}
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="mt-2 flex justify-between text-xs text-zinc-500">
        <span>Toplam {progress.totalDays} gün</span>
        <span>%{progress.percent}</span>
      </div>
    </div>
  );
}

export default function SubscriptionPage() {
  const router = useRouter();

  const [currentStudio, setCurrentStudio] = useState<CurrentStudio | null>(null);
  const [billing, setBilling] = useState<StudioBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setErrorMessage("");

    const studio = await getCurrentStudio();

    if (!studio) {
      router.replace("/login");
      return;
    }

    setCurrentStudio(studio);

    const supabase = createClient();

    const { data, error } = await supabase
      .from("studios")
      .select(
        "id, name, status, account_type, plan_name, payment_status, monthly_price, trial_started_at, trial_ends_at, subscription_start_date, subscription_end_date, user_limit"
      )
      .eq("id", studio.studio_id)
      .maybeSingle();

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setBilling((data as StudioBilling) || null);
    setLoading(false);
  }

  const effectiveBilling = useMemo(() => {
    if (billing) return billing;

    if (!currentStudio) return null;

    return {
      id: currentStudio.studio_id,
      name: currentStudio.studio_name,
      status: currentStudio.studio_status,
      account_type: currentStudio.account_type,
      plan_name: currentStudio.plan_name || null,
      payment_status: currentStudio.payment_status || null,
      monthly_price: currentStudio.monthly_price || null,
      trial_started_at: currentStudio.trial_started_at || null,
      trial_ends_at: currentStudio.trial_ends_at || null,
      subscription_start_date: currentStudio.subscription_start_date || null,
      subscription_end_date: currentStudio.subscription_end_date || null,
      user_limit: currentStudio.user_limit || null,
    };
  }, [billing, currentStudio]);

  if (loading) {
    return (
      <main className="min-h-screen elegant-page p-4 text-white">
        <div className="mx-auto max-w-5xl py-10">
          <div className="elegant-card rounded-[2rem] p-6">Abonelik bilgileri yükleniyor...</div>
        </div>
      </main>
    );
  }

  if (!effectiveBilling || !currentStudio) {
    return null;
  }

  const isBlocked =
    effectiveBilling.account_type === "studio" &&
    (effectiveBilling.status === "suspended" ||
      effectiveBilling.status === "cancelled" ||
      effectiveBilling.payment_status === "expired");

  const panelPath =
    currentStudio.account_type === "individual"
      ? "/solo-panel"
      : getPanelPathByRole(currentStudio.role);

  return (
    <main className="min-h-screen elegant-page p-4 text-white">
      <div className="mx-auto max-w-5xl py-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
              Abonelik Durumu
            </p>
            <h1 className="mt-3 text-3xl font-black md:text-4xl">{effectiveBilling.name}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Deneme süresi, üyelik yenileme ve panel erişim durumunu buradan takip edebilirsin.
            </p>
          </div>

          {!isBlocked ? (
            <Link href={panelPath} className="rounded-2xl elegant-button-gold px-5 py-3 text-sm font-black">
              Panele Dön
            </Link>
          ) : null}
        </div>

        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {errorMessage}
          </div>
        ) : null}

        {isBlocked ? (
          <div className="mb-6 rounded-[2rem] border border-red-500/30 bg-red-500/10 p-6">
            <h2 className="text-xl font-black text-red-100">Panel erişimi durduruldu</h2>
            <p className="mt-2 text-sm leading-6 text-red-100/80">
              Bu stüdyo hesabının deneme süresi veya üyelik süresi sona ermiş görünüyor. Hesap tekrar aktif edildiğinde panel erişimi otomatik olarak açılır.
            </p>
            <p className="mt-3 text-sm text-red-100/80">
              Şimdilik yenileme işlemi Super Admin tarafından manuel olarak yapılacak.
            </p>
          </div>
        ) : (
          <div className="mb-6 rounded-[2rem] border border-emerald-500/30 bg-emerald-500/10 p-6">
            <h2 className="text-xl font-black text-emerald-100">Panel erişimi aktif</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-100/80">
              Hesabın aktif görünüyor. Abonelik bilgilerini aşağıdan takip edebilirsin.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl elegant-card p-5">
            <p className="text-xs text-zinc-500">Paket</p>
            <p className="mt-2 text-lg font-black">{effectiveBilling.plan_name || "-"}</p>
          </div>

          <div className="rounded-3xl elegant-card p-5">
            <p className="text-xs text-zinc-500">Durum</p>
            <p className="mt-2 text-lg font-black">{statusText(effectiveBilling.status)}</p>
          </div>

          <div className="rounded-3xl elegant-card p-5">
            <p className="text-xs text-zinc-500">Ödeme</p>
            <p className="mt-2 text-lg font-black">{paymentText(effectiveBilling.payment_status)}</p>
          </div>

          <div className="rounded-3xl elegant-card p-5">
            <p className="text-xs text-zinc-500">Aylık Ücret</p>
            <p className="mt-2 text-lg font-black">
              {Number(effectiveBilling.monthly_price || 0).toLocaleString("tr-TR")} ₺
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ProgressBar
            title="Deneme Sürümü"
            start={effectiveBilling.trial_started_at}
            end={effectiveBilling.trial_ends_at}
          />

          <ProgressBar
            title="Üyelik Yenileme"
            start={effectiveBilling.subscription_start_date}
            end={effectiveBilling.subscription_end_date}
          />
        </div>
      </div>
    </main>
  );
}
