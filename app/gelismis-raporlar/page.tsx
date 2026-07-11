"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import {
  type CurrentStudio,
  type StudioStaffMember,
  getCurrentStudio,
  getPanelPathByRole,
  getStudioStaff,
} from "../../lib/saas/studio";

type UserRole = "owner" | "admin" | "designer" | "artist";
type MusteriKaynagi = "kapi_musterisi" | "sosyal_medya";
type OdemeYontemi = "nakit" | "kart";
type TicketDurum = "bekliyor" | "yapildi" | "iptal";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

type Person = {
  full_name: string;
  email: string;
};

type Payment = {
  id: string;
  odeme_tarihi: string;
  odeme_tutari: number;
  odeme_yontemi: OdemeYontemi | null;
};

type TicketRefresh = {
  id: string;
  ticket_id: string;
  refresh_tarihi: string;
  refresh_notu: string | null;
  created_by: string | null;
  created_at: string;
};

type Ticket = {
  id: string;
  bilet_no: string;
  randevu_tarihi: string;
  randevu_saati: string | null;
  durum: TicketDurum;
  garanti_kapsaminda: boolean;
  created_at: string;
  tasarimci_id: string;
  dovmeci_id: string;
  tasarimci: Person | null;
  dovmeci: Person | null;
  musteri_ad_soyad: string;
  musteri_kaynagi: MusteriKaynagi | null;
  toplam_ucret: number;
  ticket_payments: Payment[];
  ticket_refreshes: TicketRefresh[];
};

type RaporlarPanelTicketRow = {
  ticket_id: string;
  ticket_no: string;
  studio_id: string;
  customer_name: string;
  customer_phone: string | null;
  source: MusteriKaynagi | null;
  tattoo_date: string;
  appointment_time: string | null;
  status: TicketDurum;
  has_guarantee: boolean;
  image_url: string | null;
  designer_note: string | null;
  designer_member_id: string | null;
  designer_name: string | null;
  designer_email: string | null;
  artist_member_id: string | null;
  artist_name: string | null;
  artist_email: string | null;
  price: number | string | null;
  payments: Payment[] | null;
  refreshes: TicketRefresh[] | null;
  created_at: string;
};

type StatusFilter = "tum" | TicketDurum;
type SourceFilter = "tum" | MusteriKaynagi;
type PaymentFilter = "tum" | OdemeYontemi;

type MonthlySummary = {
  key: string;
  label: string;
  ticketCount: number;
  completedCount: number;
  revenue: number;
  collected: number;
};

type RankingRow = {
  id: string;
  name: string;
  ticketCount: number;
  completedCount: number;
  revenue: number;
  collected: number;
  refreshCount: number;
  completionRate: number;
};

const DAY_LABELS = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];

function getTodayForInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;

  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function getFirstDayOfYear() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), 0, 1);
  const offset = firstDay.getTimezoneOffset() * 60000;

  return new Date(firstDay.getTime() - offset).toISOString().slice(0, 10);
}

function dateToInputDate(value: string) {
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const cleanDate = dateToInputDate(value);

  if (!cleanDate) return "-";

  const [year, month, day] = cleanDate.split("-");

  return `${day}.${month}.${year}`;
}

function formatPrice(value: number) {
  return `${Number(value || 0).toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
  })} TL`;
}

function formatPercent(value: number) {
  return `%${Math.round(Number.isFinite(value) ? value : 0)}`;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function getPaymentMethod(payment: Payment): OdemeYontemi {
  return payment.odeme_yontemi || "nakit";
}

function getPayments(ticket: Ticket) {
  return ticket.ticket_payments || [];
}

function getRefreshes(ticket: Ticket) {
  return ticket.ticket_refreshes || [];
}

function getTicketCollected(
  ticket: Ticket,
  paymentFilter: PaymentFilter = "tum"
) {
  return getPayments(ticket).reduce((total, payment) => {
    const method = getPaymentMethod(payment);

    if (paymentFilter !== "tum" && method !== paymentFilter) {
      return total;
    }

    return total + Number(payment.odeme_tutari || 0);
  }, 0);
}

function isTicketRefreshed(ticket: Ticket) {
  return getRefreshes(ticket).length > 0;
}

function isDateInRange(value: string, startDate: string, endDate: string) {
  const cleanDate = dateToInputDate(value);

  if (!cleanDate) return false;
  if (startDate && cleanDate < startDate) return false;
  if (endDate && cleanDate > endDate) return false;

  return true;
}

function roleLabel(role: UserRole) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "designer") return "Tasarımcı";

  return "Dövmeci";
}

