"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import {
  getCurrentStudio,
  getPanelPathByRole,
  type CurrentStudio,
} from "../../lib/saas/studio";

type ReminderTicket = {
  ticket_id: string;
  ticket_no: string;
  customer_name: string;
  customer_phone: string | null;
  tattoo_date: string;
  appointment_time: string | null;
  status: string;
  artist_name: string | null;
  designer_name: string | null;
};

const DEFAULT_TEMPLATE =
  "Merhaba {musteri}, {tarih} tarihinde saat {saat} için {studyo} dövme randevunuzu hatırlatmak isteriz. Randevunuzu teyit eder misiniz?";

function getTodayForInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function addDaysToInputDate(dateValue: string, dayCount: number) {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() + dayCount);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const cleanDate = value.slice(0, 10);
  const date = new Date(`${cleanDate}T12:00:00`);

  if (Number.isNaN(date.getTime())) return cleanDate;

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "Belirtilmedi";
  return value.slice(0, 5);
}

function normalizeWhatsAppPhone(rawPhone?: string | null) {
  if (!rawPhone) return "";

  let digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("90")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;

  return digits;
}

function fillTemplate(
  template: string,
  ticket: ReminderTicket,
  studioName: string
) {
  const replacements: Record<string, string> = {
    "{musteri}": ticket.customer_name || "Değerli müşterimiz",
    "{tarih}": formatDate(ticket.tattoo_date),
    "{saat}": formatTime(ticket.appointment_time),
    "{studyo}": studioName,
    "{dovmeci}": ticket.artist_name || "sanatçımız",
    "{bilet_no}": ticket.ticket_no || "-",
  };

  return Object.entries(replacements).reduce(
    (message, [placeholder, value]) =>
      message.split(placeholder).join(value),
    template
  );
}

