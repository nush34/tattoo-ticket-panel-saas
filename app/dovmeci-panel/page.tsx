"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import {
  CurrentStudio,
  getCurrentStudio,
  getPanelPathByRole,
} from "../../lib/saas/studio";

type UserRole = "admin" | "tasarimci" | "dovmeci";
type SaasTicketStatus = "bekliyor" | "yapildi" | "iptal";

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

type Finance = {
  toplam_ucret: number;
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

  tasarimci: Person | null;

  ticket_finances: Finance | Finance[] | null;
  ticket_refreshes: TicketRefresh[] | null;
};

type DovmeciPanelTicketRow = {
  ticket_id: string;
  ticket_no: string;
  studio_id: string;
  tattoo_date: string;
  status: SaasTicketStatus;
  has_guarantee: boolean;
  created_at: string;
  designer_name: string | null;
  designer_email: string | null;
  visible_price: number | null;
  artist_can_view_completed_price: boolean;
  image_url: string | null;
  source: "kapi_musterisi" | "sosyal_medya";
  refreshes: TicketRefresh[] | null;
};

function statusToOldStatus(status: SaasTicketStatus) {
  if (status === "bekliyor") return "beklemede";
  if (status === "yapildi") return "yapildi";
  if (status === "iptal") return "iptal";
  return "beklemede";
}

function oldStatusToSaasStatus(status: string): SaasTicketStatus {
  if (status === "yapildi") return "yapildi";
  if (status === "iptal") return "iptal";
  return "bekliyor";
}

