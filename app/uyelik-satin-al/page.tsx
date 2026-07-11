"use client";

import Link from "next/link";
import {
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import {
  getCurrentStudio,
  type CurrentStudio,
} from "../../lib/saas/studio";

type BillingType = "monthly" | "yearly" | "one_time";
type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

type AddonRow = {
  addon_id: string;
  addon_code: string;
  addon_name: string;
  addon_description: string | null;
  billing_type: BillingType;
  monthly_price: number | string | null;
  yearly_price: number | string | null;
  one_time_price: number | string | null;
  is_enabled: boolean;
  license_status: string;
  starts_at: string | null;
  ends_at: string | null;
  agreed_price: number | string | null;
  auto_renew: boolean;
};

type PurchaseRequest = {
  request_id: string;
  addon_id: string;
  addon_code: string;
  addon_name: string;
  request_kind: "purchase" | "renewal";
  billing_type: BillingType;
  requested_price: number | string | null;
  request_status: RequestStatus;
  requester_note: string | null;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Fiyat teklifi";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "Fiyat teklifi";
  }

  return `${numberValue.toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
  })} TL`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function billingTypeLabel(type: BillingType) {
  if (type === "yearly") return "Yıllık";
  if (type === "one_time") return "Tek Seferlik";

  return "Aylık";
}

function requestStatusLabel(status: RequestStatus) {
  if (status === "pending") return "Onay Bekliyor";
  if (status === "approved") return "Onaylandı";
  if (status === "rejected") return "Reddedildi";

  return "İptal Edildi";
}

function requestStatusClass(status: RequestStatus) {
  if (status === "approved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "rejected") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }

  if (status === "cancelled") {
    return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
  }

  return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
}

function getPriceForBillingType(
  addon: AddonRow,
  billingType: BillingType
) {
  if (billingType === "yearly") return addon.yearly_price;
  if (billingType === "one_time") return addon.one_time_price;

  return addon.monthly_price;
}

function getAvailableBillingTypes(addon: AddonRow): BillingType[] {
  const types: BillingType[] = [];

  if (addon.monthly_price !== null) types.push("monthly");
  if (addon.yearly_price !== null) types.push("yearly");
  if (addon.one_time_price !== null) types.push("one_time");

  if (types.length === 0) {
    types.push(addon.billing_type || "monthly");
  }

  return types;
}

export default function UyelikSatinAlPage() {
  return (
    <Suspense fallback={<PurchasePageLoading />}>
      <UyelikSatinAlContent />
    </Suspense>
  );
}

function UyelikSatinAlContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const addonCode = searchParams.get("addon")?.trim() || "";
  const isAddonMode = Boolean(addonCode);

  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [selectedAddon, setSelectedAddon] = useState<AddonRow | null>(
    null
  );
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);

  const [billingType, setBillingType] =
    useState<BillingType>("monthly");
  const [requesterNote, setRequesterNote] = useState("");

  const [loading, setLoading] = useState(isAddonMode);
  const [submitting, setSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!isAddonMode) {
      setLoading(false);
      return;
    }

    loadAddonPurchasePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addonCode, isAddonMode]);

  async function loadAddonPurchasePage() {
    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();
    const currentStudio = await getCurrentStudio();

    if (!currentStudio) {
      router.replace("/login");
      return;
    }

    if (
      currentStudio.role !== "owner" &&
      currentStudio.role !== "admin"
    ) {
      setErrorMessage(
        "Eklenti satın alma talebini yalnızca hesap sahibi veya admin oluşturabilir."
      );
      setLoading(false);
      return;
    }

    setStudio(currentStudio);

    const [
      { data: addonData, error: addonError },
      { data: requestData, error: requestError },
    ] = await Promise.all([
      supabase.rpc("get_my_addons"),
      supabase.rpc("get_my_addon_purchase_requests"),
    ]);

    if (addonError) {
      setErrorMessage(addonError.message);
      setLoading(false);
      return;
    }

    if (requestError) {
      setErrorMessage(requestError.message);
      setLoading(false);
      return;
    }

    const cleanAddons = ((addonData || []) as AddonRow[]).map(
      (addon) => ({
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
      })
    );

    const addon = cleanAddons.find(
      (item) => item.addon_code === addonCode
    );

    if (!addon) {
      setErrorMessage(
        "Seçilen eklenti bulunamadı veya hesabınız için uygun değil."
      );
      setLoading(false);
      return;
    }

    const cleanRequests = (
      (requestData || []) as PurchaseRequest[]
    ).map((request) => ({
      ...request,
      requested_price:
        request.requested_price === null
          ? null
          : Number(request.requested_price),
    }));

    const availableTypes = getAvailableBillingTypes(addon);

    setSelectedAddon(addon);
    setRequests(cleanRequests);
    setBillingType(
      availableTypes.includes(addon.billing_type)
        ? addon.billing_type
        : availableTypes[0]
    );
    setLoading(false);
  }

  async function handleCreateAddonRequest(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedAddon) return;

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase.rpc(
      "create_my_addon_purchase_request",
      {
        p_addon_code: selectedAddon.addon_code,
        p_billing_type: billingType,
        p_requester_note: requesterNote.trim() || null,
      }
    );

    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    setRequesterNote("");
    setSuccessMessage(
      "Eklenti satın alma talebiniz oluşturuldu. Super Admin onayından sonra eklenti otomatik olarak hesabınızda açılacak."
    );
    setSubmitting(false);

    await loadAddonPurchasePage();
  }

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/login");
    router.refresh();
  }

  const selectedAddonRequests = useMemo(() => {
    if (!selectedAddon) return [];

    return requests.filter(
      (request) =>
        request.addon_code === selectedAddon.addon_code
    );
  }, [requests, selectedAddon]);

  const pendingRequest = selectedAddonRequests.find(
    (request) => request.request_status === "pending"
  );

  const latestRequest = selectedAddonRequests[0] || null;

  if (loading) {
    return <PurchasePageLoading />;
  }

  if (isAddonMode) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-4 inline-flex rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-300">
                Eklenti Satın Alma
              </div>

              <h1 className="text-3xl font-black md:text-4xl">
                {selectedAddon?.addon_name || "Eklenti"}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300">
                Eklenti talebini oluştur. Talep Super Admin paneline
                düştükten sonra ödeme ve lisans bilgileri kontrol edilerek
                hesabına tanımlanacaktır.
              </p>

              {studio ? (
                <p className="mt-2 text-xs text-neutral-500">
                  Hesap: {studio.studio_name}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-red-500/10 hover:text-red-200"
            >
              Çıkış Yap
            </button>
          </div>

          {errorMessage ? (
            <div className="mb-6 rounded-3xl border border-red-500/30 bg-red-500/10 p-5">
              <p className="font-bold text-red-200">Hata</p>
              <p className="mt-2 text-sm text-red-100/80">
                {errorMessage}
              </p>
            </div>
          ) : null}

          {successMessage ? (
            <div className="mb-6 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <p className="font-bold text-emerald-200">Talep oluşturuldu</p>
              <p className="mt-2 text-sm text-emerald-100/80">
                {successMessage}
              </p>
            </div>
          ) : null}

          {selectedAddon ? (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-black">
                    {selectedAddon.addon_name}
                  </h2>

                  {selectedAddon.is_enabled ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200">
                      Aktif
                    </span>
                  ) : null}
                </div>

                <p className="mt-4 text-sm leading-7 text-neutral-300">
                  {selectedAddon.addon_description ||
                    "Bu eklenti için açıklama bulunmuyor."}
                </p>

                {selectedAddon.is_enabled ? (
                  <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                    <p className="font-black text-emerald-200">
                      Eklenti hesabınızda aktif
                    </p>

                    <p className="mt-2 text-sm text-emerald-100/70">
                      Bu eklenti için yeni satın alma talebi oluşturmanıza
                      gerek yok.
                    </p>
                  </div>
                ) : (
                  <form
                    onSubmit={handleCreateAddonRequest}
                    className="mt-6 space-y-5"
                  >
                    <div>
                      <label className="mb-2 block text-sm font-bold text-neutral-300">
                        Ödeme Dönemi
                      </label>

                      <div className="grid gap-3 sm:grid-cols-3">
                        {getAvailableBillingTypes(selectedAddon).map(
                          (type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setBillingType(type)}
                              className={`rounded-2xl border p-4 text-left transition ${
                                billingType === type
                                  ? "border-yellow-400 bg-yellow-400/10"
                                  : "border-white/10 bg-neutral-900 hover:bg-white/[0.06]"
                              }`}
                            >
                              <p className="text-sm font-black">
                                {billingTypeLabel(type)}
                              </p>

                              <p className="mt-2 text-lg font-black text-yellow-300">
                                {formatPrice(
                                  getPriceForBillingType(
                                    selectedAddon,
                                    type
                                  )
                                )}
                              </p>
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-neutral-300">
                        Talep Notu
                      </label>

                      <textarea
                        value={requesterNote}
                        onChange={(event) =>
                          setRequesterNote(event.target.value)
                        }
                        rows={4}
                        className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 text-white outline-none focus:border-yellow-400"
                        placeholder="Ödeme veya kullanım talebinizle ilgili not..."
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || Boolean(pendingRequest)}
                      className="w-full rounded-2xl bg-yellow-400 px-5 py-4 font-black text-neutral-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting
                        ? "Talep Oluşturuluyor..."
                        : pendingRequest
                          ? "Onay Bekleyen Talep Var"
                          : selectedAddon.license_status === "expired" ||
                              selectedAddon.license_status === "cancelled"
                            ? "Yenileme Talebi Oluştur"
                            : "Satın Alma Talebi Oluştur"}
                    </button>
                  </form>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/eklentiler"
                    className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-neutral-300 transition hover:bg-white/10 hover:text-white"
                  >
                    Eklenti Mağazasına Dön
                  </Link>
                </div>
              </section>

              <aside className="space-y-5">
                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <h2 className="text-xl font-black">Talep Durumu</h2>

                  {!latestRequest ? (
                    <p className="mt-3 text-sm leading-6 text-neutral-400">
                      Bu eklenti için henüz satın alma talebi
                      oluşturulmamış.
                    </p>
                  ) : (
                    <div className="mt-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${requestStatusClass(
                          latestRequest.request_status
                        )}`}
                      >
                        {requestStatusLabel(
                          latestRequest.request_status
                        )}
                      </span>

                      <div className="mt-4 space-y-3 text-sm">
                        <StatusRow
                          label="Talep Türü"
                          value={
                            latestRequest.request_kind === "renewal"
                              ? "Yenileme"
                              : "Yeni Satın Alma"
                          }
                        />

                        <StatusRow
                          label="Dönem"
                          value={billingTypeLabel(
                            latestRequest.billing_type
                          )}
                        />

                        <StatusRow
                          label="Talep Fiyatı"
                          value={formatPrice(
                            latestRequest.requested_price
                          )}
                        />

                        <StatusRow
                          label="Talep Tarihi"
                          value={formatDateTime(
                            latestRequest.created_at
                          )}
                        />
                      </div>

                      {latestRequest.admin_note ? (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-neutral-900 p-4">
                          <p className="text-xs font-bold text-neutral-500">
                            Super Admin Notu
                          </p>

                          <p className="mt-2 text-sm leading-6 text-neutral-300">
                            {latestRequest.admin_note}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>

                <section className="rounded-3xl border border-yellow-400/20 bg-yellow-400/[0.06] p-5">
                  <h2 className="font-black text-yellow-200">
                    Onay sonrası
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-neutral-300">
                    Talep onaylandığında eklenti lisansı otomatik
                    oluşturulur. Sayfayı yenilediğinizde özellik
                    Ekstralar menüsünde görünür.
                  </p>
                </section>
              </aside>
            </div>
          ) : (
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <p className="text-neutral-400">
                Eklenti bilgileri yüklenemedi.
              </p>

              <Link
                href="/eklentiler"
                className="mt-5 inline-flex rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-neutral-300"
              >
                Eklenti Mağazasına Dön
              </Link>
            </section>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-4 inline-flex rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-300">
              Üyelik Satın Alma
            </div>

            <h1 className="text-4xl font-black">
              Panel üyeliğini yenile
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300">
              Stüdyo panelini tekrar aktif hale getirmek için uygun paketi
              seç. Ödeme entegrasyonu tamamlanana kadar üyelik yenileme
              işlemleri manuel olarak onaylanacaktır.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-red-500/10 hover:text-red-200"
          >
            Çıkış Yap
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <MembershipCard
            name="Starter"
            price="2.500 ₺"
            subtitle="Aylık"
            features={[
              "Stüdyo paneli",
              "Çoklu kullanıcı",
              "Bilet ve ödeme takibi",
              "Takvim",
              "Raporlar",
            ]}
            href="mailto:destek@tattoopanel.com?subject=Starter üyelik satın alma"
            buttonLabel="Starter Satın Al"
          />

          <MembershipCard
            name="Professional"
            price="3.500 ₺"
            subtitle="Aylık"
            features={[
              "Starter içindeki her şey",
              "Daha yüksek kullanıcı limiti",
              "Gelişmiş rapor takibi",
              "Öncelikli destek",
              "Stüdyo büyüme paketi",
            ]}
            href="mailto:destek@tattoopanel.com?subject=Professional üyelik satın alma"
            buttonLabel="Professional Satın Al"
            recommended
          />

          <MembershipCard
            name="Custom"
            price="Özel"
            subtitle="İhtiyaca göre"
            features={[
              "Büyük ekipler",
              "Özel kullanıcı limiti",
              "Özel destek",
              "Kurulum desteği",
              "Özel fiyatlandırma",
            ]}
            href="mailto:destek@tattoopanel.com?subject=Custom üyelik paketi"
            buttonLabel="Teklif Al"
          />
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-black">
            Ödeme sonrası ne olacak?
          </h2>

          <p className="mt-3 text-sm leading-6 text-neutral-300">
            Ödeme onaylandıktan sonra hesabın Super Admin panelinden
            aktif hale getirilir. Hesap aktif edildiğinde giriş yaptığında
            otomatik olarak kendi paneline yönlendirilirsin.
          </p>

          <Link
            href="/abonelik"
            className="mt-5 inline-flex rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-neutral-300 transition hover:bg-white/10 hover:text-white"
          >
            Abonelik Durumuna Dön
          </Link>
        </div>
      </div>
    </main>
  );
}

function PurchasePageLoading() {
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          Satın alma ekranı yükleniyor...
        </div>
      </div>
    </main>
  );
}

function StatusRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-bold text-white">{value}</span>
    </div>
  );
}

function MembershipCard({
  name,
  price,
  subtitle,
  features,
  href,
  buttonLabel,
  recommended = false,
}: {
  name: string;
  price: string;
  subtitle: string;
  features: string[];
  href: string;
  buttonLabel: string;
  recommended?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-6 ${
        recommended
          ? "border-yellow-400/30 bg-yellow-400/[0.08] shadow-2xl"
          : "border-white/10 bg-white/[0.04]"
      }`}
    >
      {recommended ? (
        <div className="mb-4 inline-flex rounded-full bg-yellow-400/15 px-3 py-1 text-sm font-bold text-yellow-300">
          Önerilen
        </div>
      ) : null}

      <div className="text-sm font-bold text-neutral-400">{name}</div>

      <div className="mt-4 text-3xl font-black">{price}</div>
      <div className="mt-1 text-sm text-neutral-400">{subtitle}</div>

      <ul className="mt-6 space-y-2 text-sm text-neutral-300">
        {features.map((feature) => (
          <li key={feature}>• {feature}</li>
        ))}
      </ul>

      <a
        href={href}
        className={`mt-6 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-black transition ${
          recommended
            ? "bg-yellow-400 text-neutral-950 hover:bg-yellow-300"
            : "border border-white/10 text-white hover:bg-white/10"
        }`}
      >
        {buttonLabel}
      </a>
    </div>
  );
}