function getWhatsAppUrl(
  ticket: ReminderTicket,
  template: string,
  studioName: string
) {
  const phone = normalizeWhatsAppPhone(ticket.customer_phone);
  if (!phone) return "";

  const message = fillTemplate(template, ticket, studioName);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function isSameInputDate(firstValue: string, secondValue: string) {
  return firstValue.slice(0, 10) === secondValue.slice(0, 10);
}

export default function WhatsAppHatirlatmaPage() {
  const router = useRouter();
  const today = getTodayForInput();

  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [addonEnabled, setAddonEnabled] = useState<boolean | null>(null);
  const [tickets, setTickets] = useState<ReminderTicket[]>([]);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDaysToInputDate(today, 7));
  const [searchText, setSearchText] = useState("");
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedTicketId, setCopiedTicketId] = useState<string | null>(null);

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPage() {
    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();
    const currentStudio = await getCurrentStudio();

    if (!currentStudio) {
      router.replace("/login");
      return;
    }

    if (
      currentStudio.studio_status === "suspended" ||
      currentStudio.studio_status === "cancelled"
    ) {
      router.replace("/abonelik");
      return;
    }

    if (currentStudio.role !== "owner" && currentStudio.role !== "admin") {
      router.replace(getPanelPathByRole(currentStudio.role));
      return;
    }

    setStudio(currentStudio);

    const { data: addonData, error: addonError } = await supabase.rpc(
      "has_my_addon",
      { p_addon_code: "whatsapp_reminders" }
    );

    if (addonError) {
      setErrorMessage(addonError.message);
      setAddonEnabled(false);
      setLoading(false);
      return;
    }

    const isEnabled = Boolean(addonData);
    setAddonEnabled(isEnabled);

    if (isEnabled) await loadReminderTickets();

    setLoading(false);
  }

  async function loadReminderTickets() {
    setListLoading(true);
    setErrorMessage("");

    const supabase = createClient();
    const { data, error } = await supabase.rpc(
      "get_whatsapp_reminder_tickets",
      {
        p_start_date: startDate,
        p_end_date: endDate,
      }
    );

    if (error) {
      setTickets([]);
      setErrorMessage(error.message);
      setListLoading(false);
      return;
    }

    const cleanTickets = ((data || []) as ReminderTicket[])
      .map((ticket) => ({
        ...ticket,
        customer_name: ticket.customer_name || "Müşteri",
        customer_phone: ticket.customer_phone || null,
        artist_name: ticket.artist_name || null,
        designer_name: ticket.designer_name || null,
      }))
      .sort((firstTicket, secondTicket) => {
        const firstDate = `${firstTicket.tattoo_date} ${firstTicket.appointment_time || ""}`;
        const secondDate = `${secondTicket.tattoo_date} ${secondTicket.appointment_time || ""}`;
        return firstDate.localeCompare(secondDate);
      });

    setTickets(cleanTickets);
    setListLoading(false);
  }

  function applyPreset(dayCount: number) {
    const presetStart = getTodayForInput();
    setStartDate(presetStart);
    setEndDate(addDaysToInputDate(presetStart, dayCount));
  }

  async function handleCopyMessage(ticket: ReminderTicket) {
    const studioName = studio?.studio_name || "Stüdyomuz";
    const message = fillTemplate(messageTemplate, ticket, studioName);

    try {
      await navigator.clipboard.writeText(message);
      setCopiedTicketId(ticket.ticket_id);

      window.setTimeout(() => {
        setCopiedTicketId((current) =>
          current === ticket.ticket_id ? null : current
        );
      }, 1800);
    } catch {
      setErrorMessage("Mesaj panoya kopyalanamadı.");
    }
  }

  const filteredTickets = useMemo(() => {
    const cleanSearch = searchText.trim().toLocaleLowerCase("tr-TR");
    if (!cleanSearch) return tickets;

    return tickets.filter((ticket) => {
      const searchableText = [
        ticket.customer_name,
        ticket.customer_phone,
        ticket.ticket_no,
        ticket.artist_name,
        ticket.designer_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return searchableText.includes(cleanSearch);
    });
  }, [tickets, searchText]);

  const summary = useMemo(() => {
    const todayValue = getTodayForInput();
    const tomorrowValue = addDaysToInputDate(todayValue, 1);

    return {
      totalCount: tickets.length,
      todayCount: tickets.filter((ticket) =>
        isSameInputDate(ticket.tattoo_date, todayValue)
      ).length,
      tomorrowCount: tickets.filter((ticket) =>
        isSameInputDate(ticket.tattoo_date, tomorrowValue)
      ).length,
      phoneReadyCount: tickets.filter(
        (ticket) => normalizeWhatsAppPhone(ticket.customer_phone) !== ""
      ).length,
    };
  }, [tickets]);

  if (loading) {
    return (
      <main className="min-h-screen elegant-page p-4 text-white md:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2rem] elegant-card p-6">
            <h1 className="text-2xl font-black">WhatsApp Hatırlatma yükleniyor...</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Eklenti lisansı ve yaklaşan randevular kontrol ediliyor.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (addonEnabled === false) {
    return (
      <main className="min-h-screen elegant-page p-4 text-white md:p-6">
        <div className="mx-auto max-w-4xl">
          <section className="rounded-[2rem] elegant-card p-6 md:p-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-yellow-400/30 bg-yellow-400/10 text-3xl">
              🔒
            </div>

            <p className="mt-6 inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
              Ücretli Eklenti
            </p>

            <h1 className="mt-4 text-3xl font-black md:text-4xl">
              WhatsApp Hatırlatma
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400 md:text-base">
              Yaklaşan randevuları tek ekranda gör, müşteriye özel hatırlatma mesajını hazırla ve tek tıkla WhatsApp üzerinden gönder.
            </p>

            {errorMessage ? (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {errorMessage}
              </div>
            ) : null}

            <Link
              href="/eklentiler"
              className="mt-7 inline-flex rounded-2xl elegant-button-gold px-6 py-4 font-black"
            >
              Eklenti Mağazasına Git
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const studioName = studio?.studio_name || "Stüdyomuz";

  return (
    <main className="min-h-screen elegant-page p-4 text-white md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
            Premium Eklenti
          </p>

          <h1 className="mt-4 text-3xl font-black md:text-4xl">
            WhatsApp Randevu Hatırlatma
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400 md:text-base">
            Yaklaşan randevuları listele, müşteriye özel mesajı hazırla ve WhatsApp&apos;ta tek tıkla aç.
          </p>

          <p className="mt-2 text-xs text-zinc-500">
            Bu sürüm mesajı otomatik göndermez. Gönderim senin onayınla WhatsApp ekranından yapılır ve ek API maliyeti oluşturmaz.
          </p>
        </header>

        {errorMessage ? (
          <div className="mb-6 rounded-3xl border border-red-500/30 bg-red-500/10 p-5">
            <p className="font-bold text-red-200">Hata</p>
            <p className="mt-2 text-sm text-red-100/80">{errorMessage}</p>
          </div>
        ) : null}

        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <SummaryCard title="Toplam Randevu" value={summary.totalCount} />
          <SummaryCard title="Bugün" value={summary.todayCount} />
          <SummaryCard title="Yarın" value={summary.tomorrowCount} />
          <SummaryCard title="WhatsApp Hazır" value={summary.phoneReadyCount} />
        </section>

        <section className="mb-6 rounded-[2rem] elegant-card p-4 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-black md:text-2xl">Randevu Aralığı</h2>
              <p className="mt-1 text-sm text-zinc-500">
                En fazla 62 günlük tarih aralığı kullanılabilir.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[["Bugün", 0], ["Bugün + Yarın", 1], ["7 Gün", 7], ["30 Gün", 30]].map(
                ([label, days]) => (
                  <button
                    key={String(label)}
                    type="button"
                    onClick={() => applyPreset(Number(days))}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-white/10"
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm text-zinc-400">Başlangıç Tarihi</label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">Bitiş Tarihi</label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={loadReminderTickets}
                disabled={listLoading}
                className="w-full rounded-2xl elegant-button-gold px-4 py-4 font-black disabled:opacity-50"
              >
                {listLoading ? "Randevular Getiriliyor..." : "Randevuları Getir"}
              </button>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-[2rem] elegant-card p-4 md:p-6">
          <h2 className="text-xl font-black md:text-2xl">Mesaj Şablonu</h2>

          <p className="mt-2 text-sm text-zinc-500">
            Kullanılabilir alanlar: {"{musteri}"}, {"{tarih}"}, {"{saat}"},{" "}
            {"{studyo}"}, {"{dovmeci}"}, {"{bilet_no}"}
          </p>

          <textarea
            value={messageTemplate}
            onChange={(event) => setMessageTemplate(event.target.value)}
            rows={5}
            className="mt-4 w-full rounded-2xl elegant-input px-4 py-4 text-white"
          />

          <button
            type="button"
            onClick={() => setMessageTemplate(DEFAULT_TEMPLATE)}
            className="mt-3 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-white/10"
          >
            Varsayılan Şablona Dön
          </button>
        </section>

        <section className="mb-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-black">Yaklaşan Randevular</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {filteredTickets.length} kayıt gösteriliyor.
              </p>
            </div>

            <div className="w-full md:max-w-sm">
              <label className="mb-2 block text-sm text-zinc-400">Randevu Ara</label>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Müşteri, telefon, bilet veya dövmeci..."
                className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
              />
            </div>
          </div>
        </section>

        {listLoading ? (
          <section className="rounded-[2rem] elegant-card p-6 text-zinc-400">
            Randevular yükleniyor...
          </section>
        ) : filteredTickets.length === 0 ? (
          <section className="rounded-[2rem] elegant-card p-6">
            <p className="font-bold text-white">
              Hatırlatma gönderilecek randevu bulunamadı.
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              Seçili tarih aralığında bekleyen ve telefon numarası kayıtlı bir randevu yok.
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            {filteredTickets.map((ticket) => {
              const whatsappUrl = getWhatsAppUrl(ticket, messageTemplate, studioName);
              const messagePreview = fillTemplate(messageTemplate, ticket, studioName);

              return (
                <article
                  key={ticket.ticket_id}
                  className="rounded-[2rem] elegant-card p-4 md:p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black">{ticket.customer_name}</h3>

                        <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-bold text-yellow-200">
                          Bekliyor
                        </span>

                        {isSameInputDate(ticket.tattoo_date, getTodayForInput()) ? (
                          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-200">
                            BUGÜN
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <InfoCard
                          title="Randevu"
                          value={`${formatDate(ticket.tattoo_date)} / ${formatTime(ticket.appointment_time)}`}
                        />
                        <InfoCard title="Telefon" value={ticket.customer_phone || "-"} />
                        <InfoCard title="Dövmeci" value={ticket.artist_name || "-"} />
                        <InfoCard title="Bilet" value={ticket.ticket_no || "-"} />
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-bold text-zinc-500">Mesaj Önizlemesi</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                          {messagePreview}
                        </p>
                      </div>
                    </div>

                    <div className="grid shrink-0 gap-3 lg:w-56">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(ticket)}
                        className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 hover:bg-white/10"
                      >
                        {copiedTicketId === ticket.ticket_id ? "Kopyalandı ✓" : "Mesajı Kopyala"}
                      </button>

                      {whatsappUrl ? (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl bg-emerald-500 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-emerald-400"
                        >
                          WhatsApp&apos;ta Aç
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="cursor-not-allowed rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 opacity-70"
                        >
                          Telefon Geçersiz
                        </button>
                      )}

                      <Link
                        href={`/biletler/${ticket.ticket_id}`}
                        className="rounded-2xl border border-yellow-400/20 px-4 py-3 text-center text-sm font-bold text-yellow-200 hover:bg-yellow-400/10"
                      >
                        Bileti Aç
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl elegant-card p-4 md:p-5">
      <p className="text-xs text-zinc-400 md:text-sm">{title}</p>
      <p className="mt-2 text-2xl font-black md:text-3xl">{value}</p>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl elegant-card-soft p-4">
      <p className="text-xs text-zinc-500">{title}</p>
      <p className="mt-1 break-words text-sm font-bold text-white">{value}</p>
    </div>
  );
}
