"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";
import {
  CurrentStudio,
  getCurrentStudio,
  getPanelPathByRole,
} from "../../../../lib/saas/studio";

type SourceType = "kapi_musterisi" | "sosyal_medya";
type TicketStatus = "bekliyor" | "yapildi" | "iptal";

type Payment = {
  id: string;
  odeme_tarihi: string;
  odeme_tutari: number;
  odeme_yontemi: "nakit" | "kart" | null;
};

type TicketDetailRow = {
  ticket_id: string;
  ticket_no: string;
  studio_id: string;
  customer_name: string;
  customer_phone: string | null;
  source: SourceType;
  tattoo_date: string;
  appointment_time: string | null;
  status: TicketStatus;
  has_guarantee: boolean;
  created_at: string;
  designer_member_id: string | null;
  designer_name: string | null;
  designer_email: string | null;
  artist_member_id: string | null;
  artist_name: string | null;
  artist_email: string | null;
  price: number;
  image_url: string | null;
  designer_note: string | null;
  payments: Payment[] | null;
  refreshes: unknown[] | null;
  price_history: unknown[] | null;
};

type StudioSettings = {
  studio_id: string;
  logo_url: string | null;
  watermark_enabled: boolean;
  phone: string | null;
  instagram: string | null;
  address: string | null;
  print_footer_text: string | null;
};

function formatDateNumeric(value?: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateLong(value?: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 5);
}

function formatPrice(value?: number | null) {
  return `${Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}₺`;
}

function sourceLabel(source?: SourceType | null) {
  if (source === "kapi_musterisi") return "Kapı müşterisi";
  if (source === "sosyal_medya") return "Sosyal medya";
  return "-";
}

