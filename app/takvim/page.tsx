"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import {
  CurrentStudio,
  getCurrentStudio,
  getPanelPathByRole,
} from "../../lib/saas/studio";

type TicketStatus = "bekliyor" | "yapildi" | "iptal";
type FilterStatus = "all" | TicketStatus;

type CalendarTicket = {
  id: string;
  bilet_no: string;
  randevu_tarihi: string;
  randevu_saati: string | null;
  durum: TicketStatus;
  garanti_kapsaminda: boolean;
  dovme_gorseli_url: string | null;
  tasarimci_id: string | null;
  dovmeci_id: string | null;
  musteri_ad_soyad: string;
  musteri_telefon: string | null;
  musteri_kaynagi: string | null;
  tasarimci: {
    full_name: string;
    email: string | null;
  } | null;
  dovmeci: {
    full_name: string;
    email: string | null;
  } | null;
  refresh_count: number;
  created_at: string;
};

type TakvimTicketRow = {
  ticket_id: string;
  ticket_no: string;
  studio_id: string;
  customer_name: string;
  customer_phone: string | null;
  source: "kapi_musterisi" | "sosyal_medya" | null;
  tattoo_date: string;
  appointment_time: string | null;
  status: TicketStatus;
  has_guarantee: boolean;
  image_url: string | null;
  designer_member_id: string | null;
  designer_name: string | null;
  designer_email: string | null;
  artist_member_id: string | null;
  artist_name: string | null;
  artist_email: string | null;
  refresh_count: number | null;
  created_at: string;
};

function formatMonthInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function todayKey() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateKeyFromValue(value: string) {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatTime(value: string | null) {
  if (!value) return "Saat yok";
  return value.slice(0, 5);
}

function formatDateHuman(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function monthTitle(value: string) {
  const [year, month] = value.split("-").map(Number);

  return new Date(year, month - 1, 1).toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });
}

function durumEtiketi(durum: TicketStatus) {
  if (durum === "bekliyor") return "Bekliyor";
  if (durum === "yapildi") return "Yapıldı";
  if (durum === "iptal") return "İptal";
  return durum;
}

function durumClass(durum: TicketStatus) {
  if (durum === "bekliyor") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
  }

  if (durum === "yapildi") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }

  return "border-red-500/30 bg-red-500/10 text-red-200";
}

function kaynakEtiketi(value: CalendarTicket["musteri_kaynagi"]) {
  if (value === "kapi_musterisi") return "Kapı müşterisi";
  if (value === "sosyal_medya") return "Sosyal medya";
  return "Kaynak belirtilmedi";
}

function roleLabel(role: CurrentStudio["role"]) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "designer") return "Tasarımcı";
  if (role === "artist") return "Dövmeci";
  return role;
}

function createMonthDays(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const days: (Date | null)[] = [];

  const mondayOffset = (firstDay.getDay() + 6) % 7;

  for (let i = 0; i < mondayOffset; i++) {
    days.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(new Date(year, month - 1, day));
  }

  return days;
}

function getMonthRange(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 1);
  const end = dateKeyFromDate(endDate);

  return { start, end };
}

