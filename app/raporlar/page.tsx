"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import {
  CurrentStudio,
  StudioStaffMember,
  getCurrentStudio,
  getPanelPathByRole,
  getStudioStaff,
} from "../../lib/saas/studio";

type UserRole = "owner" | "admin" | "designer" | "artist";
type MusteriKaynagi = "kapi_musterisi" | "sosyal_medya";
type OdemeYontemi = "nakit" | "kart";
type OdemeFiltresi = "tum" | OdemeYontemi;
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
  dovme_gorseli_url: string | null;
  randevu_tarihi: string;
  randevu_saati: string | null;
  durum: TicketDurum;
  tasarimci_notu: string | null;
  garanti_kapsaminda: boolean;
  created_at: string;
  tasarimci_id: string;
  dovmeci_id: string;

  tasarimci: Person | null;
  dovmeci: Person | null;

  musteri_ad_soyad: string;
  musteri_telefon: string | null;
  musteri_kaynagi: MusteriKaynagi | null;

  toplam_ucret: number;
  ticket_payments: Payment[] | null;
  ticket_refreshes: TicketRefresh[] | null;
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

type PaymentReportRow = {
  ticket: Ticket;
  payment: Payment;
};

type RefreshReportRow = {
  ticket: Ticket;
  refresh: TicketRefresh;
};

function getTodayForInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;

  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function getFirstDayOfMonth() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
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

function studioRoleToProfileRole(role: CurrentStudio["role"]): UserRole {
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  if (role === "designer") return "designer";
  return "artist";
}

function staffRoleToProfileRole(role: StudioStaffMember["role"]): UserRole {
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  if (role === "designer") return "designer";
  return "artist";
}

