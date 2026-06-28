"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { getCurrentStudio, type CurrentStudio } from "../../lib/saas/studio";
import TicketImagePreview from "../../components/TicketImagePreview";

type TicketStatus = "bekliyor" | "yapildi" | "iptal";

type TicketPayment = {
  id: string;
  ticket_id: string;
  amount: number | null;
  method: "nakit" | "kart" | string | null;
  paid_at: string | null;
  created_at?: string | null;
};

type StaffMember = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type Ticket = {
  id: string;
  studio_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  status: TicketStatus | string | null;
  total_price: number | null;
  image_url: string | null;
  source: string | null;
  warranty: boolean | null;
  designer_member_id: string | null;
  artist_member_id: string | null;
  created_at: string | null;

  designer_name?: string | null;
  artist_name?: string | null;
  paid_total?: number;
  remaining_total?: number;
  payments?: TicketPayment[];
};

function formatCurrency(value: number | null | undefined) {
  const safeValue = Number(value || 0);

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
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
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(status: string | null | undefined) {
  if (status === "yapildi") return "Yapıldı";
  if (status === "iptal") return "İptal";
  return "Bekliyor";
}

function getStatusClass(status: string | null | undefined) {
  if (status === "yapildi") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "iptal") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }

  return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
}

function getSourceLabel(source: string | null | undefined) {
  if (source === "sosyal_medya") return "Sosyal medya";
  if (source === "kapi_musterisi") return "Kapı müşterisi";
  if (source === "diger") return "Diğer";
  return "-";
}

