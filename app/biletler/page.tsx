"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TicketImagePreview from "../../components/TicketImagePreview";
import { createClient } from "../../lib/supabase/client";
import {
  CurrentStudio,
  StudioStaffMember,
  getCurrentStudio,
  getPanelPathByRole,
  getStudioStaff,
} from "../../lib/saas/studio";

type UserRole = "admin" | "tasarimci" | "dovmeci";
type MusteriKaynagi = "kapi" | "sosyal_medya";
type OdemeYontemi = "nakit" | "kart";
type OdemeFiltresi = "tum" | OdemeYontemi;

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

type Customer = {
  musteri_ad_soyad: string;
  musteri_telefon: string;
  musteri_kaynagi: MusteriKaynagi | null;
};

type Finance = {
  toplam_ucret: number;
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
  dovme_bolgesi: string;
  dovme_gorseli_url: string | null;
  randevu_tarihi: string;
  durum: string;
  tasarimci_notu: string | null;
  garanti_kapsaminda: boolean;
  created_at: string;
  tasarimci_id: string;
  dovmeci_id: string;

  tasarimci: Person | null;
  dovmeci: Person | null;

  ticket_customers: Customer | Customer[] | null;
  ticket_finances: Finance | Finance[] | null;
  ticket_payments: Payment[] | null;
  ticket_refreshes: TicketRefresh[] | null;
};

type BiletlerPanelTicketRow = {
  ticket_id: string;
  ticket_no: string;
  studio_id: string;
  customer_name: string;
  customer_phone: string | null;
  tattoo_date: string;
  status: "bekliyor" | "yapildi" | "iptal";
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
  source: "kapi_musterisi" | "sosyal_medya";
  payments: Payment[] | null;
  refreshes: TicketRefresh[] | null;
};

function studioRoleToOldRole(role: CurrentStudio["role"] | StudioStaffMember["role"]): UserRole {
  if (role === "artist") return "dovmeci";
  if (role === "designer") return "tasarimci";
  return "admin";
}

function ticketStatusToOldStatus(status: BiletlerPanelTicketRow["status"]) {
  if (status === "bekliyor") return "beklemede";
  if (status === "yapildi") return "yapildi";
  if (status === "iptal") return "iptal";
  return "beklemede";
}

function sourceToOldSource(source: BiletlerPanelTicketRow["source"]): MusteriKaynagi | null {
  if (source === "kapi_musterisi") return "kapi";
  if (source === "sosyal_medya") return "sosyal_medya";
  return null;
}

