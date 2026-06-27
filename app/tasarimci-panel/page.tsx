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

type UserRole = "admin" | "tasarimci" | "dovmeci";

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
};

type Finance = {
  toplam_ucret: number;
};

type Payment = {
  id: string;
  odeme_tarihi: string;
  odeme_tutari: number;
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
  ticket_payments: Payment[];
  ticket_refreshes: TicketRefresh[] | null;
};

type DesignerPanelTicketRow = {
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
  artist_member_id: string | null;
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

function statusToOldStatus(status: DesignerPanelTicketRow["status"]) {
  if (status === "bekliyor") return "beklemede";
  if (status === "yapildi") return "yapildi";
  if (status === "iptal") return "iptal";
  return "beklemede";
}

function oldStatusToSaasStatus(status: string): DesignerPanelTicketRow["status"] {
  if (status === "yapildi") return "yapildi";
  if (status === "iptal") return "iptal";
  return "bekliyor";
}

function sourceLabel(source: DesignerPanelTicketRow["source"]) {
  if (source === "sosyal_medya") return "Sosyal medya";
  if (source === "kapi_musterisi") return "Kapı müşterisi";
  return "Kaynak belirtilmedi";
}

function findStaffPerson(
  staff: StudioStaffMember[],
  memberId: string | null
): Person | null {
  if (!memberId) return null;

  const member = staff.find((item) => item.member_id === memberId);

  if (!member) return null;

  return {
    full_name: member.full_name,
    email: member.email || "",
  };
}

export default function TasarimciPanelPage() {
  const router = useRouter();

  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [designerCanViewTotalRevenue, setDesignerCanViewTotalRevenue] = useState(false);

  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("tum");

  useEffect(() => {
    async function loadData() {
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

      if (
        currentStudio.role !== "owner" &&
        currentStudio.role !== "admin" &&
        currentStudio.role !== "designer"
      ) {
        router.push("/login");
        return;
      }

      setStudio(currentStudio);

      const currentProfile: Profile = {
        id: currentStudio.member_id,
        full_name: currentStudio.full_name,
        email: currentStudio.email || "",
        role: studioRoleToOldRole(currentStudio.role),
        is_active: true,
      };

      setProfile(currentProfile);

      const staffList = await getStudioStaff(currentStudio.studio_id);

      const { data: permissionData } = await supabase.rpc(
        "get_studio_permission_settings",
        {
          target_studio_id: currentStudio.studio_id,
        }
      );

      const permissionRow = Array.isArray(permissionData)
        ? permissionData[0]
        : permissionData;

      setDesignerCanViewTotalRevenue(
        permissionRow?.designer_can_view_total_revenue === true
      );

      const { data: ticketData, error: ticketError } = await supabase.rpc(
        "get_designer_panel_tickets",
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

      const cleanTickets: Ticket[] = ((ticketData || []) as DesignerPanelTicketRow[]).map(
        (ticket) => ({
          id: ticket.ticket_id,
          bilet_no: ticket.ticket_no,
          dovme_bolgesi: sourceLabel(ticket.source),
          dovme_gorseli_url: ticket.image_url,
          randevu_tarihi: ticket.tattoo_date,
          durum: statusToOldStatus(ticket.status),
          tasarimci_notu: null,
          garanti_kapsaminda: ticket.has_guarantee,
          created_at: ticket.created_at,
          tasarimci_id: ticket.designer_member_id || "",
          dovmeci_id: ticket.artist_member_id || "",
          tasarimci: findStaffPerson(staffList, ticket.designer_member_id),
          dovmeci: findStaffPerson(staffList, ticket.artist_member_id),
          ticket_customers: {
            musteri_ad_soyad: ticket.customer_name,
            musteri_telefon: ticket.customer_phone || "",
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

    loadData();
  }, [router]);

  async function updateTicketStatus(ticketId: string, nextStatus: string) {
    setSavingStatus(ticketId);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase.rpc("designer_update_ticket_status", {
      target_ticket_id: ticketId,
      new_status: oldStatusToSaasStatus(nextStatus),
    });

    if (error) {
      setErrorMessage(error.message);
      setSavingStatus(null);
      return;
    }

    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, durum: nextStatus } : ticket
      )
    );

    setSuccessMessage("Bilet durumu güncellendi.");
    setSavingStatus(null);
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

  function getRefreshler(ticket: Ticket) {
    return [...(ticket.ticket_refreshes || [])].sort((a, b) => {
      return (
        new Date(b.refresh_tarihi).getTime() -
        new Date(a.refresh_tarihi).getTime()
      );
    });
  }

  function getSonRefresh(ticket: Ticket) {
    return getRefreshler(ticket)[0] || null;
  }

  function biletRefreshMi(ticket: Ticket) {
    return getRefreshler(ticket).length > 0;
  }

  function getTicketAlinan(ticket: Ticket) {
    return ticket.ticket_payments.reduce((total, payment) => {
      return total + Number(payment.odeme_tutari || 0);
    }, 0);
  }

  function ayniGunMu(dateValue: string, targetDate: Date) {
    if (!dateValue) return false;

    const date = new Date(dateValue);

    return (
      date.getFullYear() === targetDate.getFullYear() &&
      date.getMonth() === targetDate.getMonth() &&
      date.getDate() === targetDate.getDate()
    );
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

  function tarihAraligindaMi(value: string) {
    if (!value) return false;

    const date = new Date(value);
    const start = filterStartDate ? new Date(`${filterStartDate}T00:00:00`) : null;
    const end = filterEndDate ? new Date(`${filterEndDate}T23:59:59`) : null;

    if (start && date < start) return false;
    if (end && date > end) return false;

    return true;
  }

  const isAdmin = profile?.role === "admin";
  const canSeeGeneralRevenue = isAdmin || designerCanViewTotalRevenue;

  const benimBiletlerim = useMemo(() => {
    if (!profile) return [];

    if (canSeeGeneralRevenue) {
      return tickets;
    }

    return tickets.filter((ticket) => ticket.tasarimci_id === profile.id);
  }, [tickets, profile, canSeeGeneralRevenue]);

  const filtrelenmisBenimBiletlerim = useMemo(() => {
    return benimBiletlerim.filter((ticket) => {
      const dateOk = tarihAraligindaMi(ticket.randevu_tarihi);
      const statusOk = filterStatus === "tum" || ticket.durum === filterStatus;
      return dateOk && statusOk;
    });
  }, [benimBiletlerim, filterStartDate, filterEndDate, filterStatus]);

  const bugunkuRandevularim = useMemo(() => {
    return filtrelenmisBenimBiletlerim.filter((ticket) => {
      return ayniGunMu(ticket.randevu_tarihi, new Date());
    });
  }, [filtrelenmisBenimBiletlerim]);

  const yapilanIslerim = useMemo(() => {
    return filtrelenmisBenimBiletlerim.filter((ticket) => ticket.durum === "yapildi");
  }, [filtrelenmisBenimBiletlerim]);

  const bekleyenIslerim = useMemo(() => {
    return filtrelenmisBenimBiletlerim.filter((ticket) => {
      return ticket.durum === "randevu" || ticket.durum === "beklemede";
    });
  }, [filtrelenmisBenimBiletlerim]);

  const iptalIslerim = useMemo(() => {
    return filtrelenmisBenimBiletlerim.filter((ticket) => ticket.durum === "iptal");
  }, [filtrelenmisBenimBiletlerim]);

  const refreshliIslerim = useMemo(() => {
    return filtrelenmisBenimBiletlerim.filter((ticket) => biletRefreshMi(ticket));
  }, [filtrelenmisBenimBiletlerim]);

  const garantiKapsamindakiIslerim = useMemo(() => {
    return filtrelenmisBenimBiletlerim.filter((ticket) => ticket.garanti_kapsaminda);
  }, [filtrelenmisBenimBiletlerim]);

  const benimToplamUcretim = useMemo(() => {
    return filtrelenmisBenimBiletlerim.reduce((total, ticket) => {
      return total + Number(getFinance(ticket)?.toplam_ucret || 0);
    }, 0);
  }, [filtrelenmisBenimBiletlerim]);

  const benimToplamAlinan = useMemo(() => {
    return filtrelenmisBenimBiletlerim.reduce((total, ticket) => {
      return total + getTicketAlinan(ticket);
    }, 0);
  }, [filtrelenmisBenimBiletlerim]);

  const benimToplamKalan = benimToplamUcretim - benimToplamAlinan;

  const benimSonSatislarim = useMemo(() => {
    return [...filtrelenmisBenimBiletlerim]
      .sort((a, b) => {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      })
      .slice(0, 5);
  }, [filtrelenmisBenimBiletlerim]);

  const sonOlusturulanBiletler = useMemo(() => {
    return [...tickets]
      .sort((a, b) => {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      })
      .slice(0, 6);
  }, [tickets]);

  const yaklasanRandevular = useMemo(() => {
    const now = new Date();

    return filtrelenmisBenimBiletlerim
      .filter((ticket) => {
        const ticketDate = new Date(ticket.randevu_tarihi);
        return ticketDate >= now && ticket.durum !== "iptal";
      })
      .sort((a, b) => {
        return (
          new Date(a.randevu_tarihi).getTime() -
          new Date(b.randevu_tarihi).getTime()
        );
      })
      .slice(0, 5);
  }, [filtrelenmisBenimBiletlerim]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4 md:p-6">
        <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-6 md:p-8">
          <h1 className="text-2xl font-bold">Tasarımcı paneli yükleniyor...</h1>
          <p className="text-zinc-400 mt-2 text-sm md:text-base">
            Biletler, ödemeler, garanti ve refresh bilgileri hazırlanıyor.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">Tasarımcı Paneli</h1>

          <p className="text-zinc-400 mt-2 text-sm md:text-base">
            Biletlerini, randevularını, ödemelerini, garanti ve refresh
            durumlarını görüntüle.
          </p>

          {profile && (
            <p className="text-zinc-500 mt-2 text-xs md:text-sm">
              Giriş yapan kullanıcı: {profile.full_name} / {profile.role}
            </p>
          )}

          {!canSeeGeneralRevenue && (
            <p className="text-yellow-200 mt-2 text-xs md:text-sm">
              Ciro, alınan ve kalan ücret hesapları sadece senin satışlarından
              hesaplanır.
            </p>
          )}

          {canSeeGeneralRevenue && (
            <p className="text-yellow-200 mt-2 text-xs md:text-sm">
              {isAdmin
                ? "Admin olarak bu panelde tüm biletlerin özetini görüyorsun."
                : "Admin yetki verdiği için toplam stüdyo cirosunu görüyorsun."}
            </p>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 md:p-5 mb-6">
            <p className="text-red-200 font-semibold">Supabase Hatası</p>
            <p className="text-red-100/80 mt-2 text-sm">{errorMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 md:p-5 mb-6">
            <p className="text-emerald-200 font-semibold">Başarılı</p>
            <p className="text-emerald-100/80 mt-2 text-sm">{successMessage}</p>
          </div>
        )}

        <section className="rounded-3xl bg-zinc-900 border border-zinc-800 p-4 md:p-5 mb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Tarihsel Bilet Filtresi</h2>
              <p className="text-zinc-500 text-sm mt-1">
                Bu aralıktaki biletler ve ciro özetleri hesaplanır.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setFilterStartDate("");
                setFilterEndDate("");
                setFilterStatus("tum");
              }}
              className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/10"
            >
              Filtreleri Temizle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Başlangıç Tarihi</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(event) => setFilterStartDate(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Bitiş Tarihi</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(event) => setFilterEndDate(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Dövme Durumu</label>
              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="tum">Tüm durumlar</option>
                <option value="beklemede">Beklemede</option>
                <option value="yapildi">Yapıldı</option>
                <option value="iptal">İptal</option>
              </select>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl md:text-2xl font-bold mb-4">
            {canSeeGeneralRevenue ? "Genel Özet" : "Benim Özetim"}
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">
                {canSeeGeneralRevenue ? "Bilet Sayısı" : "Benim Bilet Sayım"}
              </p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {filtrelenmisBenimBiletlerim.length}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">
                {canSeeGeneralRevenue ? "Ciro" : "Benim Ciro"}
              </p>
              <p className="text-lg md:text-2xl font-bold mt-2">
                {formatPrice(benimToplamUcretim)}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">
                {canSeeGeneralRevenue ? "Alınan" : "Benim Alınan"}
              </p>
              <p className="text-lg md:text-2xl font-bold mt-2">
                {formatPrice(benimToplamAlinan)}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">
                {canSeeGeneralRevenue ? "Kalan" : "Benim Kalan"}
              </p>
              <p className="text-lg md:text-2xl font-bold mt-2">
                {formatPrice(benimToplamKalan)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">
                Bugünkü Randevu
              </p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {bugunkuRandevularim.length}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Yapılan İş</p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {yapilanIslerim.length}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">
                Bekleyen / Randevu
              </p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {bekleyenIslerim.length}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Refreshli İş</p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {refreshliIslerim.length}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5 col-span-2 lg:col-span-1">
              <p className="text-zinc-400 text-xs md:text-sm">
                Garanti Kapsamında
              </p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {garantiKapsamindakiIslerim.length}
              </p>
            </div>
          </div>

          {iptalIslerim.length > 0 && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 md:p-5 mt-4">
              <p className="text-red-200 font-semibold text-sm md:text-base">
                İptal edilen iş sayısı: {iptalIslerim.length}
              </p>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <section className="rounded-3xl bg-zinc-900 border border-zinc-800 p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-bold mb-4">
              Bugünkü Randevular
            </h2>

            {bugunkuRandevularim.length === 0 ? (
              <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4 md:p-5 text-zinc-400 text-sm md:text-base">
                Bugün için kayıtlı randevu bulunmuyor.
              </div>
            ) : (
              <div className="space-y-3">
                {bugunkuRandevularim.map((ticket) => {
                  const customer = getCustomer(ticket);
                  const refreshVar = biletRefreshMi(ticket);
                  const sonRefresh = getSonRefresh(ticket);

                  return (
                    <a
                      key={ticket.id}
                      href={`/biletler/${ticket.id}`}
                      className={
                        refreshVar
                          ? "block rounded-2xl bg-zinc-950 border border-yellow-500/30 p-4 hover:border-yellow-400 transition"
                          : "block rounded-2xl bg-zinc-950 border border-zinc-800 p-4 hover:border-white transition"
                      }
                    >
                      <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <p className="font-bold">{ticket.bilet_no}</p>

                        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                          {durumEtiketi(ticket.durum)}
                        </span>

                        {refreshVar && (
                          <span className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs font-semibold text-yellow-200">
                            REFRESH
                          </span>
                        )}

                        {ticket.garanti_kapsaminda && (
                          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-200">
                            GARANTİ
                          </span>
                        )}
                      </div>

                      <p className="text-zinc-300 mt-3 text-sm md:text-base">
                        {customer?.musteri_ad_soyad || "-"}
                      </p>

                      <p className="text-zinc-500 mt-1 text-sm">
                        Tarih: {formatDate(ticket.randevu_tarihi)}
                      </p>

                      <p className="text-zinc-500 mt-1 text-sm">
                        Dövmeci: {ticket.dovmeci?.full_name || "-"}
                      </p>

                      {sonRefresh && (
                        <p className="text-yellow-100/70 mt-2 text-sm">
                          Son refresh: {formatOnlyDate(sonRefresh.refresh_tarihi)}
                        </p>
                      )}
                    </a>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-zinc-900 border border-zinc-800 p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-bold mb-4">
              Yaklaşan Randevular
            </h2>

            {yaklasanRandevular.length === 0 ? (
              <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4 md:p-5 text-zinc-400 text-sm md:text-base">
                Yaklaşan randevu bulunmuyor.
              </div>
            ) : (
              <div className="space-y-3">
                {yaklasanRandevular.map((ticket) => {
                  const customer = getCustomer(ticket);
                  const refreshVar = biletRefreshMi(ticket);

                  return (
                    <a
                      key={ticket.id}
                      href={`/biletler/${ticket.id}`}
                      className={
                        refreshVar
                          ? "block rounded-2xl bg-zinc-950 border border-yellow-500/30 p-4 hover:border-yellow-400 transition"
                          : "block rounded-2xl bg-zinc-950 border border-zinc-800 p-4 hover:border-white transition"
                      }
                    >
                      <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <p className="font-bold">{ticket.bilet_no}</p>

                        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                          {durumEtiketi(ticket.durum)}
                        </span>

                        {refreshVar && (
                          <span className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs font-semibold text-yellow-200">
                            REFRESH
                          </span>
                        )}

                        {ticket.garanti_kapsaminda && (
                          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-200">
                            GARANTİ
                          </span>
                        )}
                      </div>

                      <p className="text-zinc-300 mt-3 text-sm md:text-base">
                        {customer?.musteri_ad_soyad || "-"}
                      </p>

                      <p className="text-zinc-500 mt-1 text-sm">
                        Tarih: {formatDate(ticket.randevu_tarihi)}
                      </p>

                      <p className="text-zinc-500 mt-1 text-sm">
                        Dövmeci: {ticket.dovmeci?.full_name || "-"}
                      </p>
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-3xl bg-zinc-900 border border-zinc-800 p-4 md:p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-bold mb-4">
            {canSeeGeneralRevenue ? "Son Satışlar" : "Benim Son Satışlarım"}
          </h2>

          {benimSonSatislarim.length === 0 ? (
            <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4 md:p-5 text-zinc-400 text-sm md:text-base">
              Henüz satış bulunmuyor.
            </div>
          ) : (
            <div className="space-y-3">
              {benimSonSatislarim.map((ticket) => {
                const customer = getCustomer(ticket);
                const toplam = Number(getFinance(ticket)?.toplam_ucret || 0);
                const alinan = getTicketAlinan(ticket);
                const kalan = toplam - alinan;
                const refreshVar = biletRefreshMi(ticket);
                const sonRefresh = getSonRefresh(ticket);

                return (
                  <a
                    key={ticket.id}
                    href={`/biletler/${ticket.id}`}
                    className={
                      refreshVar
                        ? "block rounded-2xl bg-zinc-950 border border-yellow-500/30 p-4 hover:border-yellow-400 transition"
                        : "block rounded-2xl bg-zinc-950 border border-zinc-800 p-4 hover:border-white transition"
                    }
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 md:gap-3">
                          <p className="font-bold">{ticket.bilet_no}</p>

                          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                            {durumEtiketi(ticket.durum)}
                          </span>

                          {refreshVar && (
                            <span className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs font-semibold text-yellow-200">
                              REFRESH
                            </span>
                          )}

                          {ticket.garanti_kapsaminda && (
                            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-200">
                              GARANTİ
                            </span>
                          )}
                        </div>

                        <p className="text-zinc-300 mt-3 text-sm md:text-base">
                          {customer?.musteri_ad_soyad || "-"}
                        </p>

                        <p className="text-zinc-500 mt-1 text-sm">
                          Kaynak: {ticket.dovme_bolgesi}
                        </p>

                        <p className="text-zinc-500 mt-1 text-sm">
                          Dövmeci: {ticket.dovmeci?.full_name || "-"}
                        </p>

                        {sonRefresh && (
                          <p className="text-yellow-100/70 mt-2 text-sm">
                            Son refresh: {formatOnlyDate(sonRefresh.refresh_tarihi)}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 md:gap-3 min-w-full lg:min-w-[420px]">
                        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
                          <p className="text-zinc-500 text-xs">Toplam</p>
                          <p className="font-bold mt-1 text-sm md:text-base">
                            {formatPrice(toplam)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
                          <p className="text-zinc-500 text-xs">Alınan</p>
                          <p className="font-bold mt-1 text-sm md:text-base">
                            {formatPrice(alinan)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
                          <p className="text-zinc-500 text-xs">Kalan</p>
                          <p className="font-bold mt-1 text-sm md:text-base">
                            {formatPrice(kalan)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-zinc-900 border border-zinc-800 p-4 md:p-6">
          <h2 className="text-xl md:text-2xl font-bold mb-2">
            Filtrelenmiş Biletler ve Durum Yönetimi
          </h2>

          <p className="text-zinc-500 text-sm mb-4">
            Bu alandan dövme durumunu tasarımcı günceller. “Yapıldı” seçilen biletin fiyatı, ayar izin veriyorsa dövmeci panelinde görünür.
          </p>

          {filtrelenmisBenimBiletlerim.length === 0 ? (
            <div className="rounded-3xl bg-zinc-950 border border-zinc-800 p-4 text-zinc-400 mb-8">
              Filtreye uygun bilet yok.
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {filtrelenmisBenimBiletlerim.map((ticket) => {
                const customer = getCustomer(ticket);
                const toplam = Number(getFinance(ticket)?.toplam_ucret || 0);
                const alinan = getTicketAlinan(ticket);
                const kalan = toplam - alinan;

                return (
                  <div
                    key={ticket.id}
                    className="rounded-3xl bg-zinc-950 border border-zinc-800 p-4 md:p-5"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <a href={`/biletler/${ticket.id}`} className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold">{ticket.bilet_no}</p>
                          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                            {durumEtiketi(ticket.durum)}
                          </span>
                          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                            {formatDate(ticket.randevu_tarihi)}
                          </span>
                        </div>

                        <p className="text-zinc-300 text-sm mt-3 truncate">
                          {customer?.musteri_ad_soyad || "Müşteri yok"}
                        </p>
                        <p className="text-zinc-500 text-xs mt-1">
                          Dövmeci: {ticket.dovmeci?.full_name || "Henüz atanmadı"}
                        </p>
                      </a>

                      <div className="grid grid-cols-3 gap-2 text-sm lg:min-w-[330px]">
                        <MiniValue title="Toplam" value={formatPrice(toplam)} />
                        <MiniValue title="Alınan" value={formatPrice(alinan)} />
                        <MiniValue title="Kalan" value={formatPrice(kalan)} />
                      </div>

                      <div className="lg:min-w-[220px]">
                        <label className="block text-sm text-zinc-400 mb-2">Durum</label>
                        <select
                          value={ticket.durum}
                          disabled={savingStatus === ticket.id}
                          onChange={(event) => updateTicketStatus(ticket.id, event.target.value)}
                          className="w-full rounded-2xl elegant-input px-4 py-4 text-white disabled:opacity-50"
                        >
                          <option value="beklemede">Beklemede</option>
                          <option value="yapildi">Yapıldı</option>
                          <option value="iptal">İptal</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <h2 className="text-xl md:text-2xl font-bold mb-4">
            Son Oluşturulan Biletler
          </h2>

          <p className="text-zinc-400 mb-5 text-sm md:text-base">
            Tasarımcılar tüm biletleri görebilir. Toplam ciro yetkisi kapalıysa
            sana ait olmayan biletler ciro hesabına dahil edilmez.
          </p>

          {sonOlusturulanBiletler.length === 0 ? (
            <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4 md:p-5 text-zinc-400 text-sm md:text-base">
              Henüz bilet yok.
            </div>
          ) : (
            <div className="space-y-3">
              {sonOlusturulanBiletler.map((ticket) => {
                const customer = getCustomer(ticket);
                const refreshVar = biletRefreshMi(ticket);
                const benimMi =
                  canSeeGeneralRevenue || ticket.tasarimci_id === profile?.id;

                return (
                  <a
                    key={ticket.id}
                    href={`/biletler/${ticket.id}`}
                    className={
                      refreshVar
                        ? "block rounded-2xl bg-zinc-950 border border-yellow-500/30 p-4 hover:border-yellow-400 transition"
                        : "block rounded-2xl bg-zinc-950 border border-zinc-800 p-4 hover:border-white transition"
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                      <p className="font-bold">{ticket.bilet_no}</p>

                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                        {durumEtiketi(ticket.durum)}
                      </span>

                      {refreshVar && (
                        <span className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs font-semibold text-yellow-200">
                          REFRESH
                        </span>
                      )}

                      {ticket.garanti_kapsaminda && (
                        <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-200">
                          GARANTİ
                        </span>
                      )}

                      {!benimMi && (
                        <span className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs text-yellow-200">
                          Başka tasarımcıya ait
                        </span>
                      )}

                      {benimMi && !isAdmin && (
                        <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-200">
                          {canSeeGeneralRevenue ? "Ciroya dahil" : "Benim satışım"}
                        </span>
                      )}
                    </div>

                    <p className="text-zinc-300 mt-3 text-sm md:text-base">
                      {customer?.musteri_ad_soyad || "-"}
                    </p>

                    <p className="text-zinc-500 mt-1 text-sm">
                      Tarih: {formatDate(ticket.randevu_tarihi)}
                    </p>

                    <p className="text-zinc-500 mt-1 text-sm">
                      Tasarımcı: {ticket.tasarimci?.full_name || "-"} |
                      Dövmeci: {ticket.dovmeci?.full_name || "-"}
                    </p>
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

function MiniValue({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3">
      <p className="text-zinc-500 text-xs">{title}</p>
      <p className="font-bold mt-1 text-xs md:text-sm">{value}</p>
    </div>
  );
}