export default function DovmeciPanelPage() {
  const router = useRouter();

  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [artistCanViewCompletedPrice, setArtistCanViewCompletedPrice] = useState(true);

  const [baslangicTarihi, setBaslangicTarihi] = useState("");
  const [bitisTarihi, setBitisTarihi] = useState("");
  const [durumFiltresi, setDurumFiltresi] = useState("tum");
  const [refreshFiltresi, setRefreshFiltresi] = useState("tum");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });

  async function loadData() {
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

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

    if (currentStudio.role !== "artist") {
      router.push(getPanelPathByRole(currentStudio.role));
      return;
    }

    setStudio(currentStudio);

    const currentProfile: Profile = {
      id: currentStudio.member_id,
      full_name: currentStudio.full_name,
      email: currentStudio.email || "",
      role: "dovmeci",
      is_active: true,
    };

    setProfile(currentProfile);

    const { data: ticketData, error: ticketError } = await supabase.rpc(
      "get_dovmeci_panel_tickets",
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

    const ticketRows = (ticketData || []) as DovmeciPanelTicketRow[];

    if (ticketRows.length > 0) {
      setArtistCanViewCompletedPrice(
        Boolean(ticketRows[0].artist_can_view_completed_price)
      );
    } else {
      const { data: permissionData } = await supabase.rpc(
        "get_studio_permission_settings",
        {
          target_studio_id: currentStudio.studio_id,
        }
      );

      const permissionRow = Array.isArray(permissionData)
        ? permissionData[0]
        : permissionData;

      setArtistCanViewCompletedPrice(
        permissionRow?.artist_can_view_completed_price !== false
      );
    }

    const cleanTickets: Ticket[] = ticketRows.map(
      (ticket) => ({
        id: ticket.ticket_id,
        bilet_no: ticket.ticket_no,
        dovme_bolgesi: "Müşteri bilgisi gizli",
        dovme_gorseli_url: ticket.image_url,
        randevu_tarihi: ticket.tattoo_date,
        durum: statusToOldStatus(ticket.status),
        tasarimci_notu: null,
        garanti_kapsaminda: ticket.has_guarantee,
        created_at: ticket.created_at,
        tasarimci: {
          full_name: ticket.designer_name || "-",
          email: ticket.designer_email || "",
        },
        ticket_finances: {
          toplam_ucret: Number(ticket.visible_price || 0),
        },
        ticket_refreshes: ticket.refreshes || [],
      })
    );

    setTickets(cleanTickets);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [router]);

  async function updateTicketStatus(ticketId: string, newStatus: SaasTicketStatus) {
    if (!studio) return;

    setSavingStatus(ticketId);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase.rpc("artist_update_ticket_status", {
      target_ticket_id: ticketId,
      new_status: newStatus,
    });

    if (error) {
      setErrorMessage(error.message);
      setSavingStatus(null);
      return;
    }

    setSuccessMessage("Bilet durumu güncellendi.");
    setSavingStatus(null);

    await loadData();
  }

  function getSingle<T>(value: T | T[] | null): T | null {
    if (!value) return null;
    if (Array.isArray(value)) return value[0] || null;
    return value;
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
    const refreshler = getRefreshler(ticket);
    return refreshler[0] || null;
  }

  function biletRefreshMi(ticket: Ticket) {
    return getRefreshler(ticket).length > 0;
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

  function tarihAraligindaMi(value: string) {
    if (!value) return false;

    const date = new Date(value);

    const start = baslangicTarihi
      ? new Date(`${baslangicTarihi}T00:00:00`)
      : null;

    const end = bitisTarihi ? new Date(`${bitisTarihi}T23:59:59`) : null;

    if (start && date < start) return false;
    if (end && date > end) return false;

    return true;
  }

  function formatPrice(value: number) {
    return `${value.toLocaleString("tr-TR")} TL`;
  }

  function formatDateTime(value: string) {
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


  function dateKey(value: string) {
    if (!value) return "";
    return value.slice(0, 10);
  }

  function changeCalendarMonth(direction: "prev" | "next") {
    const [year, month] = calendarMonth.split("-").map(Number);
    const nextDate = new Date(year, month - 1 + (direction === "next" ? 1 : -1), 1);
    const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
    setCalendarMonth(nextMonth);
    setSelectedCalendarDate(`${nextMonth}-01`);
  }

  function durumEtiketi(durum: string) {
    if (durum === "randevu") return "Randevu";
    if (durum === "beklemede") return "Beklemede";
    if (durum === "yapildi") return "Yapıldı";
    if (durum === "iptal") return "İptal";
    return durum;
  }

  function filtreleriTemizle() {
    setBaslangicTarihi("");
    setBitisTarihi("");
    setDurumFiltresi("tum");
    setRefreshFiltresi("tum");
  }

  const calendarDays = useMemo(() => {
    const [year, month] = calendarMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const days: { key: string; day: number; tickets: Ticket[] }[] = [];

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push({
        key,
        day,
        tickets: tickets.filter((ticket) => dateKey(ticket.randevu_tarihi) === key),
      });
    }

    const leadingEmptyDays = (firstDay.getDay() + 6) % 7;
    return { days, leadingEmptyDays };
  }, [tickets, calendarMonth]);

  const selectedCalendarTickets = useMemo(() => {
    return tickets
      .filter((ticket) => dateKey(ticket.randevu_tarihi) === selectedCalendarDate)
      .sort((a, b) => new Date(a.randevu_tarihi).getTime() - new Date(b.randevu_tarihi).getTime());
  }, [tickets, selectedCalendarDate]);

  const filtrelenmisBiletler = useMemo(() => {
    return tickets.filter((ticket) => {
      const tarihEslesiyor = tarihAraligindaMi(ticket.randevu_tarihi);

      const durumEslesiyor =
        durumFiltresi === "tum" || ticket.durum === durumFiltresi;

      const refreshEslesiyor =
        refreshFiltresi === "tum" ||
        (refreshFiltresi === "refresh-var" && biletRefreshMi(ticket)) ||
        (refreshFiltresi === "refresh-yok" && !biletRefreshMi(ticket));

      return tarihEslesiyor && durumEslesiyor && refreshEslesiyor;
    });
  }, [tickets, baslangicTarihi, bitisTarihi, durumFiltresi, refreshFiltresi]);

  const bugunkuIsler = useMemo(() => {
    return filtrelenmisBiletler.filter((ticket) => {
      return ayniGunMu(ticket.randevu_tarihi, new Date());
    });
  }, [filtrelenmisBiletler]);

  const refreshliIsler = useMemo(() => {
    return filtrelenmisBiletler.filter((ticket) => biletRefreshMi(ticket));
  }, [filtrelenmisBiletler]);

  const yapilanIsler = useMemo(() => {
    return filtrelenmisBiletler.filter((ticket) => ticket.durum === "yapildi");
  }, [filtrelenmisBiletler]);

  const bekleyenIsler = useMemo(() => {
    return filtrelenmisBiletler.filter((ticket) => {
      return ticket.durum === "randevu" || ticket.durum === "beklemede";
    });
  }, [filtrelenmisBiletler]);

  const toplamGorunenKazanc = useMemo(() => {
    return yapilanIsler.reduce((total, ticket) => {
      return total + Number(getFinance(ticket)?.toplam_ucret || 0);
    }, 0);
  }, [yapilanIsler]);

  const tumZamanlarYapilanIsler = useMemo(() => {
    return tickets.filter((ticket) => ticket.durum === "yapildi");
  }, [tickets]);

  const tumZamanlarKazanc = useMemo(() => {
    return tumZamanlarYapilanIsler.reduce((total, ticket) => {
      return total + Number(getFinance(ticket)?.toplam_ucret || 0);
    }, 0);
  }, [tumZamanlarYapilanIsler]);

  const siraliBiletler = useMemo(() => {
    return [...filtrelenmisBiletler].sort((a, b) => {
      return (
        new Date(a.randevu_tarihi).getTime() -
        new Date(b.randevu_tarihi).getTime()
      );
    });
  }, [filtrelenmisBiletler]);

  const aktifFiltreSayisi = [
    baslangicTarihi ? "baslangic" : "",
    bitisTarihi ? "bitis" : "",
    durumFiltresi !== "tum" ? "durum" : "",
    refreshFiltresi !== "tum" ? "refresh" : "",
  ].filter(Boolean).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4 md:p-6">
        <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-6 md:p-8">
          <h1 className="text-2xl font-bold">Dövmeci paneli yükleniyor...</h1>
          <p className="text-zinc-400 mt-2 text-sm md:text-base">
            Sana atanmış işler ve refresh geçmişi hazırlanıyor.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">Dövmeci Paneli</h1>

          <p className="text-zinc-400 mt-2 text-sm md:text-base">
            Hoş geldin,{" "}
            <span className="text-white font-semibold">
              {profile?.full_name}
            </span>
            . Burada sadece sana atanmış işler görünür.
          </p>

          <p className="text-zinc-500 mt-2 text-xs md:text-sm">
            Müşteri adı, telefon ve diğer dövmecilerin işleri görünmez.
          </p>

          {studio && (
            <p className="text-zinc-500 mt-2 text-xs md:text-sm">
              Aktif stüdyo: {studio.studio_name}
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

        <section className="rounded-3xl bg-zinc-900 border border-zinc-800 p-4 md:p-5 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold">Aylık Takvimim</h2>
              <p className="text-zinc-500 text-sm mt-1">
                Sana atanmış dövmeleri ay ay takip edebilirsin. Durum değişikliği tasarımcı panelinden yapılır.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeCalendarMonth("prev")}
                className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/10"
              >
                Önceki Ay
              </button>

              <input
                type="month"
                value={calendarMonth}
                onChange={(event) => {
                  setCalendarMonth(event.target.value);
                  setSelectedCalendarDate(`${event.target.value}-01`);
                }}
                className="rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2 text-white"
              />

              <button
                type="button"
                onClick={() => changeCalendarMonth("next")}
                className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/10"
              >
                Sonraki Ay
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs text-zinc-500 mb-2">
            <span>Pzt</span>
            <span>Sal</span>
            <span>Çar</span>
            <span>Per</span>
            <span>Cum</span>
            <span>Cmt</span>
            <span>Paz</span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: calendarDays.leadingEmptyDays }).map((_, index) => (
              <div key={`empty-${index}`} className="min-h-20 rounded-2xl border border-transparent" />
            ))}

            {calendarDays.days.map((day) => {
              const selected = selectedCalendarDate === day.key;
              const hasTicket = day.tickets.length > 0;

              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => setSelectedCalendarDate(day.key)}
                  className={
                    selected
                      ? "min-h-20 rounded-2xl border border-yellow-500/50 bg-yellow-500/15 p-2 text-left"
                      : hasTicket
                        ? "min-h-20 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-2 text-left hover:bg-emerald-500/15"
                        : "min-h-20 rounded-2xl border border-zinc-800 bg-zinc-950 p-2 text-left hover:bg-white/5"
                  }
                >
                  <p className="font-bold text-sm">{day.day}</p>
                  {hasTicket && (
                    <p className="mt-2 inline-flex rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-white">
                      {day.tickets.length} iş
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl bg-zinc-950 border border-zinc-800 p-4">
            <p className="font-semibold">Seçili gün: {formatOnlyDate(selectedCalendarDate)}</p>

            {selectedCalendarTickets.length === 0 ? (
              <p className="text-zinc-500 text-sm mt-2">Bu gün için atanmış iş yok.</p>
            ) : (
              <div className="space-y-2 mt-3">
                {selectedCalendarTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{ticket.bilet_no}</span>
                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                        {durumEtiketi(ticket.durum)}
                      </span>
                      {biletRefreshMi(ticket) && (
                        <span className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs font-semibold text-yellow-200">
                          REFRESH
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-xs mt-2">Tasarımcı: {ticket.tasarimci?.full_name || "-"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/30 p-4 md:p-5 mb-6">
          <p className="text-yellow-200 font-semibold">Tarih Filtresi</p>
          <p className="text-yellow-100/80 mt-2 text-sm">
            Tarih filtresi iş listesini değiştirir. Admin fiyat görünürlüğünü
            açtıysa ciro sadece “Yapıldı” olan filtrelenmiş işlerden hesaplanır.
            Yetki kapalıysa fiyat ve ciro bilgileri gizlenir.
          </p>
        </div>

        <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-4 md:p-5 mb-6">
          <div className="flex items-center justify-between gap-3 md:hidden">
            <div>
              <h2 className="font-bold">Filtreler</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Aktif filtre: {aktifFiltreSayisi}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className="rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold"
            >
              {filtersOpen ? "Kapat" : "Aç"}
            </button>
          </div>

          <div className={filtersOpen ? "mt-4 md:mt-0" : "hidden md:block"}>
            <h2 className="hidden md:block text-xl font-bold mb-4">
              Filtreler
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Başlangıç Tarihi
                </label>
                <input
                  type="date"
                  value={baslangicTarihi}
                  onChange={(event) => setBaslangicTarihi(event.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-3 outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Bitiş Tarihi
                </label>
                <input
                  type="date"
                  value={bitisTarihi}
                  onChange={(event) => setBitisTarihi(event.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-3 outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Durum
                </label>
                <select
                  value={durumFiltresi}
                  onChange={(event) => setDurumFiltresi(event.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-3 outline-none focus:border-white"
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
                  Refresh
                </label>
                <select
                  value={refreshFiltresi}
                  onChange={(event) => setRefreshFiltresi(event.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-3 outline-none focus:border-white"
                >
                  <option value="tum">Tüm refresh durumları</option>
                  <option value="refresh-var">Refresh var</option>
                  <option value="refresh-yok">Refresh yok</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={filtreleriTemizle}
                  className="w-full rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 font-semibold hover:bg-red-500/20 transition"
                >
                  Filtreleri Temizle
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
            <p className="text-zinc-400 text-xs md:text-sm">İş</p>
            <p className="text-2xl md:text-3xl font-bold mt-2">
              {filtrelenmisBiletler.length}
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
            <p className="text-zinc-400 text-xs md:text-sm">Bugün</p>
            <p className="text-2xl md:text-3xl font-bold mt-2">
              {bugunkuIsler.length}
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
            <p className="text-zinc-400 text-xs md:text-sm">Bekleyen</p>
            <p className="text-2xl md:text-3xl font-bold mt-2">
              {bekleyenIsler.length}
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
            <p className="text-zinc-400 text-xs md:text-sm">Refresh</p>
            <p className="text-2xl md:text-3xl font-bold mt-2">
              {refreshliIsler.length}
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5 col-span-2 lg:col-span-1">
            <p className="text-zinc-400 text-xs md:text-sm">Filtre Ciro</p>
            <p className="text-xl md:text-2xl font-bold mt-2">
              {artistCanViewCompletedPrice
                ? formatPrice(toplamGorunenKazanc)
                : "Gizli"}
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              {artistCanViewCompletedPrice
                ? "Sadece “Yapıldı” olanlar."
                : "Admin fiyat görünürlüğünü kapattı."}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5 mb-6 md:mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-zinc-400 text-xs md:text-sm">
                Tüm Zamanlar İşim
              </p>
              <p className="text-2xl font-bold mt-2">{tickets.length}</p>
            </div>

            <div>
              <p className="text-zinc-400 text-xs md:text-sm">
                Tüm Zamanlar Yapılan İşim
              </p>
              <p className="text-2xl font-bold mt-2">
                {tumZamanlarYapilanIsler.length}
              </p>
            </div>

            <div>
              <p className="text-zinc-400 text-xs md:text-sm">
                Tüm Zamanlar Ciro
              </p>
              <p className="text-2xl font-bold mt-2">
                {artistCanViewCompletedPrice
                  ? formatPrice(tumZamanlarKazanc)
                  : "Gizli"}
              </p>
              <p className="text-xs text-zinc-500 mt-2">
                {artistCanViewCompletedPrice
                  ? "Sadece “Yapıldı” olan işler."
                  : "Admin fiyat görünürlüğünü kapattı."}
              </p>
            </div>
          </div>
        </div>

        {siraliBiletler.length === 0 ? (
          <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-6 md:p-8 text-zinc-400">
            Seçili filtrelere uygun iş bulunmuyor.
          </div>
        ) : (
          <div className="space-y-4 md:space-y-5">
            {siraliBiletler.map((ticket) => {
              const refreshler = getRefreshler(ticket);
              const sonRefresh = getSonRefresh(ticket);
              const isRefresh = biletRefreshMi(ticket);
              const fiyatGorunur =
                artistCanViewCompletedPrice && ticket.durum === "yapildi";
              const toplamUcret = Number(getFinance(ticket)?.toplam_ucret || 0);

              return (
                <div
                  key={ticket.id}
                  className={
                    isRefresh
                      ? "rounded-3xl bg-zinc-900 border border-yellow-500/40 p-4 md:p-5"
                      : "rounded-3xl bg-zinc-900 border border-zinc-800 p-4 md:p-5"
                  }
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <p className="text-lg md:text-xl font-bold">
                          {ticket.bilet_no}
                        </p>

                        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                          {durumEtiketi(ticket.durum)}
                        </span>

                        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                          {formatDateTime(ticket.randevu_tarihi)}
                        </span>

                        {isRefresh && (
                          <span className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs font-semibold text-yellow-200">
                            REFRESH İŞİ
                          </span>
                        )}

                        {ticket.garanti_kapsaminda && (
                          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-200">
                            GARANTİ
                          </span>
                        )}
                      </div>

                      <div className="mt-4 rounded-2xl bg-zinc-950 border border-zinc-800 p-4">
                        <p className="text-xs text-zinc-500">İş Bilgisi</p>
                        <p className="text-zinc-200 font-semibold mt-1">
                          {ticket.dovme_bolgesi}
                        </p>

                        <p className="text-xs text-zinc-500 mt-4">
                          Tasarımcı
                        </p>
                        <p className="text-zinc-400 text-sm mt-1">
                          {ticket.tasarimci?.full_name || "-"}
                        </p>
                      </div>

                      {isRefresh && sonRefresh && (
                        <div className="mt-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 p-4">
                          <p className="text-yellow-200 font-semibold">
                            Bu bilet refresh tarihiyle yeniden önüne düştü.
                          </p>

                          <p className="text-yellow-100/80 mt-2 text-sm">
                            Son refresh tarihi:{" "}
                            {formatOnlyDate(sonRefresh.refresh_tarihi)}
                          </p>

                          {sonRefresh.refresh_notu ? (
                            <p className="text-yellow-100/80 mt-1 text-sm">
                              Refresh notu: {sonRefresh.refresh_notu}
                            </p>
                          ) : (
                            <p className="text-yellow-100/60 mt-1 text-sm">
                              Refresh notu girilmemiş.
                            </p>
                          )}
                        </div>
                      )}

                      {ticket.tasarimci_notu && (
                        <div className="mt-4 rounded-2xl bg-zinc-950 border border-zinc-800 p-4">
                          <p className="text-sm font-semibold">
                            Tasarımcı Notu
                          </p>
                          <p className="text-zinc-400 mt-2 text-sm">
                            {ticket.tasarimci_notu}
                          </p>
                        </div>
                      )}

                      {ticket.dovme_gorseli_url && (
                        <img
                          src={ticket.dovme_gorseli_url}
                          alt="Dövme görseli"
                          className="mt-4 max-h-72 md:max-h-96 w-full rounded-xl object-contain bg-zinc-950 border border-zinc-800"
                        />
                      )}

                      {refreshler.length > 0 && (
                        <div className="mt-4 rounded-2xl bg-zinc-950 border border-zinc-800 p-4">
                          <p className="text-sm font-semibold mb-3">
                            Refresh Geçmişi
                          </p>

                          <div className="space-y-3">
                            {refreshler.map((refresh, index) => (
                              <div
                                key={refresh.id}
                                className="rounded-xl bg-zinc-900 border border-zinc-800 p-3"
                              >
                                <p className="text-sm font-semibold">
                                  Refresh #{index + 1}
                                </p>

                                <p className="text-zinc-400 text-sm mt-1">
                                  Tarih: {formatOnlyDate(refresh.refresh_tarihi)}
                                </p>

                                {refresh.refresh_notu ? (
                                  <p className="text-zinc-500 text-sm mt-1">
                                    Not: {refresh.refresh_notu}
                                  </p>
                                ) : (
                                  <p className="text-zinc-600 text-sm mt-1">
                                    Not girilmemiş.
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="min-w-full lg:min-w-[280px]">
                      <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4 md:p-5">
                        <p className="text-zinc-500 text-sm">
                          Fiyat Görünürlüğü
                        </p>

                        {fiyatGorunur ? (
                          <>
                            <p className="text-2xl font-bold mt-2">
                              {formatPrice(toplamUcret)}
                            </p>
                            <p className="text-xs text-zinc-500 mt-2">
                              İş “Yapıldı” olduğu için fiyat görünür.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-lg font-bold mt-2 text-zinc-400">
                              Fiyat gizli
                            </p>
                            <p className="text-xs text-zinc-500 mt-2">
                              {artistCanViewCompletedPrice
                                ? "İş “Yapıldı” olmadan fiyat bilgisi görünmez."
                                : "Admin bu panelde fiyat bilgisini gizledi."}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4 md:p-5 mt-4">
                        <p className="text-zinc-500 text-sm">Dövme Durumu</p>
                        <p className="text-zinc-200 font-semibold mt-2">
                          {durumEtiketi(ticket.durum)}
                        </p>
                        <p className="text-xs text-zinc-500 mt-2">
                          Durum güncellemesi tasarımcı panelinden yapılır.
                        </p>
                      </div>

                      {isRefresh && (
                        <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/30 p-4 md:p-5 mt-4">
                          <p className="text-yellow-200 font-semibold">
                            Refresh Takibi
                          </p>
                          <p className="text-yellow-100/80 text-sm mt-2">
                            Bu kayıt eski biletin refresh hareketidir. Müşteri
                            bilgileri gizli kalır.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