function sourceLabel(source?: MusteriKaynagi | null) {
  if (source === "kapi_musterisi") return "Kapı müşterisi";
  if (source === "sosyal_medya") return "Sosyal medya";

  return "Belirtilmedi";
}

function statusLabel(status: TicketDurum) {
  if (status === "yapildi") return "Yapıldı";
  if (status === "iptal") return "İptal";

  return "Bekliyor";
}

function studioRoleToUserRole(role: CurrentStudio["role"]): UserRole {
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  if (role === "designer") return "designer";

  return "artist";
}

function staffRoleToUserRole(role: StudioStaffMember["role"]): UserRole {
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  if (role === "designer") return "designer";

  return "artist";
}

function getMonthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString("tr-TR", {
    month: "short",
    year: "numeric",
  });
}

export default function GelismisRaporlarPage() {
  const router = useRouter();

  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [addonEnabled, setAddonEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [startDate, setStartDate] = useState(getFirstDayOfYear());
  const [endDate, setEndDate] = useState(getTodayForInput());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("tum");
  const [designerFilter, setDesignerFilter] = useState("tum");
  const [artistFilter, setArtistFilter] = useState("tum");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("tum");
  const [paymentFilter, setPaymentFilter] =
    useState<PaymentFilter>("tum");

  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session?.user) {
      router.replace("/login");
      return;
    }

    const currentStudio = await getCurrentStudio();

    if (!currentStudio) {
      await supabase.auth.signOut();
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

    if (
      currentStudio.role !== "owner" &&
      currentStudio.role !== "admin"
    ) {
      router.replace(getPanelPathByRole(currentStudio.role));
      return;
    }

    setStudio(currentStudio);

    setProfile({
      id: currentStudio.member_id,
      full_name: currentStudio.full_name,
      email: currentStudio.email || "",
      role: studioRoleToUserRole(currentStudio.role),
      is_active: true,
    });

    const { data: addonData, error: addonError } = await supabase.rpc(
      "has_my_addon",
      {
        p_addon_code: "advanced_reports",
      }
    );

    if (addonError) {
      setErrorMessage(addonError.message);
      setAddonEnabled(false);
      setLoading(false);
      return;
    }

    const hasAddon = Boolean(addonData);

    setAddonEnabled(hasAddon);

    if (!hasAddon) {
      setLoading(false);
      return;
    }

    const staffList = await getStudioStaff(currentStudio.studio_id);

    const cleanUsers: Profile[] = staffList
      .filter((member) => member.is_active)
      .map((member) => ({
        id: member.member_id,
        full_name: member.full_name,
        email: member.email || "",
        role: staffRoleToUserRole(member.role),
        is_active: member.is_active,
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "tr"));

    setUsers(cleanUsers);

    const { data: ticketData, error: ticketError } = await supabase.rpc(
      "get_advanced_reports_page_tickets",
      {
        target_studio_id: currentStudio.studio_id,
      }
    );

    if (ticketError) {
      setErrorMessage(ticketError.message);
      setLoading(false);
      return;
    }

    const cleanTickets: Ticket[] = (
      (ticketData || []) as RaporlarPanelTicketRow[]
    ).map((ticket) => ({
      id: ticket.ticket_id,
      bilet_no: ticket.ticket_no,
      randevu_tarihi: ticket.tattoo_date,
      randevu_saati: ticket.appointment_time || null,
      durum: ticket.status,
      garanti_kapsaminda: Boolean(ticket.has_guarantee),
      created_at: ticket.created_at,
      tasarimci_id: ticket.designer_member_id || "",
      dovmeci_id: ticket.artist_member_id || "",
      tasarimci: ticket.designer_name
        ? {
            full_name: ticket.designer_name,
            email: ticket.designer_email || "",
          }
        : null,
      dovmeci: ticket.artist_name
        ? {
            full_name: ticket.artist_name,
            email: ticket.artist_email || "",
          }
        : null,
      musteri_ad_soyad: ticket.customer_name || "-",
      musteri_kaynagi: ticket.source || null,
      toplam_ucret: Number(ticket.price || 0),
      ticket_payments: ticket.payments || [],
      ticket_refreshes: ticket.refreshes || [],
    }));

    setTickets(cleanTickets);
    setLoading(false);
  }

  const designers = useMemo(() => {
    return users.filter((user) =>
      ["owner", "admin", "designer"].includes(user.role)
    );
  }, [users]);

  const artists = useMemo(() => {
    return users.filter((user) => user.role === "artist");
  }, [users]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (!isDateInRange(ticket.randevu_tarihi, startDate, endDate)) {
        return false;
      }

      if (
        statusFilter !== "tum" &&
        ticket.durum !== statusFilter
      ) {
        return false;
      }

      if (
        designerFilter !== "tum" &&
        ticket.tasarimci_id !== designerFilter
      ) {
        return false;
      }

      if (
        artistFilter !== "tum" &&
        ticket.dovmeci_id !== artistFilter
      ) {
        return false;
      }

      if (
        sourceFilter !== "tum" &&
        ticket.musteri_kaynagi !== sourceFilter
      ) {
        return false;
      }

      if (paymentFilter !== "tum") {
        const hasPaymentMethod = getPayments(ticket).some(
          (payment) => getPaymentMethod(payment) === paymentFilter
        );

        if (!hasPaymentMethod) return false;
      }

      return true;
    });
  }, [
    tickets,
    startDate,
    endDate,
    statusFilter,
    designerFilter,
    artistFilter,
    sourceFilter,
    paymentFilter,
  ]);

  const analytics = useMemo(() => {
    const totalTickets = filteredTickets.length;
    const completedTickets = filteredTickets.filter(
      (ticket) => ticket.durum === "yapildi"
    );
    const waitingTickets = filteredTickets.filter(
      (ticket) => ticket.durum === "bekliyor"
    );
    const cancelledTickets = filteredTickets.filter(
      (ticket) => ticket.durum === "iptal"
    );

    const totalRevenue = filteredTickets.reduce(
      (total, ticket) => total + Number(ticket.toplam_ucret || 0),
      0
    );

    const completedRevenue = completedTickets.reduce(
      (total, ticket) => total + Number(ticket.toplam_ucret || 0),
      0
    );

    const totalCollected = filteredTickets.reduce(
      (total, ticket) =>
        total + getTicketCollected(ticket, paymentFilter),
      0
    );

    const totalCollectedAllMethods = filteredTickets.reduce(
      (total, ticket) => total + getTicketCollected(ticket, "tum"),
      0
    );

    const cashCollected = filteredTickets.reduce(
      (total, ticket) => total + getTicketCollected(ticket, "nakit"),
      0
    );

    const cardCollected = filteredTickets.reduce(
      (total, ticket) => total + getTicketCollected(ticket, "kart"),
      0
    );

    const refreshCount = filteredTickets.filter(isTicketRefreshed).length;
    const guaranteeCount = filteredTickets.filter(
      (ticket) => ticket.garanti_kapsaminda
    ).length;

    return {
      totalTickets,
      completedCount: completedTickets.length,
      waitingCount: waitingTickets.length,
      cancelledCount: cancelledTickets.length,
      totalRevenue,
      completedRevenue,
      totalCollected,
      cashCollected,
      cardCollected,
      outstanding: totalRevenue - totalCollectedAllMethods,
      completionRate: totalTickets
        ? (completedTickets.length / totalTickets) * 100
        : 0,
      collectionRate: totalRevenue
        ? (totalCollectedAllMethods / totalRevenue) * 100
        : 0,
      averageTicket: totalTickets ? totalRevenue / totalTickets : 0,
      averageCompletedTicket: completedTickets.length
        ? completedRevenue / completedTickets.length
        : 0,
      refreshCount,
      refreshRate: totalTickets
        ? (refreshCount / totalTickets) * 100
        : 0,
      guaranteeCount,
      guaranteeRate: totalTickets
        ? (guaranteeCount / totalTickets) * 100
        : 0,
    };
  }, [filteredTickets, paymentFilter]);

  const monthlySummaries = useMemo<MonthlySummary[]>(() => {
    const map = new Map<string, MonthlySummary>();

    filteredTickets.forEach((ticket) => {
      const cleanDate = dateToInputDate(ticket.randevu_tarihi);

      if (!cleanDate) return;

      const key = cleanDate.slice(0, 7);
      const existing = map.get(key) || {
        key,
        label: getMonthLabel(key),
        ticketCount: 0,
        completedCount: 0,
        revenue: 0,
        collected: 0,
      };

      existing.ticketCount += 1;

      if (ticket.durum === "yapildi") {
        existing.completedCount += 1;
        existing.revenue += Number(ticket.toplam_ucret || 0);
      }

      existing.collected += getTicketCollected(ticket, paymentFilter);

      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) =>
      a.key.localeCompare(b.key)
    );
  }, [filteredTickets, paymentFilter]);

  const maxMonthlyRevenue = useMemo(() => {
    return Math.max(
      1,
      ...monthlySummaries.map((item) =>
        Math.max(item.revenue, item.collected)
      )
    );
  }, [monthlySummaries]);

  const statusSummary = useMemo(() => {
    return [
      {
        label: "Yapıldı",
        value: analytics.completedCount,
        percent: analytics.totalTickets
          ? (analytics.completedCount / analytics.totalTickets) * 100
          : 0,
      },
      {
        label: "Bekliyor",
        value: analytics.waitingCount,
        percent: analytics.totalTickets
          ? (analytics.waitingCount / analytics.totalTickets) * 100
          : 0,
      },
      {
        label: "İptal",
        value: analytics.cancelledCount,
        percent: analytics.totalTickets
          ? (analytics.cancelledCount / analytics.totalTickets) * 100
          : 0,
      },
    ];
  }, [analytics]);

  const sourceSummary = useMemo(() => {
    const sourceTypes: Array<MusteriKaynagi | null> = [
      "kapi_musterisi",
      "sosyal_medya",
      null,
    ];

    return sourceTypes.map((source) => {
      const sourceTickets = filteredTickets.filter(
        (ticket) => ticket.musteri_kaynagi === source
      );

      const revenue = sourceTickets.reduce(
        (total, ticket) => total + Number(ticket.toplam_ucret || 0),
        0
      );

      const collected = sourceTickets.reduce(
        (total, ticket) =>
          total + getTicketCollected(ticket, paymentFilter),
        0
      );

      return {
        source,
        ticketCount: sourceTickets.length,
        revenue,
        collected,
        percent: filteredTickets.length
          ? (sourceTickets.length / filteredTickets.length) * 100
          : 0,
      };
    });
  }, [filteredTickets, paymentFilter]);

  const designerRanking = useMemo<RankingRow[]>(() => {
    return designers
      .map((designer) => {
        const personTickets = filteredTickets.filter(
          (ticket) => ticket.tasarimci_id === designer.id
        );

        const completedCount = personTickets.filter(
          (ticket) => ticket.durum === "yapildi"
        ).length;

        const revenue = personTickets.reduce(
          (total, ticket) => total + Number(ticket.toplam_ucret || 0),
          0
        );

        const collected = personTickets.reduce(
          (total, ticket) =>
            total + getTicketCollected(ticket, paymentFilter),
          0
        );

        const refreshCount = personTickets.filter(
          isTicketRefreshed
        ).length;

        return {
          id: designer.id,
          name: designer.full_name,
          ticketCount: personTickets.length,
          completedCount,
          revenue,
          collected,
          refreshCount,
          completionRate: personTickets.length
            ? (completedCount / personTickets.length) * 100
            : 0,
        };
      })
      .filter((item) => item.ticketCount > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [designers, filteredTickets, paymentFilter]);

  const artistRanking = useMemo<RankingRow[]>(() => {
    return artists
      .map((artist) => {
        const personTickets = filteredTickets.filter(
          (ticket) => ticket.dovmeci_id === artist.id
        );

        const completedTickets = personTickets.filter(
          (ticket) => ticket.durum === "yapildi"
        );

        const revenue = completedTickets.reduce(
          (total, ticket) => total + Number(ticket.toplam_ucret || 0),
          0
        );

        const collected = completedTickets.reduce(
          (total, ticket) =>
            total + getTicketCollected(ticket, paymentFilter),
          0
        );

        const refreshCount = personTickets.filter(
          isTicketRefreshed
        ).length;

        return {
          id: artist.id,
          name: artist.full_name,
          ticketCount: personTickets.length,
          completedCount: completedTickets.length,
          revenue,
          collected,
          refreshCount,
          completionRate: personTickets.length
            ? (completedTickets.length / personTickets.length) * 100
            : 0,
        };
      })
      .filter((item) => item.ticketCount > 0)
      .sort((a, b) => b.completedCount - a.completedCount);
  }, [artists, filteredTickets, paymentFilter]);

  const weekdaySummary = useMemo(() => {
    const summary = DAY_LABELS.map((label, index) => ({
      index,
      label,
      ticketCount: 0,
      completedCount: 0,
      revenue: 0,
    }));

    filteredTickets.forEach((ticket) => {
      const cleanDate = dateToInputDate(ticket.randevu_tarihi);

      if (!cleanDate) return;

      const date = new Date(`${cleanDate}T12:00:00`);
      const javascriptDay = date.getDay();
      const mondayBasedIndex = (javascriptDay + 6) % 7;
      const target = summary[mondayBasedIndex];

      target.ticketCount += 1;

      if (ticket.durum === "yapildi") {
        target.completedCount += 1;
        target.revenue += Number(ticket.toplam_ucret || 0);
      }
    });

    return summary.sort((a, b) => b.ticketCount - a.ticketCount);
  }, [filteredTickets]);

  const maxWeekdayTickets = useMemo(() => {
    return Math.max(
      1,
      ...weekdaySummary.map((item) => item.ticketCount)
    );
  }, [weekdaySummary]);

  const recentHighValueTickets = useMemo(() => {
    return [...filteredTickets]
      .sort(
        (a, b) =>
          Number(b.toplam_ucret || 0) -
          Number(a.toplam_ucret || 0)
      )
      .slice(0, 10);
  }, [filteredTickets]);

  const filtersActive =
    startDate !== getFirstDayOfYear() ||
    endDate !== getTodayForInput() ||
    statusFilter !== "tum" ||
    designerFilter !== "tum" ||
    artistFilter !== "tum" ||
    sourceFilter !== "tum" ||
    paymentFilter !== "tum";

  function resetFilters() {
    setStartDate(getFirstDayOfYear());
    setEndDate(getTodayForInput());
    setStatusFilter("tum");
    setDesignerFilter("tum");
    setArtistFilter("tum");
    setSourceFilter("tum");
    setPaymentFilter("tum");
  }

  if (loading) {
    return (
      <main className="min-h-screen elegant-page p-4 text-white md:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2rem] elegant-card p-6 md:p-8">
            <h1 className="text-2xl font-black">
              Gelişmiş raporlar yükleniyor...
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Eklenti lisansı ve stüdyo verileri kontrol ediliyor.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!addonEnabled) {
    return (
      <main className="min-h-screen elegant-page p-4 text-white md:p-6">
        <div className="mx-auto max-w-4xl">
          <section className="rounded-[2rem] border border-yellow-400/20 bg-yellow-400/[0.05] p-6 md:p-10">
            <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
              Ücretli Eklenti
            </p>

            <h1 className="mt-5 text-3xl font-black md:text-5xl">
              Gelişmiş Raporlama kilitli
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 md:text-base">
              Sanatçı ve tasarımcı performansı, aylık ciro eğilimleri,
              tahsilat oranı, müşteri kaynağı analizi, yoğun günler ve
              operasyon kalitesi bu eklentiyle açılır.
            </p>

            {errorMessage ? (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/eklentiler"
                className="rounded-2xl elegant-button-gold px-5 py-4 font-black"
              >
                Eklentilere Git
              </Link>

              <Link
                href="/raporlar"
                className="rounded-2xl border border-white/10 px-5 py-4 font-bold text-zinc-200 transition hover:bg-white/10"
              >
                Standart Raporlara Dön
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen elegant-page p-4 text-white md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
            Premium Eklenti
          </p>

          <h1 className="mt-4 text-3xl font-black md:text-4xl">
            Gelişmiş Raporlama
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400 md:text-base">
            Stüdyo performansını dönem, çalışan, müşteri kaynağı,
            tahsilat ve operasyon kalitesi üzerinden ayrıntılı incele.
          </p>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
            {profile ? (
              <span>
                Kullanıcı: {profile.full_name} / {roleLabel(profile.role)}
              </span>
            ) : null}

            {studio ? <span>Stüdyo: {studio.studio_name}</span> : null}
          </div>
        </header>

        {errorMessage ? (
          <div className="mb-6 rounded-3xl border border-red-500/30 bg-red-500/10 p-5">
            <p className="font-bold text-red-200">Hata</p>
            <p className="mt-2 text-sm text-red-100/80">
              {errorMessage}
            </p>
          </div>
        ) : null}

        <section className="mb-8 rounded-[2rem] elegant-card p-4 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-black md:text-2xl">
                Analiz Filtreleri
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Raporlar randevu tarihine göre hesaplanır.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold md:hidden"
              >
                {filtersOpen ? "Filtreleri Gizle" : "Filtreleri Aç"}
              </button>

              {filtersActive ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
                >
                  Filtreleri Temizle
                </button>
              ) : null}
            </div>
          </div>

          <div
            className={
              filtersOpen
                ? "mt-5 grid grid-cols-1 gap-4 md:grid-cols-3"
                : "mt-5 hidden grid-cols-1 gap-4 md:grid md:grid-cols-3"
            }
          >
            <FilterField label="Başlangıç Tarihi">
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              />
            </FilterField>

            <FilterField label="Bitiş Tarihi">
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              />
            </FilterField>

            <FilterField label="Durum">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="tum">Tüm durumlar</option>
                <option value="bekliyor">Bekliyor</option>
                <option value="yapildi">Yapıldı</option>
                <option value="iptal">İptal</option>
              </select>
            </FilterField>

            <FilterField label="Tasarımcı">
              <select
                value={designerFilter}
                onChange={(event) =>
                  setDesignerFilter(event.target.value)
                }
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="tum">Tüm tasarımcılar</option>
                {designers.map((designer) => (
                  <option key={designer.id} value={designer.id}>
                    {designer.full_name}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Dövmeci">
              <select
                value={artistFilter}
                onChange={(event) => setArtistFilter(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="tum">Tüm dövmeciler</option>
                {artists.map((artist) => (
                  <option key={artist.id} value={artist.id}>
                    {artist.full_name}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Müşteri Kaynağı">
              <select
                value={sourceFilter}
                onChange={(event) =>
                  setSourceFilter(event.target.value as SourceFilter)
                }
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="tum">Tüm kaynaklar</option>
                <option value="kapi_musterisi">Kapı müşterisi</option>
                <option value="sosyal_medya">Sosyal medya</option>
              </select>
            </FilterField>

            <FilterField label="Ödeme Yöntemi">
              <select
                value={paymentFilter}
                onChange={(event) =>
                  setPaymentFilter(event.target.value as PaymentFilter)
                }
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="tum">Tüm ödemeler</option>
                <option value="nakit">Nakit</option>
                <option value="kart">Kart</option>
              </select>
            </FilterField>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Toplam İş"
            value={String(analytics.totalTickets)}
            detail={`${analytics.completedCount} tamamlandı`}
          />
          <MetricCard
            label="Toplam Ciro"
            value={formatPrice(analytics.totalRevenue)}
            detail={`Tamamlanan: ${formatPrice(
              analytics.completedRevenue
            )}`}
          />
          <MetricCard
            label={
              paymentFilter === "tum"
                ? "Toplam Tahsilat"
                : `${paymentFilter === "nakit" ? "Nakit" : "Kart"} Tahsilat`
            }
            value={formatPrice(analytics.totalCollected)}
            detail={`Tahsilat oranı ${formatPercent(
              analytics.collectionRate
            )}`}
          />
          <MetricCard
            label="Kalan Alacak"
            value={formatPrice(analytics.outstanding)}
            detail="Tüm ödeme yöntemleri"
          />
          <MetricCard
            label="Tamamlanma Oranı"
            value={formatPercent(analytics.completionRate)}
            detail={`${analytics.waitingCount} bekliyor`}
          />
          <MetricCard
            label="Ortalama Bilet"
            value={formatPrice(analytics.averageTicket)}
            detail={`Tamamlanan ort.: ${formatPrice(
              analytics.averageCompletedTicket
            )}`}
          />
          <MetricCard
            label="Refresh Oranı"
            value={formatPercent(analytics.refreshRate)}
            detail={`${analytics.refreshCount} refresh`}
          />
          <MetricCard
            label="Garanti Oranı"
            value={formatPercent(analytics.guaranteeRate)}
            detail={`${analytics.guaranteeCount} garanti`}
          />
        </section>

        <section className="mb-8 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="rounded-[2rem] elegant-card p-5 xl:col-span-2">
            <SectionTitle
              title="Aylık Performans Eğilimi"
              description="Tamamlanan iş cirosu ile tahsilatı ay bazında karşılaştırır."
            />

            {monthlySummaries.length === 0 ? (
              <EmptyState text="Seçili dönemde aylık veri bulunamadı." />
            ) : (
              <div className="mt-6 space-y-5">
                {monthlySummaries.map((item) => (
                  <div key={item.key}>
                    <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-bold capitalize">
                          {item.label}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {item.ticketCount} iş / {item.completedCount} tamamlandı
                        </p>
                      </div>

                      <p className="text-sm font-bold text-zinc-200">
                        {formatPrice(item.revenue)}
                      </p>
                    </div>

                    <ComparisonBar
                      firstValue={item.revenue}
                      secondValue={item.collected}
                      maxValue={maxMonthlyRevenue}
                    />

                    <div className="mt-2 flex justify-between text-[11px] text-zinc-500">
                      <span>Ciro: {formatPrice(item.revenue)}</span>
                      <span>Tahsilat: {formatPrice(item.collected)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[2rem] elegant-card p-5">
            <SectionTitle
              title="İş Durumu"
              description="Seçili dönemdeki tamamlanma dağılımı."
            />

            <div className="mt-6 space-y-5">
              {statusSummary.map((item) => (
                <ProgressRow
                  key={item.label}
                  label={item.label}
                  value={`${item.value} iş`}
                  percent={item.percent}
                />
              ))}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <MiniMetric
                label="Nakit"
                value={formatPrice(analytics.cashCollected)}
              />
              <MiniMetric
                label="Kart"
                value={formatPrice(analytics.cardCollected)}
              />
            </div>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-[2rem] elegant-card p-5">
            <SectionTitle
              title="Müşteri Kaynağı Analizi"
              description="Hangi kanalın daha fazla iş ve ciro ürettiğini gösterir."
            />

            <div className="mt-6 space-y-4">
              {sourceSummary.map((item) => (
                <div
                  key={item.source || "unspecified"}
                  className="rounded-2xl elegant-card-soft p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">
                        {sourceLabel(item.source)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {item.ticketCount} iş / {formatPercent(item.percent)}
                      </p>
                    </div>

                    <p className="text-sm font-black">
                      {formatPrice(item.revenue)}
                    </p>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-900">
                    <div
                      className="h-full rounded-full bg-yellow-400"
                      style={{
                        width: `${clamp(item.percent)}%`,
                      }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-zinc-500">
                    Tahsilat: {formatPrice(item.collected)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] elegant-card p-5">
            <SectionTitle
              title="En Yoğun Günler"
              description="Rezervasyonların haftanın hangi günlerinde yoğunlaştığını gösterir."
            />

            <div className="mt-6 space-y-4">
              {weekdaySummary.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">{item.label}</p>
                      <p className="text-xs text-zinc-500">
                        {item.completedCount} tamamlanan iş
                      </p>
                    </div>

                    <p className="text-sm font-black">
                      {item.ticketCount} iş
                    </p>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-zinc-900">
                    <div
                      className="h-full rounded-full bg-yellow-400"
                      style={{
                        width: `${
                          (item.ticketCount / maxWeekdayTickets) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <RankingTable
            title="Tasarımcı Performansı"
            description="Satış ve tahsilat değerine göre sıralanır."
            rows={designerRanking}
            emptyText="Seçili dönemde tasarımcı verisi bulunamadı."
          />

          <RankingTable
            title="Dövmeci Performansı"
            description="Tamamlanan iş sayısına göre sıralanır."
            rows={artistRanking}
            emptyText="Seçili dönemde dövmeci verisi bulunamadı."
          />
        </section>

        <section className="mb-8 rounded-[2rem] elegant-card p-5">
          <SectionTitle
            title="Operasyon Kalitesi"
            description="Refresh, garanti, iptal ve bekleyen iş oranlarını birlikte gösterir."
          />

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <QualityCard
              label="Refresh"
              count={analytics.refreshCount}
              percent={analytics.refreshRate}
            />
            <QualityCard
              label="Garanti"
              count={analytics.guaranteeCount}
              percent={analytics.guaranteeRate}
            />
            <QualityCard
              label="İptal"
              count={analytics.cancelledCount}
              percent={
                analytics.totalTickets
                  ? (analytics.cancelledCount / analytics.totalTickets) * 100
                  : 0
              }
            />
            <QualityCard
              label="Bekleyen"
              count={analytics.waitingCount}
              percent={
                analytics.totalTickets
                  ? (analytics.waitingCount / analytics.totalTickets) * 100
                  : 0
              }
            />
          </div>
        </section>

        <section className="rounded-[2rem] elegant-card p-5">
          <SectionTitle
            title="En Yüksek Tutarların Listesi"
            description="Seçili dönemdeki en yüksek ücretli ilk 10 işi gösterir."
          />

          {recentHighValueTickets.length === 0 ? (
            <EmptyState text="Seçili dönemde iş bulunamadı." />
          ) : (
            <div className="mt-6 space-y-3">
              {recentHighValueTickets.map((ticket, index) => (
                <Link
                  key={ticket.id}
                  href={`/biletler/${ticket.id}`}
                  className="grid gap-3 rounded-2xl elegant-card-soft p-4 transition hover:border-yellow-400/30 md:grid-cols-[50px_1fr_160px_160px]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 font-black text-neutral-950">
                    {index + 1}
                  </div>

                  <div>
                    <p className="font-bold">
                      {ticket.bilet_no} — {ticket.musteri_ad_soyad}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatDate(ticket.randevu_tarihi)} /{" "}
                      {statusLabel(ticket.durum)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-500">Dövmeci</p>
                    <p className="mt-1 text-sm font-bold">
                      {ticket.dovmeci?.full_name || "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-500">Toplam Ücret</p>
                    <p className="mt-1 font-black">
                      {formatPrice(ticket.toplam_ucret)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl elegant-card p-4 md:p-5">
      <p className="text-xs text-zinc-400 md:text-sm">{label}</p>
      <p className="mt-2 text-lg font-black md:text-2xl">{value}</p>
      <p className="mt-2 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl elegant-card-soft p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-black md:text-2xl">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-5 rounded-2xl elegant-card-soft p-4 text-sm text-zinc-400">
      {text}
    </div>
  );
}

function ProgressRow({
  label,
  value,
  percent,
}: {
  label: string;
  value: string;
  percent: number;
}) {
  const safePercent = clamp(percent);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-bold">{label}</p>
        <p className="text-sm text-zinc-300">
          {value} / {formatPercent(safePercent)}
        </p>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full bg-yellow-400"
          style={{ width: `${safePercent}%` }}
        />
      </div>
    </div>
  );
}

function ComparisonBar({
  firstValue,
  secondValue,
  maxValue,
}: {
  firstValue: number;
  secondValue: number;
  maxValue: number;
}) {
  const firstPercent = clamp((firstValue / maxValue) * 100);
  const secondPercent = clamp((secondValue / maxValue) * 100);

  return (
    <div className="space-y-2">
      <div className="h-3 overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full bg-yellow-400"
          style={{ width: `${firstPercent}%` }}
        />
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full bg-emerald-400"
          style={{ width: `${secondPercent}%` }}
        />
      </div>
    </div>
  );
}

function RankingTable({
  title,
  description,
  rows,
  emptyText,
}: {
  title: string;
  description: string;
  rows: RankingRow[];
  emptyText: string;
}) {
  return (
    <section className="rounded-[2rem] elegant-card p-5">
      <SectionTitle title={title} description={description} />

      {rows.length === 0 ? (
        <EmptyState text={emptyText} />
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="rounded-2xl elegant-card-soft p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-400 font-black text-neutral-950">
                    {index + 1}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-black">{row.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {row.ticketCount} iş / {row.completedCount} tamamlandı
                    </p>
                  </div>
                </div>

                <p className="text-sm font-black">
                  {formatPrice(row.revenue)}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniMetric
                  label="Tahsilat"
                  value={formatPrice(row.collected)}
                />
                <MiniMetric
                  label="Tamamlanma"
                  value={formatPercent(row.completionRate)}
                />
                <MiniMetric
                  label="Refresh"
                  value={String(row.refreshCount)}
                />
                <MiniMetric
                  label="İş"
                  value={String(row.ticketCount)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function QualityCard({
  label,
  count,
  percent,
}: {
  label: string;
  count: number;
  percent: number;
}) {
  const safePercent = clamp(percent);

  return (
    <div className="rounded-2xl elegant-card-soft p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold">{label}</p>
        <p className="text-lg font-black">{count}</p>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full bg-yellow-400"
          style={{ width: `${safePercent}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-zinc-500">
        Toplam işlerin {formatPercent(safePercent)} oranı
      </p>
    </div>
  );
}
