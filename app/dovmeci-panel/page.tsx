"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TicketImagePreview from "../../components/TicketImagePreview";
import { createClient } from "../../lib/supabase/client";
import {
  getCurrentStudio,
  getPanelPathByRole,
  type CurrentStudio,
} from "../../lib/saas/studio";

type TicketRow = Record<string, unknown>;

type UiTicket = TicketRow & {
  _resolved_image?: string | null;
};

type StudioSettings = {
  artist_can_see_completed_price: boolean | null;
};

const MONTH_NAMES = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function getValue(row: TicketRow | null | undefined, keys: string[]) {
  if (!row) return null;

  for (const key of keys) {
    const value = row[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function getText(
  row: TicketRow | null | undefined,
  keys: string[],
  fallback = "-"
) {
  const value = getValue(row, keys);

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function getNumber(row: TicketRow | null | undefined, keys: string[]) {
  const value = getValue(row, keys);
  const numberValue = Number(value || 0);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getTicketId(ticket: TicketRow) {
  return getText(ticket, ["ticket_id", "id"], "");
}

function getTicketDate(ticket: TicketRow) {
  return getText(
    ticket,
    [
      "appointment_date",
      "tattoo_date",
      "scheduled_date",
      "ticket_date",
      "work_date",
      "date",
      "randevu_tarihi",
      "yapilacagi_tarih",
    ],
    ""
  ).substring(0, 10);
}

function getTicketTime(ticket: TicketRow) {
  return getText(
    ticket,
    [
      "appointment_time",
      "tattoo_time",
      "scheduled_time",
      "work_time",
      "time",
      "saat",
    ],
    "-"
  );
}

function getTicketStatus(ticket: TicketRow) {
  return getText(ticket, ["status", "ticket_status", "durum"], "bekliyor");
}

function getTicketImage(ticket: TicketRow | null | undefined) {
  if (!ticket) return null;

  const resolvedImage = getValue(ticket, ["_resolved_image"]);

  if (resolvedImage) {
    return String(resolvedImage);
  }

  const image = getValue(ticket, [
    "image_url",
    "tattoo_image_url",
    "visual_url",
    "image_path",
    "reference_image_url",
    "design_image_url",
    "gorsel_url",
    "gorsel_path",
  ]);

  return image ? String(image) : null;
}

function getDesignerName(ticket: TicketRow) {
  return getText(
    ticket,
    [
      "designer_name",
      "designer_full_name",
      "tasarimci_name",
      "tasarimci_adi",
    ],
    "-"
  );
}

function getTicketCode(ticket: TicketRow) {
  const value = getText(
    ticket,
    ["ticket_code", "reservation_code", "code", "ticket_id", "id"],
    "-"
  );

  return value.length > 14 ? value.substring(0, 14).toUpperCase() : value;
}

function normalizeStatus(status: string) {
  const normalized = status.toLowerCase();

  if (
    normalized === "yapildi" ||
    normalized === "yapıldı" ||
    normalized === "completed" ||
    normalized === "done"
  ) {
    return "yapildi";
  }

  if (
    normalized === "iptal" ||
    normalized === "cancelled" ||
    normalized === "canceled"
  ) {
    return "iptal";
  }

  return "bekliyor";
}

function getStatusLabel(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === "yapildi") return "Yapıldı";
  if (normalized === "iptal") return "İptal";

  return "Bekliyor";
}

function getStatusClass(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === "yapildi") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }

  if (normalized === "iptal") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }

  return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(`${value.substring(0, 10)}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createMonthDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // JavaScript'te pazar 0. Takvimi pazartesiden başlatıyoruz.
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7;

  const days: Array<Date | null> = [];

  for (let index = 0; index < leadingEmptyDays; index += 1) {
    days.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

export default function DovmeciPanelPage() {
  const router = useRouter();

  const [currentStudio, setCurrentStudio] = useState<CurrentStudio | null>(null);
  const [tickets, setTickets] = useState<UiTicket[]>([]);

  const [canSeeCompletedPrice, setCanSeeCompletedPrice] = useState(false);

  const [displayedMonth, setDisplayedMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [selectedDay, setSelectedDay] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

    if (studio.account_type === "individual") {
      router.replace("/solo-panel");
      return;
    }

    if (
      studio.studio_status === "suspended" ||
      studio.studio_status === "cancelled"
    ) {
      router.replace("/abonelik");
      return;
    }

    if (studio.role !== "artist") {
      router.replace(getPanelPathByRole(studio.role));
      return;
    }

    setCurrentStudio(studio);

    const { data: settingsData } = await supabase
      .from("studio_settings")
      .select("artist_can_see_completed_price")
      .eq("studio_id", studio.studio_id)
      .maybeSingle();

    const loadedSettings = settingsData as StudioSettings | null;

    setCanSeeCompletedPrice(
      loadedSettings?.artist_can_see_completed_price ?? false
    );

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_dovmeci_panel_tickets"
    );

    if (rpcError) {
      setErrorMessage(rpcError.message);
      setLoading(false);
      return;
    }

    const rpcTickets: UiTicket[] = Array.isArray(rpcData)
      ? (rpcData as UiTicket[])
      : [];

    /*
      RPC görsel kolonunu döndürmüyorsa, tickets tablosundan sadece aynı
      biletlerin görsel alanlarını tamamlamaya çalışıyoruz.
    */
    const ticketIds = rpcTickets
      .map((ticket) => getTicketId(ticket))
      .filter(Boolean);

    let enrichedTickets = rpcTickets;

    if (ticketIds.length > 0) {
      const { data: directTicketRows, error: directTicketError } = await supabase
        .from("tickets")
        .select("*")
        .eq("studio_id", studio.studio_id)
        .in("id", ticketIds);

      if (!directTicketError && directTicketRows) {
        const directMap = new Map<string, TicketRow>();

        (directTicketRows as TicketRow[]).forEach((row) => {
          const id = getTicketId(row);

          if (id) {
            directMap.set(id, row);
          }
        });

        enrichedTickets = rpcTickets.map((ticket) => {
          const ticketId = getTicketId(ticket);
          const directTicket = directMap.get(ticketId);

          return {
            ...(directTicket || {}),
            ...ticket,
            _resolved_image:
              getTicketImage(ticket) || getTicketImage(directTicket) || null,
          };
        });
      }
    }

    enrichedTickets.sort((firstTicket, secondTicket) => {
      const firstDate = `${getTicketDate(firstTicket)} ${getTicketTime(
        firstTicket
      )}`;

      const secondDate = `${getTicketDate(secondTicket)} ${getTicketTime(
        secondTicket
      )}`;

      return firstDate.localeCompare(secondDate);
    });

    setTickets(enrichedTickets);
    setLoading(false);
  }

  const ticketsByDate = useMemo(() => {
    const map = new Map<string, UiTicket[]>();

    tickets.forEach((ticket) => {
      const dateKey = getTicketDate(ticket);

      if (!dateKey) return;

      const existing = map.get(dateKey) || [];
      existing.push(ticket);
      map.set(dateKey, existing);
    });

    map.forEach((dayTickets) => {
      dayTickets.sort((firstTicket, secondTicket) =>
        getTicketTime(firstTicket).localeCompare(
          getTicketTime(secondTicket)
        )
      );
    });

    return map;
  }, [tickets]);

  const monthDays = useMemo(
    () => createMonthDays(displayedMonth),
    [displayedMonth]
  );

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const ticketDate = getTicketDate(ticket);
      const ticketStatus = normalizeStatus(getTicketStatus(ticket));

      const matchesSelectedDay =
        !selectedDay || ticketDate === selectedDay;

      const matchesStartDate =
        !startDate || (ticketDate && ticketDate >= startDate);

      const matchesEndDate =
        !endDate || (ticketDate && ticketDate <= endDate);

      const matchesStatus =
        statusFilter === "all" || ticketStatus === statusFilter;

      return (
        matchesSelectedDay &&
        matchesStartDate &&
        matchesEndDate &&
        matchesStatus
      );
    });
  }, [tickets, selectedDay, startDate, endDate, statusFilter]);

  const summary = useMemo(() => {
    const waitingCount = filteredTickets.filter(
      (ticket) => normalizeStatus(getTicketStatus(ticket)) === "bekliyor"
    ).length;

    const completedCount = filteredTickets.filter(
      (ticket) => normalizeStatus(getTicketStatus(ticket)) === "yapildi"
    ).length;

    const cancelledCount = filteredTickets.filter(
      (ticket) => normalizeStatus(getTicketStatus(ticket)) === "iptal"
    ).length;

    const completedRevenue = filteredTickets.reduce((total, ticket) => {
      const isCompleted =
        normalizeStatus(getTicketStatus(ticket)) === "yapildi";

      if (!isCompleted) return total;

      return (
        total +
        getNumber(ticket, [
          "total_price",
          "price",
          "ticket_price",
          "fiyat",
          "toplam_fiyat",
        ])
      );
    }, 0);

    return {
      totalCount: filteredTickets.length,
      waitingCount,
      completedCount,
      cancelledCount,
      completedRevenue,
    };
  }, [filteredTickets]);

  function goToPreviousMonth() {
    setDisplayedMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() - 1, 1)
    );
  }

  function goToNextMonth() {
    setDisplayedMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + 1, 1)
    );
  }

  function goToCurrentMonth() {
    const today = new Date();

    setDisplayedMonth(
      new Date(today.getFullYear(), today.getMonth(), 1)
    );

    setSelectedDay("");
  }

  function selectCalendarDay(date: Date) {
    const dateKey = toDateKey(date);

    setSelectedDay((current) => (current === dateKey ? "" : dateKey));
  }

  function clearFilters() {
    setSelectedDay("");
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            Dövmeci paneli yükleniyor...
          </div>
        </div>
      </main>
    );
  }

  if (!currentStudio) {
    return null;
  }

  const todayKey = toDateKey(new Date());

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <div className="mb-4 inline-flex rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-300">
            Dövmeci Paneli
          </div>

          <h1 className="text-4xl font-black">
            Atanan işler
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300">
            Sana atanmış dövme işlerini, tarihlerini ve görsellerini buradan
            takip edebilirsin.
          </p>
        </div>

        {errorMessage ? (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {/* TAKVİM — SAYFANIN EN ÜSTÜNDE */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4 md:p-6">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black">Aylık iş takvimi</h2>

              <p className="mt-1 text-sm text-neutral-400">
                Bir güne tıklayarak yalnızca o günün işlerini görüntüleyebilirsin.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={goToPreviousMonth}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-neutral-300 transition hover:bg-white/10"
              >
                ←
              </button>

              <button
                type="button"
                onClick={goToCurrentMonth}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-neutral-300 transition hover:bg-white/10"
              >
                Bugün
              </button>

              <button
                type="button"
                onClick={goToNextMonth}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-neutral-300 transition hover:bg-white/10"
              >
                →
              </button>
            </div>
          </div>

          <div className="mb-5 text-center text-xl font-black">
            {MONTH_NAMES[displayedMonth.getMonth()]}{" "}
            {displayedMonth.getFullYear()}
          </div>

          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {DAY_NAMES.map((dayName) => (
              <div
                key={dayName}
                className="py-2 text-center text-[10px] font-bold text-neutral-500 md:text-xs"
              >
                {dayName}
              </div>
            ))}

            {monthDays.map((day, index) => {
              if (!day) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="min-h-[70px] rounded-xl border border-transparent md:min-h-[105px]"
                  />
                );
              }

              const dateKey = toDateKey(day);
              const dayTickets = ticketsByDate.get(dateKey) || [];

              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDay;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => selectCalendarDay(day)}
                  className={`min-h-[70px] overflow-hidden rounded-xl border p-2 text-left transition md:min-h-[105px] ${
                    isSelected
                      ? "border-yellow-400 bg-yellow-400/10"
                      : isToday
                      ? "border-yellow-400/40 bg-white/[0.04]"
                      : "border-white/10 bg-neutral-900/60 hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-black md:text-sm ${
                        isToday ? "text-yellow-300" : "text-white"
                      }`}
                    >
                      {day.getDate()}
                    </span>

                    {dayTickets.length > 0 ? (
                      <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[9px] font-black text-neutral-950 md:text-[10px]">
                        {dayTickets.length}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 hidden space-y-1 md:block">
                    {dayTickets.slice(0, 3).map((ticket) => (
                      <div
                        key={getTicketId(ticket)}
                        className="truncate rounded-lg border border-white/10 bg-neutral-950 px-2 py-1 text-[10px] text-neutral-300"
                      >
                        {getTicketTime(ticket)}
                      </div>
                    ))}

                    {dayTickets.length > 3 ? (
                      <div className="text-[9px] font-bold text-neutral-500">
                        +{dayTickets.length - 3} iş
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedDay ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.06] px-4 py-3">
              <div className="text-sm font-bold text-yellow-300">
                Seçili gün: {formatDate(selectedDay)}
              </div>

              <button
                type="button"
                onClick={() => setSelectedDay("")}
                className="text-sm font-bold text-neutral-300 hover:text-white"
              >
                Gün filtresini kaldır
              </button>
            </div>
          ) : null}
        </section>

        {/* ÖZETLER */}
        <section
          className={`mb-6 grid gap-4 ${
            canSeeCompletedPrice
              ? "md:grid-cols-5"
              : "md:grid-cols-4"
          }`}
        >
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-xs text-neutral-500">Toplam İş</div>
            <div className="mt-2 text-2xl font-black">
              {summary.totalCount}
            </div>
          </div>

          <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/[0.06] p-5">
            <div className="text-xs text-neutral-500">Bekliyor</div>
            <div className="mt-2 text-2xl font-black text-yellow-300">
              {summary.waitingCount}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
            <div className="text-xs text-neutral-500">Yapıldı</div>
            <div className="mt-2 text-2xl font-black text-emerald-300">
              {summary.completedCount}
            </div>
          </div>

          <div className="rounded-3xl border border-red-500/20 bg-red-500/[0.06] p-5">
            <div className="text-xs text-neutral-500">İptal</div>
            <div className="mt-2 text-2xl font-black text-red-200">
              {summary.cancelledCount}
            </div>
          </div>

          {canSeeCompletedPrice ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-xs text-neutral-500">
                Tamamlanan İş Cirosu
              </div>

              <div className="mt-2 text-2xl font-black">
                {formatCurrency(summary.completedRevenue)}
              </div>
            </div>
          ) : null}
        </section>

        {/* FİLTRELER */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-xs font-bold text-neutral-400">
                Başlangıç Tarihi
              </label>

              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold text-neutral-400">
                Bitiş Tarihi
              </label>

              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold text-neutral-400">
                Durum
              </label>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
              >
                <option value="all">Tüm durumlar</option>
                <option value="bekliyor">Bekliyor</option>
                <option value="yapildi">Yapıldı</option>
                <option value="iptal">İptal</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-neutral-300 transition hover:bg-white/10 hover:text-white"
              >
                Filtreleri Temizle
              </button>
            </div>
          </div>
        </section>

        {/* İŞ LİSTESİ */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-black">İşler</h2>

            <div className="text-sm text-neutral-500">
              {filteredTickets.length} kayıt
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-400">
              Bu filtrelere uygun atanmış iş bulunamadı.
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              const ticketId = getTicketId(ticket);
              const status = getTicketStatus(ticket);
              const normalizedStatus = normalizeStatus(status);

              const totalPrice = getNumber(ticket, [
                "total_price",
                "price",
                "ticket_price",
                "fiyat",
                "toplam_fiyat",
              ]);

              const refreshValue = getValue(ticket, [
                "refresh_date",
                "latest_refresh_date",
                "is_refresh",
                "refresh_count",
                "yenileme_tarihi",
              ]);

              return (
                <article
                  key={ticketId}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 flex-1 gap-4">
                      <TicketImagePreview
                        rawImageUrl={getTicketImage(ticket)}
                        alt="Dövme görseli"
                      />

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                              status
                            )}`}
                          >
                            {getStatusLabel(status)}
                          </span>

                          {refreshValue ? (
                            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-200">
                              Yenileme
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 grid gap-2 text-sm text-neutral-300">
                          <div>
                            <span className="text-neutral-500">Tarih:</span>{" "}
                            <strong className="text-white">
                              {formatDate(getTicketDate(ticket))}
                            </strong>
                          </div>

                          <div>
                            <span className="text-neutral-500">Saat:</span>{" "}
                            <strong className="text-white">
                              {getTicketTime(ticket)}
                            </strong>
                          </div>

                          <div>
                            <span className="text-neutral-500">
                              Tasarımcı:
                            </span>{" "}
                            <strong className="text-white">
                              {getDesignerName(ticket)}
                            </strong>
                          </div>

                          <div>
                            <span className="text-neutral-500">Bilet:</span>{" "}
                            <strong className="text-white">
                              {getTicketCode(ticket)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:min-w-[220px]">
                      {canSeeCompletedPrice &&
                      normalizedStatus === "yapildi" ? (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                          <div className="text-xs text-neutral-500">
                            İş Fiyatı
                          </div>

                          <div className="mt-1 text-xl font-black text-emerald-300">
                            {formatCurrency(totalPrice)}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-neutral-900 p-4">
                          <div className="text-xs text-neutral-500">
                            Fiyat bilgisi
                          </div>

                          <div className="mt-1 text-sm font-bold text-neutral-300">
                            {normalizedStatus !== "yapildi"
                              ? "İş tamamlanınca görünür"
                              : "Stüdyo tarafından gizlendi"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}