export default function CalendarPage() {
  const router = useRouter();

  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [tickets, setTickets] = useState<CalendarTicket[]>([]);

  const [monthValue, setMonthValue] = useState(formatMonthInput(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const currentToday = todayKey();

    if (currentToday.startsWith(monthValue)) {
      setSelectedDate(currentToday);
    } else {
      setSelectedDate(`${monthValue}-01`);
    }

    loadData(monthValue);
  }, [monthValue]);

  async function loadData(activeMonth: string) {
    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session?.user) {
      router.push("/login");
      return;
    }

    const currentStudio = await getCurrentStudio();

    if (!currentStudio) {
      await supabase.auth.signOut();
      router.push("/login");
      return;
    }

    if (currentStudio.role === "artist") {
      router.push(getPanelPathByRole(currentStudio.role));
      return;
    }

    setStudio(currentStudio);

    const { start, end } = getMonthRange(activeMonth);

    const { data, error } = await supabase.rpc("get_takvim_page_tickets", {
      target_studio_id: currentStudio.studio_id,
      p_start_date: start,
      p_end_date: end,
    });

    if (error) {
      console.error(error);
      setErrorMessage(error.message);
      setTickets([]);
      setLoading(false);
      return;
    }

    const cleanTickets: CalendarTicket[] = ((data || []) as TakvimTicketRow[])
      .map((ticket) => ({
        id: ticket.ticket_id,
        bilet_no: ticket.ticket_no,
        randevu_tarihi: ticket.tattoo_date,
        randevu_saati: ticket.appointment_time,
        durum: ticket.status,
        garanti_kapsaminda: ticket.has_guarantee,
        dovme_gorseli_url: ticket.image_url,
        tasarimci_id: ticket.designer_member_id,
        dovmeci_id: ticket.artist_member_id,
        musteri_ad_soyad: ticket.customer_name,
        musteri_telefon: ticket.customer_phone,
        musteri_kaynagi: ticket.source,
        tasarimci: ticket.designer_name
          ? {
              full_name: ticket.designer_name,
              email: ticket.designer_email,
            }
          : null,
        dovmeci: ticket.artist_name
          ? {
              full_name: ticket.artist_name,
              email: ticket.artist_email,
            }
          : null,
        refresh_count: Number(ticket.refresh_count || 0),
        created_at: ticket.created_at,
      }))
      .sort((a, b) => {
        const aValue = `${a.randevu_tarihi} ${a.randevu_saati || "99:99"}`;
        const bValue = `${b.randevu_tarihi} ${b.randevu_saati || "99:99"}`;
        return aValue.localeCompare(bValue);
      });

    setTickets(cleanTickets);
    setLoading(false);
  }

  function changeMonth(direction: number) {
    const [year, month] = monthValue.split("-").map(Number);
    const nextDate = new Date(year, month - 1 + direction, 1);

    setMonthValue(formatMonthInput(nextDate));
  }

  const filteredTickets = useMemo(() => {
    if (statusFilter === "all") return tickets;

    return tickets.filter((ticket) => ticket.durum === statusFilter);
  }, [tickets, statusFilter]);

  const ticketsByDay = useMemo(() => {
    const grouped: Record<string, CalendarTicket[]> = {};

    filteredTickets.forEach((ticket) => {
      const key = dateKeyFromValue(ticket.randevu_tarihi);

      if (!grouped[key]) {
        grouped[key] = [];
      }

      grouped[key].push(ticket);
    });

    return grouped;
  }, [filteredTickets]);

  const monthDays = useMemo(() => {
    return createMonthDays(monthValue);
  }, [monthValue]);

  const selectedDayTickets = ticketsByDay[selectedDate] || [];

  const bekleyenCount = tickets.filter((ticket) => ticket.durum === "bekliyor").length;
  const yapilanCount = tickets.filter((ticket) => ticket.durum === "yapildi").length;
  const iptalCount = tickets.filter((ticket) => ticket.durum === "iptal").length;

  return (
    <main className="elegant-page min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
              Aylık İş Takibi
            </p>

            <h1 className="text-3xl md:text-5xl font-black mt-4">
              Takvim
            </h1>

            <p className="text-zinc-500 mt-2">
              Bu ekranda aylık randevu ve iş akışını takip edebilirsin.
            </p>

            {studio && (
              <p className="text-zinc-600 text-xs md:text-sm mt-2">
                Aktif stüdyo: {studio.studio_name} / {studio.full_name} /{" "}
                {roleLabel(studio.role)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-3xl elegant-card-soft p-4">
              <p className="text-xs text-zinc-500">Toplam İş</p>
              <p className="text-2xl font-black mt-1">{tickets.length}</p>
            </div>

            <div className="rounded-3xl elegant-card-soft p-4">
              <p className="text-xs text-zinc-500">Bekliyor</p>
              <p className="text-2xl font-black mt-1 text-yellow-200">
                {bekleyenCount}
              </p>
            </div>

            <div className="rounded-3xl elegant-card-soft p-4">
              <p className="text-xs text-zinc-500">Yapıldı</p>
              <p className="text-2xl font-black mt-1 text-emerald-200">
                {yapilanCount}
              </p>
            </div>

            <div className="rounded-3xl elegant-card-soft p-4">
              <p className="text-xs text-zinc-500">İptal</p>
              <p className="text-2xl font-black mt-1 text-red-200">
                {iptalCount}
              </p>
            </div>
          </div>
        </div>

        <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
              >
                Önceki Ay
              </button>

              <input
                type="month"
                value={monthValue}
                onChange={(event) => setMonthValue(event.target.value)}
                className="rounded-2xl elegant-input px-5 py-3 text-white"
              />

              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
              >
                Sonraki Ay
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setMonthValue(formatMonthInput(now));
                  setSelectedDate(todayKey());
                }}
                className="rounded-2xl elegant-button-gold px-5 py-3 font-black"
              >
                Bugün
              </button>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as FilterStatus)
                }
                className="rounded-2xl elegant-input px-5 py-3 text-white"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="bekliyor">Bekliyor</option>
                <option value="yapildi">Yapıldı</option>
                <option value="iptal">İptal</option>
              </select>
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-black mt-8 capitalize">
            {monthTitle(monthValue)}
          </h2>

          {errorMessage && (
            <div className="rounded-3xl bg-red-500/10 border border-red-500/30 p-4 mt-5">
              <p className="text-red-200 font-semibold">Hata</p>
              <p className="text-red-100/80 text-sm mt-1">{errorMessage}</p>
            </div>
          )}

          {loading ? (
            <div className="rounded-3xl elegant-card-soft p-5 mt-5">
              <p className="text-zinc-500">Takvim yükleniyor...</p>
            </div>
          ) : (
            <div className="mt-6">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map(
                  (day) => (
                    <div
                      key={day}
                      className="text-center text-xs font-bold text-zinc-500 py-2"
                    >
                      {day}
                    </div>
                  )
                )}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {monthDays.map((day, index) => {
                  if (!day) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="min-h-24 rounded-3xl border border-white/5 bg-white/[0.02]"
                      />
                    );
                  }

                  const key = dateKeyFromDate(day);
                  const dayTickets = ticketsByDay[key] || [];
                  const isToday = key === todayKey();
                  const isSelected = key === selectedDate;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDate(key)}
                      className={
                        isSelected
                          ? "min-h-28 rounded-3xl border border-yellow-500/40 bg-yellow-500/10 p-2 text-left transition"
                          : isToday
                          ? "min-h-28 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-2 text-left transition hover:bg-white/10"
                          : "min-h-28 rounded-3xl border border-white/10 bg-white/5 p-2 text-left transition hover:bg-white/10"
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black">
                          {day.getDate()}
                        </span>

                        {dayTickets.length > 0 && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-zinc-200">
                            {dayTickets.length}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 space-y-1">
                        {dayTickets.slice(0, 3).map((ticket) => {
                          const tattooer = ticket.dovmeci;

                          return (
                            <div
                              key={ticket.id}
                              className={`truncate rounded-xl border px-2 py-1 text-[11px] ${durumClass(
                                ticket.durum
                              )}`}
                            >
                              {formatTime(ticket.randevu_saati)} ·{" "}
                              {ticket.musteri_ad_soyad ||
                                tattooer?.full_name ||
                                `#${ticket.bilet_no}`}
                            </div>
                          );
                        })}

                        {dayTickets.length > 3 && (
                          <p className="text-[11px] text-zinc-500 px-1">
                            +{dayTickets.length - 3} iş daha
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[2rem] elegant-card p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
            <div>
              <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
                Günlük Liste
              </p>

              <h2 className="text-xl md:text-2xl font-black mt-4">
                {formatDateHuman(selectedDate)}
              </h2>

              <p className="text-zinc-500 text-sm mt-2">
                Seçili güne ait iş ve randevu listesi.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-300">
              {selectedDayTickets.length} iş
            </div>
          </div>

          {selectedDayTickets.length === 0 ? (
            <div className="rounded-3xl elegant-card-soft p-5">
              <p className="text-zinc-500 text-sm">
                Bu gün için kayıtlı iş yok.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDayTickets.map((ticket) => {
                const designer = ticket.tasarimci;
                const tattooer = ticket.dovmeci;

                return (
                  <a
                    key={ticket.id}
                    href={`/biletler/${ticket.id}`}
                    className="block rounded-3xl elegant-card-soft p-4 md:p-5 hover:bg-white/10 transition"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1 text-sm font-black">
                            {formatTime(ticket.randevu_saati)}
                          </span>

                          <span
                            className={`rounded-2xl border px-3 py-1 text-sm font-semibold ${durumClass(
                              ticket.durum
                            )}`}
                          >
                            {durumEtiketi(ticket.durum)}
                          </span>

                          {ticket.garanti_kapsaminda && (
                            <span className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-sm font-semibold text-yellow-200">
                              Garanti
                            </span>
                          )}

                          {ticket.refresh_count > 0 && (
                            <span className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sm font-semibold text-sky-200">
                              Refresh: {ticket.refresh_count}
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg md:text-xl font-black mt-3">
                          {ticket.musteri_ad_soyad || `Bilet #${ticket.bilet_no}`}
                        </h3>

                        <p className="text-zinc-500 text-sm mt-1">
                          Dövmeci: {tattooer?.full_name || "-"} · Tasarımcı:{" "}
                          {designer?.full_name || "-"}
                        </p>

                        <p className="text-zinc-600 text-xs mt-1">
                          {kaynakEtiketi(ticket.musteri_kaynagi)}
                          {ticket.musteri_telefon
                            ? ` · Tel: ${ticket.musteri_telefon}`
                            : ""}
                        </p>
                      </div>

                      <div className="text-sm text-zinc-500">
                        #{ticket.bilet_no}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