export default function BiletlerPage() {
  const router = useRouter();

  const [currentStudio, setCurrentStudio] = useState<CurrentStudio | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [artistFilter, setArtistFilter] = useState("all");
  const [designerFilter, setDesignerFilter] = useState("all");

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

    setCurrentStudio(studio);

    const { data: ticketRows, error: ticketError } = await supabase
      .from("tickets")
      .select(
        `
        id,
        studio_id,
        customer_name,
        customer_phone,
        appointment_date,
        appointment_time,
        status,
        total_price,
        image_url,
        source,
        warranty,
        designer_member_id,
        artist_member_id,
        created_at
      `
      )
      .eq("studio_id", studio.studio_id)
      .order("appointment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (ticketError) {
      setErrorMessage(ticketError.message);
      setLoading(false);
      return;
    }

    const ticketIds = (ticketRows || []).map((ticket: any) => ticket.id);

    let payments: TicketPayment[] = [];

    if (ticketIds.length > 0) {
      const { data: paymentRows, error: paymentError } = await supabase
        .from("ticket_payments")
        .select("id, ticket_id, amount, method, paid_at, created_at")
        .in("ticket_id", ticketIds);

      if (paymentError) {
        setErrorMessage(paymentError.message);
        setLoading(false);
        return;
      }

      payments = (paymentRows || []) as TicketPayment[];
    }

    const { data: staffRows, error: staffError } = await supabase
      .from("studio_members")
      .select("id, full_name, role")
      .eq("studio_id", studio.studio_id);

    if (staffError) {
      setErrorMessage(staffError.message);
      setLoading(false);
      return;
    }

    const staff = (staffRows || []) as StaffMember[];

    const staffNameMap = new Map<string, string>();

    staff.forEach((member) => {
      staffNameMap.set(member.id, member.full_name || "-");
    });

    const enrichedTickets = ((ticketRows || []) as Ticket[]).map((ticket) => {
      const ticketPayments = payments.filter(
        (payment) => payment.ticket_id === ticket.id
      );

      const paidTotal = ticketPayments.reduce((sum, payment) => {
        return sum + Number(payment.amount || 0);
      }, 0);

      const totalPrice = Number(ticket.total_price || 0);
      const remainingTotal = Math.max(totalPrice - paidTotal, 0);

      return {
        ...ticket,
        designer_name: ticket.designer_member_id
          ? staffNameMap.get(ticket.designer_member_id) || "-"
          : "-",
        artist_name: ticket.artist_member_id
          ? staffNameMap.get(ticket.artist_member_id) || "-"
          : "-",
        paid_total: paidTotal,
        remaining_total: remainingTotal,
        payments: ticketPayments,
      };
    });

    setTickets(enrichedTickets);
    setLoading(false);
  }

  const artists = useMemo(() => {
    const map = new Map<string, string>();

    tickets.forEach((ticket) => {
      if (ticket.artist_member_id && ticket.artist_name) {
        map.set(ticket.artist_member_id, ticket.artist_name);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tickets]);

  const designers = useMemo(() => {
    const map = new Map<string, string>();

    tickets.forEach((ticket) => {
      if (ticket.designer_member_id && ticket.designer_name) {
        map.set(ticket.designer_member_id, ticket.designer_name);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesSearch =
        !normalizedSearch ||
        ticket.customer_name?.toLowerCase().includes(normalizedSearch) ||
        ticket.customer_phone?.toLowerCase().includes(normalizedSearch) ||
        ticket.artist_name?.toLowerCase().includes(normalizedSearch) ||
        ticket.designer_name?.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" || ticket.status === statusFilter;

      const appointmentDate = ticket.appointment_date || "";

      const matchesStartDate =
        !startDate || appointmentDate.substring(0, 10) >= startDate;

      const matchesEndDate =
        !endDate || appointmentDate.substring(0, 10) <= endDate;

      const matchesArtist =
        artistFilter === "all" || ticket.artist_member_id === artistFilter;

      const matchesDesigner =
        designerFilter === "all" ||
        ticket.designer_member_id === designerFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesStartDate &&
        matchesEndDate &&
        matchesArtist &&
        matchesDesigner
      );
    });
  }, [
    tickets,
    searchTerm,
    statusFilter,
    startDate,
    endDate,
    artistFilter,
    designerFilter,
  ]);

  const summary = useMemo(() => {
    const totalPrice = filteredTickets.reduce((sum, ticket) => {
      return sum + Number(ticket.total_price || 0);
    }, 0);

    const paidTotal = filteredTickets.reduce((sum, ticket) => {
      return sum + Number(ticket.paid_total || 0);
    }, 0);

    const remainingTotal = filteredTickets.reduce((sum, ticket) => {
      return sum + Number(ticket.remaining_total || 0);
    }, 0);

    const waitingCount = filteredTickets.filter(
      (ticket) => ticket.status === "bekliyor"
    ).length;

    const completedCount = filteredTickets.filter(
      (ticket) => ticket.status === "yapildi"
    ).length;

    const cancelledCount = filteredTickets.filter(
      (ticket) => ticket.status === "iptal"
    ).length;

    return {
      totalCount: filteredTickets.length,
      totalPrice,
      paidTotal,
      remainingTotal,
      waitingCount,
      completedCount,
      cancelledCount,
    };
  }, [filteredTickets]);

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            Biletler yükleniyor...
          </div>
        </div>
      </main>
    );
  }

  if (!currentStudio) {
    return null;
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4 inline-flex rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-300">
              Biletler
            </div>

            <h1 className="text-4xl font-black">Biletler</h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300">
              Tüm rezervasyonları, ödemeleri, görselleri ve durumları buradan
              takip edebilirsin.
            </p>
          </div>

          <Link
            href="/yeni-bilet"
            className="inline-flex items-center justify-center rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-yellow-300"
          >
            Yeni Bilet Oluştur
          </Link>
        </div>

        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-xs text-neutral-500">Bilet Sayısı</div>
            <div className="mt-2 text-2xl font-black">
              {summary.totalCount}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-xs text-neutral-500">Toplam Ciro</div>
            <div className="mt-2 text-2xl font-black">
              {formatCurrency(summary.totalPrice)}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-xs text-neutral-500">Alınan Ödeme</div>
            <div className="mt-2 text-2xl font-black text-emerald-300">
              {formatCurrency(summary.paidTotal)}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-xs text-neutral-500">Kalan</div>
            <div className="mt-2 text-2xl font-black text-red-200">
              {formatCurrency(summary.remainingTotal)}
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="grid gap-4 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-bold text-neutral-400">
                Arama
              </label>

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
                placeholder="Müşteri, telefon, sanatçı..."
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
                <option value="all">Tümü</option>
                <option value="bekliyor">Bekliyor</option>
                <option value="yapildi">Yapıldı</option>
                <option value="iptal">İptal</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold text-neutral-400">
                Başlangıç
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
                Bitiş
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
                Dövmeci
              </label>

              <select
                value={artistFilter}
                onChange={(event) => setArtistFilter(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
              >
                <option value="all">Tümü</option>
                {artists.map((artist) => (
                  <option key={artist.id} value={artist.id}>
                    {artist.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold text-neutral-400">
                Tasarımcı
              </label>

              <select
                value={designerFilter}
                onChange={(event) => setDesignerFilter(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
              >
                <option value="all">Tümü</option>
                {designers.map((designer) => (
                  <option key={designer.id} value={designer.id}>
                    {designer.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {filteredTickets.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-400">
              Bu filtrelere uygun bilet bulunamadı.
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <article
                key={ticket.id}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="flex gap-4">
                    <TicketImagePreview
                      rawImageUrl={ticket.image_url || null}
                      alt={`${ticket.customer_name || "Müşteri"} dövme görseli`}
                    />

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black">
                          {ticket.customer_name || "İsimsiz müşteri"}
                        </h2>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                            ticket.status
                          )}`}
                        >
                          {getStatusLabel(ticket.status)}
                        </span>
                      </div>

                      <div className="mt-2 grid gap-1 text-sm text-neutral-300">
                        <div>Telefon: {ticket.customer_phone || "-"}</div>
                        <div>
                          Tarih: {formatDate(ticket.appointment_date)}
                          {ticket.appointment_time
                            ? ` / ${ticket.appointment_time}`
                            : ""}
                        </div>
                        <div>Dövmeci: {ticket.artist_name || "-"}</div>
                        <div>Tasarımcı: {ticket.designer_name || "-"}</div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-white/10 bg-neutral-900 px-3 py-1 text-neutral-300">
                          Kaynak: {getSourceLabel(ticket.source)}
                        </span>

                        <span className="rounded-full border border-white/10 bg-neutral-900 px-3 py-1 text-neutral-300">
                          Garanti: {ticket.warranty ? "Var" : "Yok"}
                        </span>

                        <span className="rounded-full border border-white/10 bg-neutral-900 px-3 py-1 text-neutral-300">
                          Oluşturma: {formatDateTime(ticket.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:min-w-[260px]">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl border border-white/10 bg-neutral-900 p-3">
                        <div className="text-[11px] text-neutral-500">
                          Toplam
                        </div>
                        <div className="mt-1 text-sm font-black">
                          {formatCurrency(ticket.total_price)}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-neutral-900 p-3">
                        <div className="text-[11px] text-neutral-500">
                          Alınan
                        </div>
                        <div className="mt-1 text-sm font-black text-emerald-300">
                          {formatCurrency(ticket.paid_total)}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-neutral-900 p-3">
                        <div className="text-[11px] text-neutral-500">
                          Kalan
                        </div>
                        <div className="mt-1 text-sm font-black text-red-200">
                          {formatCurrency(ticket.remaining_total)}
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/biletler/${ticket.id}`}
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      Detaya Git
                    </Link>
                  </div>
                </div>

                {ticket.payments && ticket.payments.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-neutral-950/50 p-4">
                    <div className="mb-2 text-xs font-bold text-neutral-400">
                      Ödeme Geçmişi
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {ticket.payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-xs text-neutral-300"
                        >
                          <span className="font-bold text-white">
                            {formatCurrency(payment.amount)}
                          </span>{" "}
                          / {payment.method || "-"} /{" "}
                          {formatDate(payment.paid_at)}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}