export default function RaporlarPage() {
  const router = useRouter();

  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getTodayForInput());

  const [durumFilter, setDurumFilter] = useState<"tum" | TicketDurum>("tum");
  const [tasarimciFilter, setTasarimciFilter] = useState("tum");
  const [dovmeciFilter, setDovmeciFilter] = useState("tum");
  const [garantiFilter, setGarantiFilter] = useState("tum");
  const [refreshFilter, setRefreshFilter] = useState("tum");
  const [musteriKaynagiFilter, setMusteriKaynagiFilter] = useState<
    "tum" | MusteriKaynagi
  >("tum");
  const [odemeYontemiFilter, setOdemeYontemiFilter] =
    useState<OdemeFiltresi>("tum");

  const [filtersOpen, setFiltersOpen] = useState(false);

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

    if (currentStudio.role !== "owner" && currentStudio.role !== "admin") {
      router.push(getPanelPathByRole(currentStudio.role));
      return;
    }

    setStudio(currentStudio);

    setProfile({
      id: currentStudio.member_id,
      full_name: currentStudio.full_name,
      email: currentStudio.email || "",
      role: studioRoleToProfileRole(currentStudio.role),
      is_active: true,
    });

    const staffList = await getStudioStaff(currentStudio.studio_id);

    const cleanUsers: Profile[] = staffList
      .filter((member) => member.is_active)
      .map((member) => ({
        id: member.member_id,
        full_name: member.full_name,
        email: member.email || "",
        role: staffRoleToProfileRole(member.role),
        is_active: member.is_active,
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "tr"));

    setUsers(cleanUsers);

    const { data: ticketData, error: ticketError } = await supabase.rpc(
      "get_raporlar_page_tickets",
      {
        target_studio_id: currentStudio.studio_id,
      }
    );

    if (ticketError) {
      console.error(ticketError);
      setErrorMessage(ticketError.message);
      setLoading(false);
      return;
    }

    const cleanTickets: Ticket[] = (
      (ticketData || []) as RaporlarPanelTicketRow[]
    ).map((ticket) => ({
      id: ticket.ticket_id,
      bilet_no: ticket.ticket_no,
      dovme_gorseli_url: ticket.image_url || null,
      randevu_tarihi: ticket.tattoo_date,
      randevu_saati: ticket.appointment_time || null,
      durum: ticket.status,
      tasarimci_notu: ticket.designer_note || null,
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
      musteri_telefon: ticket.customer_phone || null,
      musteri_kaynagi: ticket.source || null,
      toplam_ucret: Number(ticket.price || 0),
      ticket_payments: ticket.payments || [],
      ticket_refreshes: ticket.refreshes || [],
    }));

    setTickets(cleanTickets);
    setLoading(false);
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

  function dateInRange(value: string) {
    const dateOnly = dateToInputDate(value);

    if (!dateOnly) return false;

    if (startDate && dateOnly < startDate) return false;
    if (endDate && dateOnly > endDate) return false;

    return true;
  }

  function ticketMatchesCommonFilters(
    ticket: Ticket,
    options?: {
      ignoreDate?: boolean;
      ignoreOdemeYontemi?: boolean;
    }
  ) {
    if (!options?.ignoreDate && !dateInRange(ticket.randevu_tarihi)) {
      return false;
    }

    if (durumFilter !== "tum" && ticket.durum !== durumFilter) {
      return false;
    }

    if (tasarimciFilter !== "tum" && ticket.tasarimci_id !== tasarimciFilter) {
      return false;
    }

    if (dovmeciFilter !== "tum" && ticket.dovmeci_id !== dovmeciFilter) {
      return false;
    }

    if (garantiFilter === "garanti" && !ticket.garanti_kapsaminda) {
      return false;
    }

    if (garantiFilter === "garanti_degil" && ticket.garanti_kapsaminda) {
      return false;
    }

    if (refreshFilter === "refresh" && !ticketRefreshMi(ticket)) {
      return false;
    }

    if (refreshFilter === "refresh_degil" && ticketRefreshMi(ticket)) {
      return false;
    }

    if (
      musteriKaynagiFilter !== "tum" &&
      ticket.musteri_kaynagi !== musteriKaynagiFilter
    ) {
      return false;
    }

    if (!options?.ignoreOdemeYontemi && odemeYontemiFilter !== "tum") {
      const hasMatchingPayment = getPayments(ticket).some((payment) => {
        return getOdemeYontemi(payment) === odemeYontemiFilter;
      });

      if (!hasMatchingPayment) return false;
    }

    return true;
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

  function formatPrice(value: number) {
    return `${value.toLocaleString("tr-TR")} TL`;
  }

  function formatOnlyDate(value: string) {
    if (!value) return "-";

    const dateOnly = dateToInputDate(value);

    if (!dateOnly) return "-";

    const [year, month, day] = dateOnly.split("-");

    return `${day}.${month}.${year}`;
  }

  function formatTicketDate(ticket: Ticket) {
    const dateText = formatOnlyDate(ticket.randevu_tarihi);

    if (!ticket.randevu_saati) return dateText;

    return `${dateText} ${ticket.randevu_saati.slice(0, 5)}`;
  }

  function durumEtiketi(durum: string) {
    if (durum === "bekliyor") return "Bekliyor";
    if (durum === "yapildi") return "Yapıldı";
    if (durum === "iptal") return "İptal";

    return durum;
  }

  function roleLabel(role: UserRole) {
    if (role === "owner") return "Owner";
    if (role === "admin") return "Admin";
    if (role === "designer") return "Tasarımcı";
    if (role === "artist") return "Dövmeci";

    return role;
  }

  function musteriKaynagiEtiketi(kaynak?: string | null) {
    if (kaynak === "kapi_musterisi") return "Kapı müşterisi";
    if (kaynak === "sosyal_medya") return "Sosyal medya";
  
    return "Kaynak belirtilmedi";
  }

  function musteriKaynagiClass(kaynak?: string | null) {
    if (kaynak === "kapi_musterisi") {
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
    return users.filter((user) => {
      return (
        user.role === "designer" || user.role === "admin" || user.role === "owner"
      );
    });
  }, [users]);

  const dovmeciler = useMemo(() => {
    return users.filter((user) => user.role === "artist");
  }, [users]);

  const raporTickets = useMemo(() => {
    return tickets.filter((ticket) => ticketMatchesCommonFilters(ticket));
  }, [
    tickets,
    startDate,
    endDate,
    durumFilter,
    tasarimciFilter,
    dovmeciFilter,
    garantiFilter,
    refreshFilter,
    musteriKaynagiFilter,
    odemeYontemiFilter,
  ]);

  const paymentRows = useMemo<PaymentReportRow[]>(() => {
    const rows: PaymentReportRow[] = [];

    tickets
      .filter((ticket) =>
        ticketMatchesCommonFilters(ticket, {
          ignoreDate: true,
          ignoreOdemeYontemi: true,
        })
      )
      .forEach((ticket) => {
        getPayments(ticket).forEach((payment) => {
          const yontem = getOdemeYontemi(payment);

          if (!dateInRange(payment.odeme_tarihi)) return;

          if (odemeYontemiFilter !== "tum" && yontem !== odemeYontemiFilter) {
            return;
          }

          rows.push({
            ticket,
            payment,
          });
        });
      });

    return rows.sort((a, b) => {
      return (
        new Date(b.payment.odeme_tarihi).getTime() -
        new Date(a.payment.odeme_tarihi).getTime()
      );
    });
  }, [
    tickets,
    startDate,
    endDate,
    durumFilter,
    tasarimciFilter,
    dovmeciFilter,
    garantiFilter,
    refreshFilter,
    musteriKaynagiFilter,
    odemeYontemiFilter,
  ]);

  const refreshRows = useMemo<RefreshReportRow[]>(() => {
    const rows: RefreshReportRow[] = [];

    tickets
      .filter((ticket) =>
        ticketMatchesCommonFilters(ticket, {
          ignoreDate: true,
        })
      )
      .forEach((ticket) => {
        getRefreshler(ticket).forEach((refresh) => {
          if (!dateInRange(refresh.refresh_tarihi)) return;

          rows.push({
            ticket,
            refresh,
          });
        });
      });

    return rows.sort((a, b) => {
      return (
        new Date(b.refresh.refresh_tarihi).getTime() -
        new Date(a.refresh.refresh_tarihi).getTime()
      );
    });
  }, [
    tickets,
    startDate,
    endDate,
    durumFilter,
    tasarimciFilter,
    dovmeciFilter,
    garantiFilter,
    refreshFilter,
    musteriKaynagiFilter,
    odemeYontemiFilter,
  ]);

  const toplamIs = raporTickets.length;

  const toplamCiro = raporTickets.reduce((total, ticket) => {
    return total + Number(ticket.toplam_ucret || 0);
  }, 0);

  const toplamAlinan = raporTickets.reduce((total, ticket) => {
    return total + getTicketAlinan(ticket, odemeYontemiFilter);
  }, 0);

  const toplamAlinanGenel = raporTickets.reduce((total, ticket) => {
    return total + getTicketAlinan(ticket, "tum");
  }, 0);

  const toplamNakit = raporTickets.reduce((total, ticket) => {
    return total + getTicketNakit(ticket);
  }, 0);

  const toplamKart = raporTickets.reduce((total, ticket) => {
    return total + getTicketKart(ticket);
  }, 0);

  const toplamKalan = toplamCiro - toplamAlinanGenel;

  const yapilanIs = raporTickets.filter((ticket) => {
    return ticket.durum === "yapildi";
  }).length;

  const bekleyenIs = raporTickets.filter((ticket) => {
    return ticket.durum === "bekliyor";
  }).length;

  const iptalIs = raporTickets.filter((ticket) => {
    return ticket.durum === "iptal";
  }).length;

  const garantiIs = raporTickets.filter((ticket) => {
    return ticket.garanti_kapsaminda;
  }).length;

  const refreshIs = raporTickets.filter((ticket) => {
    return ticketRefreshMi(ticket);
  }).length;

  const paymentTotal = paymentRows.reduce((total, row) => {
    return total + Number(row.payment.odeme_tutari || 0);
  }, 0);

  const paymentNakit = paymentRows.reduce((total, row) => {
    if (getOdemeYontemi(row.payment) !== "nakit") return total;

    return total + Number(row.payment.odeme_tutari || 0);
  }, 0);

  const paymentKart = paymentRows.reduce((total, row) => {
    if (getOdemeYontemi(row.payment) !== "kart") return total;

    return total + Number(row.payment.odeme_tutari || 0);
  }, 0);

  const kaynakOzetleri = useMemo(() => {
    const kaynaklar: MusteriKaynagi[] = [
      "kapi_musterisi",
      "sosyal_medya",
    ];

    return kaynaklar.map((kaynak) => {
      const kaynakTickets = raporTickets.filter((ticket) => {
        return ticket.musteri_kaynagi === kaynak;
      });

      const ciro = kaynakTickets.reduce((total, ticket) => {
        return total + Number(ticket.toplam_ucret || 0);
      }, 0);

      const alinan = kaynakTickets.reduce((total, ticket) => {
        return total + getTicketAlinan(ticket, odemeYontemiFilter);
      }, 0);

      const nakit = kaynakTickets.reduce((total, ticket) => {
        return total + getTicketNakit(ticket);
      }, 0);

      const kart = kaynakTickets.reduce((total, ticket) => {
        return total + getTicketKart(ticket);
      }, 0);

      return {
        kaynak,
        biletSayisi: kaynakTickets.length,
        ciro,
        alinan,
        nakit,
        kart,
      };
    });
  }, [raporTickets, odemeYontemiFilter]);

  const tasarimciOzetleri = useMemo(() => {
    return tasarimcilar.map((tasarimci) => {
      const tasarimciTickets = raporTickets.filter((ticket) => {
        return ticket.tasarimci_id === tasarimci.id;
      });

      const ciro = tasarimciTickets.reduce((total, ticket) => {
        return total + Number(ticket.toplam_ucret || 0);
      }, 0);

      const alinan = tasarimciTickets.reduce((total, ticket) => {
        return total + getTicketAlinan(ticket, odemeYontemiFilter);
      }, 0);

      const alinanGenel = tasarimciTickets.reduce((total, ticket) => {
        return total + getTicketAlinan(ticket, "tum");
      }, 0);

      const nakit = tasarimciTickets.reduce((total, ticket) => {
        return total + getTicketNakit(ticket);
      }, 0);

      const kart = tasarimciTickets.reduce((total, ticket) => {
        return total + getTicketKart(ticket);
      }, 0);

      return {
        id: tasarimci.id,
        full_name: tasarimci.full_name,
        biletSayisi: tasarimciTickets.length,
        yapilan: tasarimciTickets.filter((ticket) => ticket.durum === "yapildi")
          .length,
        refresh: tasarimciTickets.filter((ticket) => ticketRefreshMi(ticket))
          .length,
        ciro,
        alinan,
        nakit,
        kart,
        kalan: ciro - alinanGenel,
      };
    });
  }, [tasarimcilar, raporTickets, odemeYontemiFilter]);

  const dovmeciOzetleri = useMemo(() => {
    return dovmeciler.map((dovmeci) => {
      const dovmeciTickets = raporTickets.filter((ticket) => {
        return ticket.dovmeci_id === dovmeci.id;
      });

      const yapilanTickets = dovmeciTickets.filter((ticket) => {
        return ticket.durum === "yapildi";
      });

      const ciro = yapilanTickets.reduce((total, ticket) => {
        return total + Number(ticket.toplam_ucret || 0);
      }, 0);

      return {
        id: dovmeci.id,
        full_name: dovmeci.full_name,
        biletSayisi: dovmeciTickets.length,
        yapilan: yapilanTickets.length,
        bekleyen: dovmeciTickets.filter((ticket) => {
          return ticket.durum === "bekliyor";
        }).length,
        refresh: dovmeciTickets.filter((ticket) => ticketRefreshMi(ticket))
          .length,
        ciro,
      };
    });
  }, [dovmeciler, raporTickets]);

  const filtersActive =
    startDate !== getFirstDayOfMonth() ||
    endDate !== getTodayForInput() ||
    durumFilter !== "tum" ||
    tasarimciFilter !== "tum" ||
    dovmeciFilter !== "tum" ||
    garantiFilter !== "tum" ||
    refreshFilter !== "tum" ||
    musteriKaynagiFilter !== "tum" ||
    odemeYontemiFilter !== "tum";

  function resetFilters() {
    setStartDate(getFirstDayOfMonth());
    setEndDate(getTodayForInput());
    setDurumFilter("tum");
    setTasarimciFilter("tum");
    setDovmeciFilter("tum");
    setGarantiFilter("tum");
    setRefreshFilter("tum");
    setMusteriKaynagiFilter("tum");
    setOdemeYontemiFilter("tum");
  }

  if (loading) {
    return (
      <main className="min-h-screen elegant-page text-white flex items-center justify-center p-4 md:p-6">
        <div className="rounded-[2rem] elegant-card p-6 md:p-8">
          <h1 className="text-2xl font-bold">Raporlar yükleniyor...</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            Ödeme, müşteri kaynağı, refresh ve finansal raporlar hazırlanıyor.
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
            Rapor ekranı
          </p>

          <h1 className="text-3xl md:text-4xl font-black mt-4">Raporlar</h1>

          <p className="text-zinc-400 mt-2 text-sm md:text-base">
            Ciroyu, alınan ödemeleri, nakit/kart ayrımını, müşteri kaynaklarını,
            tasarımcı ve dövmeci performansını takip et.
          </p>

          {profile && (
            <p className="text-zinc-500 mt-2 text-xs md:text-sm">
              Giriş yapan kullanıcı: {profile.full_name} /{" "}
              {roleLabel(profile.role)}
            </p>
          )}

          {studio && (
            <p className="text-zinc-500 mt-1 text-xs md:text-sm">
              Aktif stüdyo: {studio.studio_name}
            </p>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-3xl bg-red-500/10 border border-red-500/30 p-4 md:p-5 mb-6">
            <p className="text-red-200 font-semibold">Hata</p>
            <p className="text-red-100/80 mt-2 text-sm">{errorMessage}</p>
          </div>
        )}

        <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black">
                Rapor Filtreleri
              </h2>
              <p className="text-zinc-500 text-sm mt-1">
                Tarih aralığı; iş listesinde randevu tarihine, ödeme raporunda
                ödeme tarihine, refresh raporunda refresh tarihine göre çalışır.
              </p>
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
                ? "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-5"
                : "hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-4 mt-5"
            }
          >
            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Bitiş Tarihi
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Durum</label>
              <select
                value={durumFilter}
                onChange={(event) =>
                  setDurumFilter(event.target.value as "tum" | TicketDurum)
                }
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="tum">Tüm durumlar</option>
                <option value="bekliyor">Bekliyor</option>
                <option value="yapildi">Yapıldı</option>
                <option value="iptal">İptal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Ödeme Yöntemi
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
                Müşteri Kaynağı
              </label>
              <select
                value={musteriKaynagiFilter}
                onChange={(event) =>
                  setMusteriKaynagiFilter(
                    event.target.value as "tum" | MusteriKaynagi
                  )
                }
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="tum">Tüm kaynaklar</option>
                <option value="sosyal_medya">Sosyal medya</option>
                <option value="kapi_musterisi">Kapı müşterisi</option>
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
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl md:text-2xl font-black mb-4">
            Genel Rapor Özeti
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
            <SummaryCard label="Toplam İş" value={String(toplamIs)} />
            <SummaryCard label="Toplam Ciro" value={formatPrice(toplamCiro)} />
            <SummaryCard
              label={
                odemeYontemiFilter === "tum"
                  ? "Toplam Alınan"
                  : `${odemeYontemiEtiketi(odemeYontemiFilter)} Alınan`
              }
              value={formatPrice(toplamAlinan)}
            />
            <SummaryCard label="Toplam Kalan" value={formatPrice(toplamKalan)} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
            <SummaryCard label="Nakit" value={formatPrice(toplamNakit)} />
            <SummaryCard label="Kart" value={formatPrice(toplamKart)} />
            <SummaryCard label="Yapılan" value={String(yapilanIs)} />
            <SummaryCard label="Bekleyen" value={String(bekleyenIs)} />
            <SummaryCard
              label="İptal / Garanti / Refresh"
              value={`${iptalIs} / ${garantiIs} / ${refreshIs}`}
              className="col-span-2 lg:col-span-1"
            />
          </div>
        </section>

        <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-black mb-4">
            Müşteri Kaynağı Raporu
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {kaynakOzetleri.map((item) => (
              <div
                key={item.kaynak}
                className="rounded-3xl elegant-card-soft p-4 md:p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-lg">
                    {musteriKaynagiEtiketi(item.kaynak)}
                  </h3>

                  <span className={musteriKaynagiClass(item.kaynak)}>
                    {musteriKaynagiEtiketi(item.kaynak)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <MiniCard label="Bilet" value={String(item.biletSayisi)} />
                  <MiniCard label="Ciro" value={formatPrice(item.ciro)} />
                  <MiniCard label="Alınan" value={formatPrice(item.alinan)} />
                  <MiniCard label="Nakit" value={formatPrice(item.nakit)} />
                  <MiniCard label="Kart" value={formatPrice(item.kart)} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-black mb-4">
            Tasarımcı Özeti
          </h2>

          {tasarimciOzetleri.length === 0 ? (
            <div className="rounded-3xl elegant-card-soft p-4 text-zinc-400">
              Tasarımcı bulunamadı.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {tasarimciOzetleri.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl elegant-card-soft p-4 md:p-5"
                >
                  <h3 className="font-bold text-lg">{item.full_name}</h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    <MiniCard label="Bilet" value={String(item.biletSayisi)} />
                    <MiniCard label="Yapılan" value={String(item.yapilan)} />
                    <MiniCard label="Refresh" value={String(item.refresh)} />
                    <MiniCard label="Kalan" value={formatPrice(item.kalan)} />
                    <MiniCard label="Ciro" value={formatPrice(item.ciro)} />
                    <MiniCard label="Alınan" value={formatPrice(item.alinan)} />
                    <MiniCard label="Nakit" value={formatPrice(item.nakit)} />
                    <MiniCard label="Kart" value={formatPrice(item.kart)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-black mb-4">
            Dövmeci Özeti
          </h2>

          {dovmeciOzetleri.length === 0 ? (
            <div className="rounded-3xl elegant-card-soft p-4 text-zinc-400">
              Dövmeci bulunamadı.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {dovmeciOzetleri.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl elegant-card-soft p-4 md:p-5"
                >
                  <h3 className="font-bold text-lg">{item.full_name}</h3>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                    <MiniCard label="İş" value={String(item.biletSayisi)} />
                    <MiniCard label="Yapılan" value={String(item.yapilan)} />
                    <MiniCard label="Bekleyen" value={String(item.bekleyen)} />
                    <MiniCard label="Refresh" value={String(item.refresh)} />
                    <MiniCard
                      label="Yapılan Ciro"
                      value={formatPrice(item.ciro)}
                      className="col-span-2 md:col-span-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-black mb-4">
            Ödeme Raporu
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
            <SummaryCard label="Ödeme Sayısı" value={String(paymentRows.length)} />
            <SummaryCard label="Toplam Ödeme" value={formatPrice(paymentTotal)} />
            <SummaryCard label="Nakit" value={formatPrice(paymentNakit)} />
            <SummaryCard label="Kart" value={formatPrice(paymentKart)} />
          </div>

          {paymentRows.length === 0 ? (
            <div className="rounded-3xl elegant-card-soft p-4 text-zinc-400">
              Seçili filtrelere uygun ödeme bulunamadı.
            </div>
          ) : (
            <div className="space-y-3">
              {paymentRows.slice(0, 30).map((row) => {
                const yontem = getOdemeYontemi(row.payment);

                return (
                  <a
                    key={row.payment.id}
                    href={`/biletler/${row.ticket.id}`}
                    className="block rounded-3xl elegant-card-soft p-4 hover:border-yellow-500/30 transition"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{row.ticket.bilet_no}</p>

                      <span className={odemeYontemiClass(yontem)}>
                        {odemeYontemiEtiketi(yontem)}
                      </span>

                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                        {formatOnlyDate(row.payment.odeme_tarihi)}
                      </span>

                      <span
                        className={musteriKaynagiClass(
                          row.ticket.musteri_kaynagi
                        )}
                      >
                        {musteriKaynagiEtiketi(row.ticket.musteri_kaynagi)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                      <MiniCard
                        label="Müşteri"
                        value={row.ticket.musteri_ad_soyad || "-"}
                      />
                      <MiniCard
                        label="Tutar"
                        value={formatPrice(Number(row.payment.odeme_tutari || 0))}
                      />
                      <MiniCard
                        label="Tasarımcı"
                        value={row.ticket.tasarimci?.full_name || "-"}
                      />
                      <MiniCard
                        label="Dövmeci"
                        value={row.ticket.dovmeci?.full_name || "-"}
                      />
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          {paymentRows.length > 30 && (
            <p className="text-zinc-500 text-sm mt-4">
              İlk 30 ödeme gösteriliyor. Daha dar tarih aralığı seçerek listeyi
              kısaltabilirsin.
            </p>
          )}
        </section>

        <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-black mb-4">
            Refresh Raporu
          </h2>

          <div className="rounded-2xl elegant-card-soft p-4 mb-4">
            <p className="text-zinc-400 text-sm">Refresh Sayısı</p>
            <p className="text-2xl md:text-3xl font-bold mt-2">
              {refreshRows.length}
            </p>
          </div>

          {refreshRows.length === 0 ? (
            <div className="rounded-3xl elegant-card-soft p-4 text-zinc-400">
              Seçili filtrelere uygun refresh kaydı yok.
            </div>
          ) : (
            <div className="space-y-3">
              {refreshRows.slice(0, 30).map((row) => (
                <a
                  key={row.refresh.id}
                  href={`/biletler/${row.ticket.id}`}
                  className="block rounded-3xl bg-yellow-500/10 border border-yellow-500/20 p-4 hover:border-yellow-400/40 transition"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{row.ticket.bilet_no}</p>

                    <span className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs font-semibold text-yellow-200">
                      REFRESH
                    </span>

                    <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                      {formatOnlyDate(row.refresh.refresh_tarihi)}
                    </span>

                    <span
                      className={musteriKaynagiClass(row.ticket.musteri_kaynagi)}
                    >
                      {musteriKaynagiEtiketi(row.ticket.musteri_kaynagi)}
                    </span>
                  </div>

                  <p className="text-zinc-300 text-sm mt-3">
                    {row.ticket.musteri_ad_soyad || "-"} /{" "}
                    {row.ticket.dovmeci?.full_name || "-"}
                  </p>

                  {row.refresh.refresh_notu && (
                    <p className="text-yellow-100/70 text-sm mt-2">
                      {row.refresh.refresh_notu}
                    </p>
                  )}
                </a>
              ))}
            </div>
          )}

          {refreshRows.length > 30 && (
            <p className="text-zinc-500 text-sm mt-4">
              İlk 30 refresh kaydı gösteriliyor.
            </p>
          )}
        </section>

        <section className="rounded-[2rem] elegant-card p-4 md:p-6">
          <h2 className="text-xl md:text-2xl font-black mb-4">İş Listesi</h2>

          {raporTickets.length === 0 ? (
            <div className="rounded-3xl elegant-card-soft p-4 text-zinc-400">
              Seçili filtrelere uygun iş bulunamadı.
            </div>
          ) : (
            <div className="space-y-3">
              {raporTickets.slice(0, 40).map((ticket) => {
                const toplam = Number(ticket.toplam_ucret || 0);
                const alinan = getTicketAlinan(ticket, "tum");
                const nakit = getTicketNakit(ticket);
                const kart = getTicketKart(ticket);
                const kalan = toplam - alinan;

                return (
                  <a
                    key={ticket.id}
                    href={`/biletler/${ticket.id}`}
                    className="block rounded-3xl elegant-card-soft p-4 hover:border-yellow-500/30 transition"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{ticket.bilet_no}</p>

                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                        {durumEtiketi(ticket.durum)}
                      </span>

                      <span
                        className={musteriKaynagiClass(ticket.musteri_kaynagi)}
                      >
                        {musteriKaynagiEtiketi(ticket.musteri_kaynagi)}
                      </span>

                      {ticket.garanti_kapsaminda && (
                        <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-200">
                          GARANTİ
                        </span>
                      )}

                      {ticketRefreshMi(ticket) && (
                        <span className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs font-semibold text-yellow-200">
                          REFRESH
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
                      <MiniCard
                        label="Müşteri"
                        value={ticket.musteri_ad_soyad || "-"}
                      />
                      <MiniCard label="Randevu" value={formatTicketDate(ticket)} />
                      <MiniCard label="Toplam" value={formatPrice(toplam)} />
                      <MiniCard
                        label="Nakit / Kart"
                        value={`${formatPrice(nakit)} / ${formatPrice(kart)}`}
                      />
                      <MiniCard label="Kalan" value={formatPrice(kalan)} />
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          {raporTickets.length > 40 && (
            <p className="text-zinc-500 text-sm mt-4">
              İlk 40 iş gösteriliyor. Daha dar filtre seçerek listeyi
              kısaltabilirsin.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl elegant-card p-4 md:p-5 ${className}`}>
      <p className="text-zinc-400 text-xs md:text-sm">{label}</p>
      <p className="text-lg md:text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}

function MiniCard({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl elegant-card p-3 ${className}`}>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-bold mt-1">{value}</p>
    </div>
  );
}