export default function BiletlerPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchText, setSearchText] = useState("");
  const [durumFilter, setDurumFilter] = useState("tum");
  const [garantiFilter, setGarantiFilter] = useState("tum");
  const [refreshFilter, setRefreshFilter] = useState("tum");
  const [tasarimciFilter, setTasarimciFilter] = useState("tum");
  const [dovmeciFilter, setDovmeciFilter] = useState("tum");
  const [odemeYontemiFilter, setOdemeYontemiFilter] =
    useState<OdemeFiltresi>("tum");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
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

    const currentProfile: Profile = {
      id: currentStudio.member_id,
      full_name: currentStudio.full_name,
      email: currentStudio.email || "",
      role: studioRoleToOldRole(currentStudio.role),
      is_active: true,
    };

    setProfile(currentProfile);

    const staffList = await getStudioStaff(currentStudio.studio_id);

    const cleanUsers: Profile[] = staffList
      .filter((member) => member.is_active)
      .map((member) => ({
        id: member.member_id,
        full_name: member.full_name,
        email: member.email || "",
        role: studioRoleToOldRole(member.role),
        is_active: member.is_active,
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "tr"));

    setUsers(cleanUsers);

    const { data: ticketData, error: ticketError } = await supabase.rpc(
      "get_biletler_page_tickets",
      {
        target_studio_id: currentStudio.studio_id,
      }
    );

    if (ticketError) {
      setErrorMessage(ticketError.message);
      setLoading(false);
      return;
    }

    const cleanTickets: Ticket[] = ((ticketData || []) as BiletlerPanelTicketRow[]).map(
      (ticket) => ({
        id: ticket.ticket_id,
        bilet_no: ticket.ticket_no,
        dovme_bolgesi: ticket.customer_name || "-",
        dovme_gorseli_url: ticket.image_url,
        randevu_tarihi: ticket.tattoo_date,
        durum: ticketStatusToOldStatus(ticket.status),
        tasarimci_notu: null,
        garanti_kapsaminda: ticket.has_guarantee,
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
        ticket_customers: {
          musteri_ad_soyad: ticket.customer_name || "-",
          musteri_telefon: ticket.customer_phone || "",
          musteri_kaynagi: sourceToOldSource(ticket.source),
        },
        ticket_finances: {
          toplam_ucret: Number(ticket.price || 0),
        },
        ticket_payments: ticket.payments || [],
        ticket_refreshes: ticket.refreshes || [],
      })
    );

    setTickets(cleanTickets);
    setLoading(false);
  }

  function getSingle<T>(value: T | T[] | null): T | null {
    if (!value) return null;
    if (Array.isArray(value)) return value[0] || null;
    return value;
  }

  function getCustomer(ticket: Ticket) {
    return getSingle(ticket.ticket_customers);
  }

  function getFinance(ticket: Ticket) {
    return getSingle(ticket.ticket_finances);
  }

  function getPayments(ticket: Ticket) {
    return ticket.ticket_payments || [];
  }

  function getRefreshler(ticket: Ticket) {
    return ticket.ticket_refreshes || [];
  }

  function getOdemeYontemi(payment: Payment): OdemeYontemi {
    return payment.odeme_yontemi || "nakit";
  }

  function ticketRefreshMi(ticket: Ticket) {
    return getRefreshler(ticket).length > 0;
  }

  function ticketOdemeFiltresineUyuyor(ticket: Ticket) {
    if (odemeYontemiFilter === "tum") return true;

    return getPayments(ticket).some((payment) => {
      return getOdemeYontemi(payment) === odemeYontemiFilter;
    });
  }

  function getTicketAlinan(ticket: Ticket, filtre: OdemeFiltresi = "tum") {
    return getPayments(ticket).reduce((total, payment) => {
      const yontem = getOdemeYontemi(payment);

      if (filtre !== "tum" && yontem !== filtre) {
        return total;
      }

      return total + Number(payment.odeme_tutari || 0);
    }, 0);
  }

  function getTicketNakit(ticket: Ticket) {
    return getTicketAlinan(ticket, "nakit");
  }

  function getTicketKart(ticket: Ticket) {
    return getTicketAlinan(ticket, "kart");
  }

  function getSonRefresh(ticket: Ticket) {
    const refreshler = getRefreshler(ticket);

    if (refreshler.length === 0) return null;

    return [...refreshler].sort((a, b) => {
      return (
        new Date(b.refresh_tarihi).getTime() -
        new Date(a.refresh_tarihi).getTime()
      );
    })[0];
  }

  function formatPrice(value: number) {
    return `${value.toLocaleString("tr-TR")} TL`;
  }

  function formatDate(value: string) {
    if (!value) return "-";

    return new Date(value).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatOnlyDate(value: string) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function durumEtiketi(durum: string) {
    if (durum === "randevu") return "Randevu";
    if (durum === "beklemede") return "Beklemede";
    if (durum === "yapildi") return "Yapıldı";
    if (durum === "iptal") return "İptal";

    return durum;
  }

  function durumClass(durum: string) {
    if (durum === "yapildi") {
      return "rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-200";
    }

    if (durum === "iptal") {
      return "rounded-full bg-red-500/10 border border-red-500/30 px-3 py-1 text-xs font-semibold text-red-200";
    }

    if (durum === "beklemede") {
      return "rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs font-semibold text-yellow-200";
    }

    return "rounded-full bg-blue-500/10 border border-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-200";
  }

  function musteriKaynagiEtiketi(kaynak?: string | null) {
    if (kaynak === "kapi") return "Kapı müşterisi";
    if (kaynak === "sosyal_medya") return "Sosyal medya";

    return "Kaynak belirtilmedi";
  }

  function musteriKaynagiClass(kaynak?: string | null) {
    if (kaynak === "kapi") {
      return "rounded-full bg-blue-500/10 border border-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-200";
    }

    if (kaynak === "sosyal_medya") {
      return "rounded-full bg-purple-500/10 border border-purple-500/30 px-3 py-1 text-xs font-semibold text-purple-200";
    }

    return "rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400";
  }

  function odemeYontemiEtiketi(yontem: OdemeFiltresi) {
    if (yontem === "nakit") return "Nakit";
    if (yontem === "kart") return "Kart";

    return "Tüm ödemeler";
  }

  function odemeYontemiClass(yontem: OdemeYontemi) {
    if (yontem === "kart") {
      return "rounded-full bg-purple-500/10 border border-purple-500/30 px-3 py-1 text-xs font-semibold text-purple-200";
    }

    return "rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-200";
  }

  const tasarimcilar = useMemo(() => {
    return users.filter((user) => user.role === "tasarimci");
  }, [users]);

  const dovmeciler = useMemo(() => {
    return users.filter((user) => user.role === "dovmeci");
  }, [users]);

  const filteredTickets = useMemo(() => {
    const arama = searchText.trim().toLocaleLowerCase("tr-TR");

    return tickets.filter((ticket) => {
      const customer = getCustomer(ticket);
      const sonRefresh = getSonRefresh(ticket);
      const musteriKaynagi = musteriKaynagiEtiketi(
        customer?.musteri_kaynagi
      ).toLocaleLowerCase("tr-TR");

      const paymentsText = getPayments(ticket)
        .map((payment) => {
          const yontem = getOdemeYontemi(payment);
          return `${odemeYontemiEtiketi(yontem)} ${payment.odeme_tutari}`;
        })
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      const searchableText = [
        ticket.bilet_no,
        ticket.durum,
        durumEtiketi(ticket.durum),
        customer?.musteri_ad_soyad,
        customer?.musteri_telefon,
        musteriKaynagi,
        ticket.tasarimci?.full_name,
        ticket.dovmeci?.full_name,
        ticket.tasarimci_notu,
        sonRefresh?.refresh_notu,
        paymentsText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      const aramaUyuyor = !arama || searchableText.includes(arama);

      const durumUyuyor =
        durumFilter === "tum" || ticket.durum === durumFilter;

      const garantiUyuyor =
        garantiFilter === "tum" ||
        (garantiFilter === "garanti" && ticket.garanti_kapsaminda) ||
        (garantiFilter === "garanti_degil" && !ticket.garanti_kapsaminda);

      const refreshUyuyor =
        refreshFilter === "tum" ||
        (refreshFilter === "refresh" && ticketRefreshMi(ticket)) ||
        (refreshFilter === "refresh_degil" && !ticketRefreshMi(ticket));

      const tasarimciUyuyor =
        tasarimciFilter === "tum" || ticket.tasarimci_id === tasarimciFilter;

      const dovmeciUyuyor =
        dovmeciFilter === "tum" || ticket.dovmeci_id === dovmeciFilter;

      const odemeUyuyor = ticketOdemeFiltresineUyuyor(ticket);

      return (
        aramaUyuyor &&
        durumUyuyor &&
        garantiUyuyor &&
        refreshUyuyor &&
        tasarimciUyuyor &&
        dovmeciUyuyor &&
        odemeUyuyor
      );
    });
  }, [
    tickets,
    searchText,
    durumFilter,
    garantiFilter,
    refreshFilter,
    tasarimciFilter,
    dovmeciFilter,
    odemeYontemiFilter,
  ]);

  const summaryTickets = useMemo(() => {
    if (profile?.role === "admin") return filteredTickets;

    return filteredTickets.filter((ticket) => {
      return ticket.tasarimci_id === profile?.id;
    });
  }, [filteredTickets, profile]);

  const toplamBilet = filteredTickets.length;

  const ozetBilet = summaryTickets.length;

  const toplamUcret = summaryTickets.reduce((total, ticket) => {
    return total + Number(getFinance(ticket)?.toplam_ucret || 0);
  }, 0);

  const toplamAlinan = summaryTickets.reduce((total, ticket) => {
    return total + getTicketAlinan(ticket, "tum");
  }, 0);

  const toplamNakit = summaryTickets.reduce((total, ticket) => {
    return total + getTicketNakit(ticket);
  }, 0);

  const toplamKart = summaryTickets.reduce((total, ticket) => {
    return total + getTicketKart(ticket);
  }, 0);

  const toplamKalan = toplamUcret - toplamAlinan;

  const yapilanSayisi = filteredTickets.filter(
    (ticket) => ticket.durum === "yapildi"
  ).length;

  const bekleyenSayisi = filteredTickets.filter((ticket) => {
    return ticket.durum === "randevu" || ticket.durum === "beklemede";
  }).length;

  const refreshSayisi = filteredTickets.filter((ticket) =>
    ticketRefreshMi(ticket)
  ).length;

  const garantiSayisi = filteredTickets.filter(
    (ticket) => ticket.garanti_kapsaminda
  ).length;

  const filtersActive =
    searchText ||
    durumFilter !== "tum" ||
    garantiFilter !== "tum" ||
    refreshFilter !== "tum" ||
    tasarimciFilter !== "tum" ||
    dovmeciFilter !== "tum" ||
    odemeYontemiFilter !== "tum";

  function resetFilters() {
    setSearchText("");
    setDurumFilter("tum");
    setGarantiFilter("tum");
    setRefreshFilter("tum");
    setTasarimciFilter("tum");
    setDovmeciFilter("tum");
    setOdemeYontemiFilter("tum");
  }

  if (loading) {
    return (
      <main className="min-h-screen elegant-page text-white flex items-center justify-center p-4 md:p-6">
        <div className="rounded-[2rem] elegant-card p-6 md:p-8">
          <h1 className="text-2xl font-bold">Biletler yükleniyor...</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            Müşteri, ödeme, garanti ve refresh bilgileri hazırlanıyor.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen elegant-page text-white p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 md:mb-8">
          <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
            Bilet listesi
          </p>

          <h1 className="text-3xl md:text-4xl font-black mt-4">Biletler</h1>

          <p className="text-zinc-400 mt-2 text-sm md:text-base">
            Tüm biletleri, müşteri kaynağını, ödeme yöntemlerini, garanti ve
            refresh durumlarını tek ekrandan takip et.
          </p>

          {profile && (
            <p className="text-zinc-500 mt-2 text-xs md:text-sm">
              Giriş yapan kullanıcı: {profile.full_name} / {profile.role}
            </p>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-3xl bg-red-500/10 border border-red-500/30 p-4 md:p-5 mb-6">
            <p className="text-red-200 font-semibold">Hata</p>
            <p className="text-red-100/80 mt-2 text-sm">{errorMessage}</p>
          </div>
        )}

        <section className="mb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">
                Listelenen Bilet
              </p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {toplamBilet}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">
                {profile?.role === "admin" ? "Özet Bilet" : "Benim Biletlerim"}
              </p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {ozetBilet}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Toplam Ciro</p>
              <p className="text-lg md:text-2xl font-bold mt-2">
                {formatPrice(toplamUcret)}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Toplam Alınan</p>
              <p className="text-lg md:text-2xl font-bold mt-2">
                {formatPrice(toplamAlinan)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Nakit</p>
              <p className="text-lg md:text-2xl font-bold mt-2">
                {formatPrice(toplamNakit)}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Kart</p>
              <p className="text-lg md:text-2xl font-bold mt-2">
                {formatPrice(toplamKart)}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Kalan</p>
              <p className="text-lg md:text-2xl font-bold mt-2">
                {formatPrice(toplamKalan)}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Yapılan</p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {yapilanSayisi}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5 col-span-2 lg:col-span-1">
              <p className="text-zinc-400 text-xs md:text-sm">
                Bekleyen / Refresh / Garanti
              </p>
              <p className="text-lg md:text-2xl font-bold mt-2">
                {bekleyenSayisi} / {refreshSayisi} / {garantiSayisi}
              </p>
            </div>
          </div>

          {profile?.role !== "admin" && (
            <div className="rounded-3xl elegant-card-soft p-4 mt-4">
              <p className="text-zinc-400 text-sm">
                Bu özet sadece senin sattığın biletlerin cirosunu hesaplar.
                Listede diğer tasarımcıların biletleri de görünebilir.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex-1">
              <label className="block text-sm text-zinc-400 mb-2">
                Arama
              </label>

              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                placeholder="Bilet no, müşteri, telefon, kaynak, ödeme yöntemi, tasarımcı..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-semibold text-white hover:bg-white/10 transition md:hidden"
              >
                {filtersOpen ? "Filtreleri Gizle" : "Filtreleri Aç"}
              </button>

              {filtersActive && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 font-semibold text-red-200 hover:bg-red-500/20 transition"
                >
                  Temizle
                </button>
              )}
            </div>
          </div>

          <div
            className={
              filtersOpen
                ? "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-5"
                : "hidden md:grid md:grid-cols-3 lg:grid-cols-6 gap-4 mt-5"
            }
          >
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Durum</label>
              <select
                value={durumFilter}
                onChange={(event) => setDurumFilter(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="tum">Tüm durumlar</option>
                <option value="randevu">Randevu</option>
                <option value="beklemede">Beklemede</option>
                <option value="yapildi">Yapıldı</option>
                <option value="iptal">İptal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Garanti
              </label>
              <select
                value={garantiFilter}
                onChange={(event) => setGarantiFilter(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="tum">Tümü</option>
                <option value="garanti">Garanti kapsamında</option>
                <option value="garanti_degil">Garanti değil</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Refresh
              </label>
              <select
                value={refreshFilter}
                onChange={(event) => setRefreshFilter(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="tum">Tümü</option>
                <option value="refresh">Refresh olanlar</option>
                <option value="refresh_degil">Refresh olmayanlar</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Ödeme
              </label>
              <select
                value={odemeYontemiFilter}
                onChange={(event) =>
                  setOdemeYontemiFilter(event.target.value as OdemeFiltresi)
                }
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="tum">Tüm ödemeler</option>
                <option value="nakit">Nakit</option>
                <option value="kart">Kart</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Tasarımcı
              </label>
              <select
                value={tasarimciFilter}
                onChange={(event) => setTasarimciFilter(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="tum">Tüm tasarımcılar</option>
                {tasarimcilar.map((tasarimci) => (
                  <option key={tasarimci.id} value={tasarimci.id}>
                    {tasarimci.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Dövmeci
              </label>
              <select
                value={dovmeciFilter}
                onChange={(event) => setDovmeciFilter(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="tum">Tüm dövmeciler</option>
                {dovmeciler.map((dovmeci) => (
                  <option key={dovmeci.id} value={dovmeci.id}>
                    {dovmeci.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-2xl elegant-card-soft p-4 mt-5">
            <p className="text-sm text-zinc-400">
              Aktif ödeme filtresi:{" "}
              <span className="font-bold text-white">
                {odemeYontemiEtiketi(odemeYontemiFilter)}
              </span>
            </p>
          </div>
        </section>

        <section>
          {filteredTickets.length === 0 ? (
            <div className="rounded-[2rem] elegant-card p-6 md:p-8 text-center">
              <h2 className="text-2xl font-black">Bilet bulunamadı</h2>
              <p className="text-zinc-400 mt-2 text-sm">
                Seçili filtrelere uygun bilet yok.
              </p>

              {filtersActive && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-5 rounded-2xl elegant-button-gold px-6 py-4 font-black"
                >
                  Filtreleri Temizle
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTickets.map((ticket) => {
                const customer = getCustomer(ticket);
                const finance = getFinance(ticket);

                const toplam = Number(finance?.toplam_ucret || 0);
                const alinan = getTicketAlinan(ticket, "tum");
                const nakit = getTicketNakit(ticket);
                const kart = getTicketKart(ticket);
                const kalan = toplam - alinan;

                const refreshMi = ticketRefreshMi(ticket);
                const sonRefresh = getSonRefresh(ticket);

                const baskaTasarimciyaAit =
                  profile?.role === "tasarimci" &&
                  ticket.tasarimci_id !== profile.id;

                return (
                  <a
                    key={ticket.id}
                    href={`/biletler/${ticket.id}`}
                    className={
                      refreshMi
                        ? "block rounded-[2rem] bg-zinc-950 border border-yellow-500/30 p-4 md:p-5 hover:border-yellow-400 transition"
                        : "block rounded-[2rem] elegant-card p-4 md:p-5 hover:border-yellow-500/30 transition"
                    }
                  >
                    <div className="flex flex-col lg:flex-row gap-4">
                      {ticket.dovme_gorseli_url && (
  <div className="lg:w-44 shrink-0">
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setPreviewImageUrl(ticket.dovme_gorseli_url);
      }}
      className="block w-full text-left group"
    >
      <img
        src={ticket.dovme_gorseli_url}
        alt="Dövme görseli"
        className="h-44 w-full lg:w-44 rounded-3xl object-cover bg-black/30 border border-white/10 transition group-hover:scale-[1.02] group-hover:border-yellow-500/40"
      />

      <p className="text-xs text-zinc-500 mt-2 text-center group-hover:text-yellow-200 transition">
        Görseli büyüt
      </p>
    </button>
  </div>
)}

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-lg md:text-xl">
                            {ticket.bilet_no}
                          </p>

                          <span className={durumClass(ticket.durum)}>
                            {durumEtiketi(ticket.durum)}
                          </span>

                          <span
                            className={musteriKaynagiClass(
                              customer?.musteri_kaynagi
                            )}
                          >
                            {musteriKaynagiEtiketi(
                              customer?.musteri_kaynagi
                            )}
                          </span>

                          {ticket.garanti_kapsaminda && (
                            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-200">
                              GARANTİ
                            </span>
                          )}

                          {refreshMi && (
                            <span className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs font-semibold text-yellow-200">
                              REFRESH
                            </span>
                          )}

                          {baskaTasarimciyaAit && (
                            <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                              Başka tasarımcıya ait
                            </span>
                          )}

                          {nakit > 0 && (
                            <span className={odemeYontemiClass("nakit")}>
                              Nakit: {formatPrice(nakit)}
                            </span>
                          )}

                          {kart > 0 && (
                            <span className={odemeYontemiClass("kart")}>
                              Kart: {formatPrice(kart)}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                          <div className="rounded-2xl elegant-card-soft p-4">
                            <p className="text-xs text-zinc-500">Müşteri</p>
                            <p className="font-bold mt-1 truncate">
                              {customer?.musteri_ad_soyad || "-"}
                            </p>
                            <p className="text-zinc-500 text-sm mt-1">
                              {customer?.musteri_telefon || "-"}
                            </p>
                          </div>

                          <div className="rounded-2xl elegant-card-soft p-4">
                            <p className="text-xs text-zinc-500">
                              Randevu Tarihi
                            </p>
                            <p className="font-bold mt-1">
                              {formatDate(ticket.randevu_tarihi)}
                            </p>
                          </div>

                          <div className="rounded-2xl elegant-card-soft p-4">
                            <p className="text-xs text-zinc-500">Ekip</p>
                            <p className="font-bold mt-1 truncate">
                              {ticket.tasarimci?.full_name || "-"}
                            </p>
                            <p className="text-zinc-500 text-sm mt-1 truncate">
                              Dövmeci: {ticket.dovmeci?.full_name || "-"}
                            </p>
                          </div>

                          <div className="rounded-2xl elegant-card-soft p-4">
                            <p className="text-xs text-zinc-500">
                              Toplam / Alınan
                            </p>
                            <p className="font-bold mt-1">
                              {formatPrice(toplam)}
                            </p>
                            <p className="text-zinc-500 text-sm mt-1">
                              Alınan: {formatPrice(alinan)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                          <div className="rounded-2xl elegant-card-soft p-4">
                            <p className="text-xs text-zinc-500">Nakit</p>
                            <p className="font-bold mt-1">
                              {formatPrice(nakit)}
                            </p>
                          </div>

                          <div className="rounded-2xl elegant-card-soft p-4">
                            <p className="text-xs text-zinc-500">Kart</p>
                            <p className="font-bold mt-1">
                              {formatPrice(kart)}
                            </p>
                          </div>

                          <div className="rounded-2xl elegant-card-soft p-4">
                            <p className="text-xs text-zinc-500">Kalan</p>
                            <p className="font-bold mt-1">
                              {formatPrice(kalan)}
                            </p>
                          </div>

                          <div className="rounded-2xl elegant-card-soft p-4">
                            <p className="text-xs text-zinc-500">
                              Ödeme Sayısı
                            </p>
                            <p className="font-bold mt-1">
                              {getPayments(ticket).length}
                            </p>
                          </div>
                        </div>

                        {getPayments(ticket).length > 0 && (
                          <div className="mt-3 rounded-2xl elegant-card-soft p-4">
                            <p className="text-xs text-zinc-500 mb-3">
                              Ödeme Geçmişi
                            </p>

                            <div className="flex flex-wrap gap-2">
                              {getPayments(ticket)
                                .sort((a, b) => {
                                  return (
                                    new Date(a.odeme_tarihi).getTime() -
                                    new Date(b.odeme_tarihi).getTime()
                                  );
                                })
                                .map((payment) => {
                                  const yontem = getOdemeYontemi(payment);

                                  return (
                                    <span
                                      key={payment.id}
                                      className={
                                        yontem === "kart"
                                          ? "rounded-full bg-purple-500/10 border border-purple-500/30 px-3 py-1 text-xs font-semibold text-purple-200"
                                          : "rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-200"
                                      }
                                    >
                                      {formatOnlyDate(payment.odeme_tarihi)} ·{" "}
                                      {formatPrice(
                                        Number(payment.odeme_tutari || 0)
                                      )}{" "}
                                      · {odemeYontemiEtiketi(yontem)}
                                    </span>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        {sonRefresh && (
                          <div className="mt-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 p-4">
                            <p className="text-yellow-200 text-sm font-semibold">
                              Son Refresh:{" "}
                              {formatOnlyDate(sonRefresh.refresh_tarihi)}
                            </p>

                            {sonRefresh.refresh_notu && (
                              <p className="text-yellow-100/70 text-sm mt-1">
                                {sonRefresh.refresh_notu}
                              </p>
                            )}
                          </div>
                        )}

                        {ticket.tasarimci_notu && (
                          <div className="mt-3 rounded-2xl elegant-card-soft p-4">
                            <p className="text-xs text-zinc-500">
                              Tasarımcı Notu
                            </p>
                            <p className="text-zinc-300 text-sm mt-1 line-clamp-2">
                              {ticket.tasarimci_notu}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
                </section>

        {previewImageUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 md:p-8"
            onClick={() => setPreviewImageUrl(null)}
          >
            <div
              className="relative w-full max-w-5xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="absolute -top-14 right-0 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20 transition"
              >
                Kapat
              </button>

              <img
                src={previewImageUrl}
                alt="Büyük dövme görseli"
                className="max-h-[85vh] w-full rounded-[2rem] object-contain bg-black border border-white/10 shadow-2xl"
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}