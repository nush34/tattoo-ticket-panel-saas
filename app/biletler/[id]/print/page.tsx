"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";
import {
  getCurrentStudio,
  getPanelPathByRole,
  type CurrentStudio,
} from "../../../../lib/saas/studio";

type StudioStaffMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
};

type StudioSettings = {
  studio_name: string | null;
  logo_url: string | null;
  phone: string | null;
  instagram: string | null;
  address: string | null;
  print_footer_text: string | null;
  watermark_enabled: boolean | null;
  theme_color: string | null;
};

type TicketRow = Record<string, any>;

function addCacheBuster(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
}

async function resolveStorageImageUrl(rawImageUrl: string | null) {
  if (!rawImageUrl) return null;

  const cleanValue = rawImageUrl.trim();

  if (!cleanValue) return null;

  if (cleanValue.startsWith("http://") || cleanValue.startsWith("https://")) {
    return addCacheBuster(cleanValue);
  }

  const storagePath = cleanValue
    .replace(/^studio-assets\//, "")
    .replace(/^\/+/, "");

  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from("studio-assets")
    .createSignedUrl(storagePath, 60 * 60);

  if (error) {
    console.error("Print logo signed url error:", error.message);
    return null;
  }

  return data?.signedUrl ? addCacheBuster(data.signedUrl) : null;
}

async function getStudioStaff(studioId: string): Promise<StudioStaffMember[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("studio_members")
    .select("id, full_name, email, role, is_active")
    .eq("studio_id", studioId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("getStudioStaff error:", error.message);
    return [];
  }

  return (data || []) as StudioStaffMember[];
}

function getValue(row: TicketRow | null, keys: string[]) {
  if (!row) return null;

  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }

  return null;
}

