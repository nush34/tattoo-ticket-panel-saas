"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

export default function TasarimciPanelPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();

      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session?.user) {
        router.push("/login");
        return;
      }

      const userId = sessionData.session.user.id;

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active")
        .eq("id", userId)
        .single<Profile>();

      if (profileError || !profileData) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      if (!profileData.is_active) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      if (profileData.role === "dovmeci") {
        router.push("/dovmeci-panel");
        return;
      }

      setProfile(profileData);

      const { data: ticketData, error: ticketError } = await supabase
        .from("tickets")
        .select(`
          id,
          bilet_no,
          dovme_bolgesi,
          dovme_gorseli_url,
          randevu_tarihi,
          durum,
          tasarimci_notu,
          garanti_kapsaminda,
          created_at,
          tasarimci_id,
          dovmeci_id,
          tasarimci:profiles!tickets_tasarimci_id_fkey (
            full_name,
            email
          ),
          dovmeci:profiles!tickets_dovmeci_id_fkey (
            full_name,
            email
          ),
          ticket_customers (
            musteri_ad_soyad,
            musteri_telefon
          ),
          ticket_finances (
            toplam_ucret
          ),
          ticket_payments (
            id,
            odeme_tarihi,
            odeme_tutari
          ),
          ticket_refreshes (
            id,
            ticket_id,
            refresh_tarihi,
            refresh_notu,
            created_by,
            created_at
          )
        `)
        .order("created_at", { ascending: false });

      if (ticketError) {
        console.error(ticketError);
        setErrorMessage(ticketError.message);
        setLoading(false);
        return;
      }

      setTickets((ticketData || []) as unknown as Ticket[]);
      setLoading(false);
    }

    loadData();
  }, [router]);

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

  const benimBiletlerim = useMemo(() => {
    if (!profile) return [];

    if (profile.role === "admin") {
      return tickets;
    }

    return tickets.filter((ticket) => ticket.tasarimci_id === profile.id);
  }, [tickets, profile]);

  const bugunkuRandevularim = useMemo(() => {
    return benimBiletlerim.filter((ticket) => {
      return ayniGunMu(ticket.randevu_tarihi, new Date());
    });
  }, [benimBiletlerim]);

  const yapilanIslerim = useMemo(() => {
    return benimBiletlerim.filter((ticket) => ticket.durum === "yapildi");
  }, [benimBiletlerim]);

  const bekleyenIslerim = useMemo(() => {
    return benimBiletlerim.filter((ticket) => {
      return ticket.durum === "randevu" || ticket.durum === "beklemede";
    });
  }, [benimBiletlerim]);

  const iptalIslerim = useMemo(() => {
    return benimBiletlerim.filter((ticket) => ticket.durum === "iptal");
  }, [benimBiletlerim]);

  const refreshliIslerim = useMemo(() => {
    return benimBiletlerim.filter((ticket) => biletRefreshMi(ticket));
  }, [benimBiletlerim]);

  const garantiKapsamindakiIslerim = useMemo(() => {
    return benimBiletlerim.filter((ticket) => ticket.garanti_kapsaminda);
  }, [benimBiletlerim]);

  const benimToplamUcretim = useMemo(() => {
    return benimBiletlerim.reduce((total, ticket) => {
      return total + Number(getFinance(ticket)?.toplam_ucret || 0);
    }, 0);
  }, [benimBiletlerim]);

  const benimToplamAlinan = useMemo(() => {
    return benimBiletlerim.reduce((total, ticket) => {
      return total + getTicketAlinan(ticket);
    }, 0);
  }, [benimBiletlerim]);

  const benimToplamKalan = benimToplamUcretim - benimToplamAlinan;

  const benimSonSatislarim = useMemo(() => {
    return [...benimBiletlerim]
      .sort((a, b) => {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      })
      .slice(0, 5);
  }, [benimBiletlerim]);

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

    return benimBiletlerim
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
  }, [benimBiletlerim]);

  const isAdmin = profile?.role === "admin";

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

          {!isAdmin && (
            <p className="text-yellow-200 mt-2 text-xs md:text-sm">
              Ciro, alınan ve kalan ücret hesapları sadece senin satışlarından
              hesaplanır.
            </p>
          )}

          {isAdmin && (
            <p className="text-yellow-200 mt-2 text-xs md:text-sm">
              Admin olarak bu panelde tüm biletlerin özetini görüyorsun.
            </p>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 md:p-5 mb-6">
            <p className="text-red-200 font-semibold">Supabase Hatası</p>
            <p className="text-red-100/80 mt-2 text-sm">{errorMessage}</p>
          </div>
        )}

        <section className="mb-8">
          <h2 className="text-xl md:text-2xl font-bold mb-4">
            {isAdmin ? "Genel Özet" : "Benim Özetim"}
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">
                {isAdmin ? "Bilet Sayısı" : "Benim Bilet Sayım"}
              </p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {benimBiletlerim.length}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">
                {isAdmin ? "Ciro" : "Benim Ciro"}
              </p>
              <p className="text-lg md:text-2xl font-bold mt-2">
                {formatPrice(benimToplamUcretim)}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">
                {isAdmin ? "Alınan" : "Benim Alınan"}
              </p>
              <p className="text-lg md:text-2xl font-bold mt-2">
                {formatPrice(benimToplamAlinan)}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">
                {isAdmin ? "Kalan" : "Benim Kalan"}
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
            {isAdmin ? "Son Satışlar" : "Benim Son Satışlarım"}
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
                          Bölge: {ticket.dovme_bolgesi}
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
          <h2 className="text-xl md:text-2xl font-bold mb-4">
            Son Oluşturulan Biletler
          </h2>

          <p className="text-zinc-400 mb-5 text-sm md:text-base">
            Tasarımcılar tüm biletleri görebilir. Sana ait olmayan biletler
            ciro hesabına dahil edilmez.
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
                  profile?.role === "admin" ||
                  ticket.tasarimci_id === profile?.id;

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
                          Benim satışım
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