function splitCustomerName(fullName?: string | null) {
  const cleanName = (fullName || "").trim().replace(/\s+/g, " ");
  if (!cleanName) return { firstName: "-", lastName: "-" };

  const parts = cleanName.split(" ");

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "-" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

export default function BiletPrintPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params.id;
  const ticketId = Array.isArray(rawId) ? rawId[0] : String(rawId || "");

  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [ticket, setTicket] = useState<TicketDetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadPrintData() {
      setLoading(true);
      setErrorMessage("");

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const currentStudio = await getCurrentStudio();

      if (!currentStudio) {
        router.replace("/login");
        return;
      }

      if (!["owner", "admin", "designer"].includes(currentStudio.role)) {
        router.replace(getPanelPathByRole(currentStudio.role));
        return;
      }

      setStudio(currentStudio);

      const { data: settingsData } = await supabase
        .from("studio_settings")
        .select(
          "studio_id, logo_url, watermark_enabled, phone, instagram, address, print_footer_text"
        )
        .eq("studio_id", currentStudio.studio_id)
        .maybeSingle();

      setSettings((settingsData || null) as StudioSettings | null);

      const { data, error } = await supabase.rpc("get_bilet_detail_page", {
        target_studio_id: currentStudio.studio_id,
        target_ticket_id: ticketId,
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      const firstRow = Array.isArray(data) ? data[0] : null;

      if (!firstRow) {
        setErrorMessage("Bilet bulunamadı veya bu bilete erişim yetkin yok.");
        setLoading(false);
        return;
      }

      setTicket(firstRow as TicketDetailRow);
      setLoading(false);
    }

    loadPrintData();
  }, [router, ticketId]);

  const paymentTotal = useMemo(() => {
    return (ticket?.payments || []).reduce((total, payment) => {
      return total + Number(payment.odeme_tutari || 0);
    }, 0);
  }, [ticket]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-black">Çıktı hazırlanıyor...</h1>
          <p className="text-zinc-400 mt-2">
            Bilet ve stüdyo bilgileri yükleniyor.
          </p>
        </div>
      </main>
    );
  }

  if (errorMessage || !ticket || !studio) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 max-w-xl">
          <h1 className="text-2xl font-black text-red-100">Çıktı açılamadı</h1>
          <p className="text-red-100/80 mt-2">
            {errorMessage || "Bilet bulunamadı."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/biletler")}
            className="mt-5 rounded-2xl bg-white px-5 py-3 font-bold text-black"
          >
            Bilet listesine dön
          </button>
        </div>
      </main>
    );
  }

  const logoUrl = settings?.logo_url || null;
  const watermarkUrl = settings?.watermark_enabled ? logoUrl : null;
  const footerText = settings?.print_footer_text || "";
  const contactItems = [settings?.address, footerText, settings?.phone, settings?.instagram]
    .filter(Boolean)
    .join("  •  ");

  const remainingAmount = Number(ticket.price || 0) - paymentTotal;
  const { firstName, lastName } = splitCustomerName(ticket.customer_name);

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-4 md:p-8 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Bilet Çıktısı</h1>
          <p className="text-sm text-zinc-400 mt-1">{ticket.ticket_no}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push(`/biletler/${ticket.ticket_id}`)}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white hover:bg-white/10"
          >
            Detaya Dön
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-2xl bg-white px-5 py-3 font-black text-black"
          >
            Çıktı Al
          </button>
        </div>
      </div>

      <section className="print-area mx-auto bg-white text-black shadow-2xl print:shadow-none">
        <div className="a4-sheet">
          {watermarkUrl && (
            <img src={watermarkUrl} alt="Watermark" className="watermark" />
          )}

          <header className="reservation-header">
            <div className="logo-area">
              {logoUrl ? (
                <img src={logoUrl} alt={studio.studio_name} className="studio-logo" />
              ) : (
                <div className="logo-placeholder">{studio.studio_name}</div>
              )}
            </div>

            <div className="title-area">
              <h1>RESERVATION</h1>
              <div className="title-line" />
            </div>

            <aside className="summary-card">
              <SummaryItem label="İşlem" value="Dövme" />
              <SummaryItem label="Tarih" value={formatDateLong(ticket.tattoo_date)} />
              <SummaryItem
                label="Sanatçı"
                value={ticket.artist_name || "Sonradan atanacak"}
              />
              <SummaryItem label="ID" value={ticket.ticket_no} />
            </aside>
          </header>

          <section className="reservation-info">
            <InfoRow label="İsim:" value={firstName} />
            <InfoRow label="Soyisim:" value={lastName} />
            <InfoRow label="Tarih:" value={formatDateNumeric(ticket.tattoo_date)} />
            <InfoRow label="Saat:" value={formatTime(ticket.appointment_time)} />
            <InfoRow label="İletişim:" value={ticket.customer_phone || "-"} />
            <InfoRow label="Fiyat:" value={formatPrice(ticket.price)} />
            <InfoRow label="Depozito:" value={formatPrice(paymentTotal)} />
            <InfoRow label="Rest:" value={formatPrice(remainingAmount)} />
            <InfoRow label="Tasarımcı:" value={ticket.designer_name || "-"} />
            <InfoRow label="Kaynak:" value={sourceLabel(ticket.source)} />
          </section>

          <section className="agreement-text">
            <p>
              <strong>1.</strong> Eseri yaptıran; deri ve dermatit enfeksiyonları,
              diyabet, ateş ve ağır somatik hastalıklar, akne veya deri döküntüleri,
              hamilelik, alerjik reaksiyonlar, epilepsi, kalp rahatsızlıkları gibi dövme
              veya piercing yaptırmasına engel teşkil edebilecek bir rahatsızlığı
              olmadığını; hamile veya emzirme döneminde olmadığını kabul ve beyan eder.
            </p>

            <p>
              <strong>2.</strong> Eseri yaptıran; işbu iş ile taraflar arasında eserin
              yapımı için belirlenen tarihteki randevusunu tamamen iptal etmesi veya
              randevu saatinde habersiz olarak stüdyoya gelmemesi halinde ödemiş olduğu
              depozito tutarını iade edemeyeceğini kabul ve taahhüt eder.
            </p>

            <p>
              <strong>3.</strong> Eseri yaptıran; eserin fotoğraf, video ve kayıt
              görüntülerinin alınabileceğini; bu görüntülerin stüdyonun sosyal medya
              hesaplarında, web sitesinde ve tanıtım çalışmalarında kullanılabileceğini;
              kişisel verilerinin ilgili mevzuat kapsamında işlenmesine açık rıza
              verdiğini kabul eder.
            </p>
          </section>

          <section className="signature-wrap">
            <div className="signature-title">İMZA</div>
            <div className="signature-line" />
          </section>

          <footer className="reservation-footer">
            {contactItems || studio.studio_name}
          </footer>
        </div>
      </section>

      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          body {
            margin: 0 !important;
            background: white !important;
          }

          body * {
            visibility: hidden;
          }

          .print-area,
          .print-area * {
            visibility: visible;
          }

          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
          }

          .no-print {
            display: none !important;
          }
        }

        .print-area {
          width: 210mm;
          min-height: 297mm;
        }

        .a4-sheet {
          position: relative;
          width: 210mm;
          min-height: 297mm;
          padding: 13mm 9mm 8mm;
          box-sizing: border-box;
          overflow: hidden;
          background: white;
          color: #000;
          font-family: Arial, Helvetica, sans-serif;
        }

        .watermark {
          position: absolute;
          left: 50%;
          top: 48%;
          width: 96mm;
          max-height: 112mm;
          transform: translate(-50%, -50%);
          object-fit: contain;
          opacity: 0.12;
          z-index: 0;
          pointer-events: none;
        }

        .reservation-header,
        .reservation-info,
        .agreement-text,
        .signature-wrap,
        .reservation-footer {
          position: relative;
          z-index: 1;
        }

        .reservation-header {
          display: grid;
          grid-template-columns: 54mm 1fr 54mm;
          column-gap: 7mm;
          align-items: start;
          min-height: 78mm;
        }

        .logo-area {
          display: flex;
          justify-content: flex-start;
          align-items: flex-start;
        }

        .studio-logo {
          width: 48mm;
          max-height: 38mm;
          object-fit: contain;
        }

        .logo-placeholder {
          width: 48mm;
          min-height: 32mm;
          display: grid;
          place-items: center;
          border: 1px solid #ddd;
          font-size: 13pt;
          font-weight: 900;
          text-align: center;
          padding: 2mm;
        }

        .title-area {
          text-align: center;
          padding-top: 3mm;
        }

        .title-area h1 {
          margin: 0;
          font-size: 20pt;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 0.01em;
        }

        .title-line {
          width: 58mm;
          height: 0.35mm;
          background: #000;
          margin: 5mm auto 0;
        }

        .summary-card {
          width: 51mm;
          min-height: 74mm;
          box-sizing: border-box;
          border-radius: 7mm;
          background: #e4e4e4;
          padding: 8mm 5mm 6mm;
          text-align: center;
        }

        .summary-item {
          margin-bottom: 5mm;
        }

        .summary-label {
          font-size: 8pt;
          font-weight: 900;
          margin-bottom: 1.5mm;
        }

        .summary-value {
          font-size: 8pt;
          font-weight: 800;
          line-height: 1.3;
          word-break: break-word;
        }

        .reservation-info {
          width: 74mm;
          margin-top: -16mm;
          margin-left: 0;
        }

        .info-row {
          display: grid;
          grid-template-columns: 29mm 1fr;
          align-items: baseline;
          min-height: 8.4mm;
          font-size: 9.2pt;
        }

        .info-label {
          font-weight: 900;
        }

        .info-value {
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .agreement-text {
          margin-top: 37mm;
          font-size: 6.8pt;
          line-height: 1.45;
        }

        .agreement-text p {
          margin: 0 0 4mm;
        }

        .agreement-text strong {
          font-weight: 900;
        }

        .signature-wrap {
          width: 48mm;
          margin-left: auto;
          margin-top: 20mm;
          text-align: center;
          font-size: 8pt;
          font-weight: 900;
        }

        .signature-title {
          margin-bottom: 11mm;
        }

        .signature-line {
          border-bottom: 0.5mm solid #000;
          height: 0;
        }

        .reservation-footer {
          position: absolute;
          left: 10mm;
          right: 10mm;
          bottom: 5.5mm;
          z-index: 1;
          text-align: center;
          font-size: 6.7pt;
          line-height: 1.35;
          color: #111;
        }
      `}</style>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <div className="summary-label">{label}</div>
      <div className="summary-value">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <div className="info-label">{label}</div>
      <div className="info-value">{value}</div>
    </div>
  );
}