function getText(row: TicketRow | null, keys: string[], fallback = "-") {
  const value = getValue(row, keys);

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function getNumber(row: TicketRow | null, keys: string[]) {
  const value = getValue(row, keys);
  const numberValue = Number(value || 0);

  if (Number.isNaN(numberValue)) return 0;

  return numberValue;
}

function formatCurrency(value: number | null | undefined) {
  const safeValue = Number(value || 0);

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(safeValue);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function normalizeSource(value: string | null | undefined) {
  if (value === "sosyal_medya") return "Sosyal medya";
  if (value === "kapi_musterisi") return "Kapı müşterisi";
  if (value === "diger") return "Diğer";
  return value || "-";
}

function normalizeStatus(value: string | null | undefined) {
  if (value === "yapildi") return "Yapıldı";
  if (value === "iptal") return "İptal";
  return "Bekliyor";
}

export default function TicketPrintPage() {
  const params = useParams();
  const router = useRouter();

  const ticketId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [currentStudio, setCurrentStudio] = useState<CurrentStudio | null>(null);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [ticket, setTicket] = useState<TicketRow | null>(null);
  const [staff, setStaff] = useState<StudioStaffMember[]>([]);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadPrintPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  async function loadPrintPage() {
    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    const studio = await getCurrentStudio();

    if (!studio) {
      router.replace("/login");
      return;
    }

    if (
      studio.account_type !== "individual" &&
      (studio.studio_status === "suspended" ||
        studio.studio_status === "cancelled")
    ) {
      router.replace("/abonelik");
      return;
    }

    setCurrentStudio(studio);

    const { data: settingsData, error: settingsError } = await supabase
      .from("studio_settings")
      .select(
        `
        studio_name,
        logo_url,
        phone,
        instagram,
        address,
        print_footer_text,
        watermark_enabled,
        theme_color
      `
      )
      .eq("studio_id", studio.studio_id)
      .maybeSingle();

    if (settingsError) {
      setErrorMessage(settingsError.message);
      setLoading(false);
      return;
    }

    const loadedSettings = settingsData as StudioSettings | null;
    setSettings(loadedSettings);

    const resolvedLogo = await resolveStorageImageUrl(
      loadedSettings?.logo_url || null
    );

    setLogoSrc(resolvedLogo);

    const studioStaff = await getStudioStaff(studio.studio_id);
    setStaff(studioStaff);

    if (!ticketId) {
      setErrorMessage("Bilet bulunamadı.");
      setLoading(false);
      return;
    }

    const { data: ticketData, error: ticketError } = await supabase
  .from("tickets")
  .select("*")
  .eq("id", ticketId)
  .eq("studio_id", studio.studio_id)
  .maybeSingle();

if (ticketError) {
  setErrorMessage(ticketError.message);
  setLoading(false);
  return;
}

if (!ticketData) {
  setErrorMessage("Bilet bulunamadı.");
  setLoading(false);
  return;
}

setTicket(ticketData);
setLoading(false);
  }

  const designerName = useMemo(() => {
    const designerId =
      getValue(ticket, ["designer_member_id", "designer_id"]) || null;

    const directName = getValue(ticket, [
      "designer_name",
      "tasarimci_name",
      "designer_full_name",
    ]);

    if (directName) return String(directName);

    const foundMember = staff.find(
      (member: StudioStaffMember) => member.id === designerId
    );

    return foundMember?.full_name || "-";
  }, [ticket, staff]);

  const artistName = useMemo(() => {
    const artistId = getValue(ticket, ["artist_member_id", "artist_id"]) || null;

    const directName = getValue(ticket, [
      "artist_name",
      "dovmeci_name",
      "artist_full_name",
    ]);

    if (directName) return String(directName);

    const foundMember = staff.find(
      (member: StudioStaffMember) => member.id === artistId
    );

    return foundMember?.full_name || "-";
  }, [ticket, staff]);

  const printData = useMemo(() => {
    const customerName = getText(ticket, [
      "customer_name",
      "customer_full_name",
      "client_name",
      "name",
      "isim",
    ]);

    const customerSurname = getText(
      ticket,
      ["customer_surname", "surname", "soyisim"],
      "-"
    );

    const phone = getText(ticket, [
      "customer_phone",
      "phone",
      "telephone",
      "iletisim",
    ]);

    const appointmentDate = getText(ticket, [
      "appointment_date",
      "tattoo_date",
      "ticket_date",
      "date",
      "randevu_tarihi",
      "yapilacagi_tarih",
    ]);

    const appointmentTime = getText(ticket, [
      "appointment_time",
      "tattoo_time",
      "time",
      "saat",
    ]);

    const totalPrice = getNumber(ticket, [
      "total_price",
      "price",
      "fiyat",
      "toplam_fiyat",
    ]);

    const paidTotal = getNumber(ticket, [
      "paid_total",
      "deposit",
      "kapora",
      "payment_total",
      "odenen",
    ]);

    const remainingTotal =
      getValue(ticket, ["remaining_total", "rest", "kalan"]) !== null
        ? getNumber(ticket, ["remaining_total", "rest", "kalan"])
        : Math.max(totalPrice - paidTotal, 0);

    const source = normalizeSource(
      getText(ticket, ["source", "customer_source", "kaynak"], "-")
    );

    const status = normalizeStatus(
      getText(ticket, ["status", "durum"], "bekliyor")
    );

    const ticketCode = getText(
      ticket,
      ["ticket_code", "code", "reservation_code", "id"],
      "-"
    );

    return {
      customerName,
      customerSurname,
      phone,
      appointmentDate,
      appointmentTime,
      totalPrice,
      paidTotal,
      remainingTotal,
      source,
      status,
      ticketCode,
    };
  }, [ticket]);

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          Çıktı hazırlanıyor...
        </div>
      </main>
    );
  }

  if (!currentStudio) {
    return null;
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
          {errorMessage}
        </div>
      </main>
    );
  }

  if (!ticket) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          Bilet bulunamadı.
        </div>
      </main>
    );
  }

  const studioName =
    settings?.studio_name || currentStudio.studio_name || "Tattoo Panel";

  const footerText =
    settings?.print_footer_text ||
    [
      settings?.address,
      settings?.phone ? `+90 ${settings.phone}` : "",
      settings?.instagram,
    ]
      .filter(Boolean)
      .join(" • ");

  const showWatermark = settings?.watermark_enabled ?? true;

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        html,
        body {
          background: #111111;
        }

        @media print {
  html,
  body {
    width: 210mm !important;
    height: 297mm !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    background: white !important;
  }

  .no-print {
    display: none !important;
  }

  .print-root {
    width: 210mm !important;
    height: 297mm !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    background: white !important;
  }

  .print-page {
    width: 210mm !important;
    height: 297mm !important;
    margin: 0 !important;
    box-shadow: none !important;
    border: none !important;
    overflow: hidden !important;
    page-break-after: avoid !important;
    break-after: avoid !important;
  }

  .print-color {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
      `}</style>

      <main className="print-root min-h-screen bg-neutral-950 px-4 py-8 text-neutral-950">
        <div className="no-print mx-auto mb-4 flex max-w-[794px] items-center justify-between text-white">
          <button
            type="button"
            onClick={() => router.push(getPanelPathByRole(currentStudio.role))}
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-white/10 hover:text-white"
          >
            Panele Dön
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-2xl bg-yellow-400 px-5 py-2 text-sm font-black text-neutral-950 transition hover:bg-yellow-300"
          >
            Çıktı Al
          </button>
        </div>

        <section className="print-page print-color relative mx-auto h-[1123px] w-[794px] overflow-hidden bg-white px-[40px] py-[48px] shadow-2xl">
          {showWatermark && logoSrc ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt=""
                className="max-h-[300px] max-w-[360px] object-contain opacity-[0.12]"
              />
            </div>
          ) : null}

          <header className="relative z-10 grid grid-cols-[190px_1fr_200px] items-start gap-6">
            <div className="flex justify-start">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoSrc}
                  alt={studioName}
                  className="h-[145px] w-[145px] object-contain"
                />
              ) : (
                <div className="flex h-[120px] w-[120px] items-center justify-center rounded-3xl bg-neutral-200 text-3xl font-black">
                  TP
                </div>
              )}
            </div>

            <div className="pt-2 text-center">
              <h1 className="text-[30px] font-black tracking-wide">
                RESERVATION
              </h1>
              <div className="mx-auto mt-3 h-px w-[220px] bg-black" />
            </div>

            <aside className="print-color rounded-[26px] bg-neutral-200 px-8 py-8 text-center">
              <div className="text-[11px] font-black leading-5">
                İşlem
                <br />
                Dövme
              </div>

              <div className="mt-7 text-[11px] font-black leading-5">
                Tarih
                <br />
                {formatDate(printData.appointmentDate)}
              </div>

              <div className="mt-7 text-[11px] font-black leading-5">
                Sanatçı
                <br />
                {artistName}
              </div>

              <div className="mt-7 text-[11px] font-black leading-5">
                ID
                <br />
                {String(printData.ticketCode).slice(0, 12).toUpperCase()}
              </div>
            </aside>
          </header>

          <section className="absolute left-[40px] top-[265px] z-10 w-[440px]">
  <div className="text-[13.5px] font-black leading-[26px]">
    <div className="grid grid-cols-[105px_1fr]">
      <span>İsim:</span>
      <span>{printData.customerName}</span>
    </div>

    <div className="grid grid-cols-[105px_1fr]">
      <span>Soyisim:</span>
      <span>{printData.customerSurname}</span>
    </div>

    <div className="grid grid-cols-[105px_1fr]">
      <span>Tarih:</span>
      <span>{formatShortDate(printData.appointmentDate)}</span>
    </div>

    <div className="grid grid-cols-[105px_1fr]">
      <span>Saat:</span>
      <span>{printData.appointmentTime}</span>
    </div>

    <div className="grid grid-cols-[105px_1fr]">
      <span>İletişim:</span>
      <span>{printData.phone}</span>
    </div>

    <div className="grid grid-cols-[105px_1fr]">
      <span>Fiyat:</span>
      <span>{formatCurrency(printData.totalPrice)}</span>
    </div>

    <div className="grid grid-cols-[105px_1fr]">
      <span>Depozito:</span>
      <span>{formatCurrency(printData.paidTotal)}</span>
    </div>

    <div className="grid grid-cols-[105px_1fr]">
      <span>Rest:</span>
      <span>{formatCurrency(printData.remainingTotal)}</span>
    </div>

    <div className="grid grid-cols-[105px_1fr]">
      <span>Tasarımcı:</span>
      <span>{designerName}</span>
    </div>

    <div className="grid grid-cols-[105px_1fr]">
      <span>Kaynak:</span>
      <span>{printData.source}</span>
    </div>
  </div>
</section>

          <section className="absolute left-[40px] right-[40px] top-[750px] z-10 text-[9.4px] font-semibold leading-[14.5px] text-black">
            <p>
              <strong>1. Eser;</strong> yaptıran; deri ve dermatit enfeksiyonları,
              diyabet, ateş ve ağır somatik hastalıklar, akne veya deri
              döküntüleri, hamilelik, alerjik reaksiyonlar, epilepsi, kalp
              rahatsızlıkları gibi dövme veya piercing yaptırmasına engel teşkil
              edebilecek bir rahatsızlığı olmadığını; hamile veya emzirme
              döneminde olmadığını kabul ve beyan eder.
            </p>

            <p className="mt-5">
              <strong>2. Eser;</strong> yaptıran; işbu iş ile taraflar arasında
              eserin yapımı için belirlenen tarihteki randevusunu tamamen iptal
              etmesi veya randevu saatinde habersiz olarak stüdyoya gelmemesi
              halinde ödemiş olduğu depozito tutarını iade edemeyeceğini kabul ve
              taahhüt eder.
            </p>

            <p className="mt-5">
              <strong>3. Eser;</strong> yaptıran; eserin fotoğraf, video ve kayıt
              görüntülerinin alınabileceğini; bu görüntülerin stüdyonun sosyal
              medya hesaplarında, web sitesinde ve tanıtım çalışmalarında
              kullanılabileceğini; kişisel verilerinin ilgili mevzuat kapsamında
              işlenmesine açık rıza verdiğini kabul eder.
            </p>
          </section>

          <section className="absolute right-[70px] top-[945px] z-10">
  <div className="w-[180px] text-center">
    <div className="text-[13px] font-black">İMZA</div>
    <div className="mt-[105px] border-b border-black" />
  </div>
</section>

          <footer className="absolute bottom-[24px] left-[40px] right-[40px] z-10 text-center text-[8.5px] text-black">
            {footerText}
          </footer>
        </section>
      </main>
    </>
  );
}