"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import StudioPrintSettings from "@/components/StudioPrintSettings";
type UserRole = "admin" | "tasarimci" | "dovmeci";
type OdemeYontemi = "nakit" | "kart";
type OdemeFiltresi = "tum" | OdemeYontemi;

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
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
  randevu_tarihi: string;
  durum: string;
  garanti_kapsaminda: boolean;
  created_at: string;
  tasarimci_id: string;
  dovmeci_id: string;

  ticket_finances: Finance | Finance[] | null;
  ticket_payments: Payment[] | null;
  ticket_refreshes: TicketRefresh[] | null;
};

type UserEditState = {
  full_name: string;
  email: string;
  role: UserRole;
  password: string;
};

export default function AdminPanelPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("tasarimci");

  const [userEdits, setUserEdits] = useState<Record<string, UserEditState>>({});

  const [odemeYontemiFiltresi, setOdemeYontemiFiltresi] =
    useState<OdemeFiltresi>("tum");

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

    if (profileData.role !== "admin") {
      if (profileData.role === "dovmeci") {
        router.push("/dovmeci-panel");
        return;
      }

      router.push("/tasarimci-panel");
      return;
    }

    setProfile(profileData);

    const { data: usersData, error: usersError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, is_active")
      .order("full_name", { ascending: true });

    if (usersError) {
      console.error(usersError);
      setErrorMessage(usersError.message);
      setLoading(false);
      return;
    }

    const { data: ticketData, error: ticketError } = await supabase
      .from("tickets")
      .select(`
        id,
        bilet_no,
        dovme_bolgesi,
        randevu_tarihi,
        durum,
        garanti_kapsaminda,
        created_at,
        tasarimci_id,
        dovmeci_id,
        ticket_finances (
          toplam_ucret
        ),
        ticket_payments (
          id,
          odeme_tarihi,
          odeme_tutari,
          odeme_yontemi
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

    const cleanUsers = (usersData || []) as Profile[];
    const cleanTickets = (ticketData || []) as unknown as Ticket[];

    setUsers(cleanUsers);
    setTickets(cleanTickets);

    const editMap: Record<string, UserEditState> = {};

    cleanUsers.forEach((user) => {
      editMap[user.id] = {
        full_name: user.full_name || "",
        email: user.email || "",
        role: user.role,
        password: "",
      };
    });

    setUserEdits(editMap);
    setLoading(false);
  }

  function getSingle<T>(value: T | T[] | null): T | null {
    if (!value) return null;
    if (Array.isArray(value)) return value[0] || null;
    return value;
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

  function biletRefreshMi(ticket: Ticket) {
    return getRefreshler(ticket).length > 0;
  }

  function biletOdemeFiltresineUyuyor(ticket: Ticket) {
    if (odemeYontemiFiltresi === "tum") return true;

    return getPayments(ticket).some((payment) => {
      return getOdemeYontemi(payment) === odemeYontemiFiltresi;
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

  function formatPrice(value: number) {
    return `${value.toLocaleString("tr-TR")} TL`;
  }

  function roleLabel(role: UserRole) {
    if (role === "admin") return "Admin";
    if (role === "tasarimci") return "Tasarımcı";
    if (role === "dovmeci") return "Dövmeci";
    return role;
  }

  function durumEtiketi(durum: string) {
    if (durum === "randevu") return "Randevu";
    if (durum === "beklemede") return "Beklemede";
    if (durum === "yapildi") return "Yapıldı";
    if (durum === "iptal") return "İptal";
    return durum;
  }

  function odemeYontemiEtiketi(yontem: OdemeFiltresi) {
    if (yontem === "nakit") return "Nakit";
    if (yontem === "kart") return "Kart";
    return "Tüm ödemeler";
  }

  function odemeYontemiBadgeClass(yontem: OdemeYontemi) {
    if (yontem === "kart") {
      return "rounded-full bg-purple-500/10 border border-purple-500/30 px-3 py-1 text-xs font-semibold text-purple-200";
    }

    return "rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-200";
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

  async function getAccessToken() {
    const supabase = createClient();

    const { data: sessionData } = await supabase.auth.getSession();

    return sessionData.session?.access_token || "";
  }

  async function readApiResponse(response: Response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const token = await getAccessToken();

    if (!token) {
      setErrorMessage("Oturum bulunamadı. Tekrar giriş yapmalısın.");
      setSaving(false);
      return;
    }

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        full_name: newFullName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
      }),
    });

    const result = await readApiResponse(response);

    if (!response.ok) {
      setErrorMessage(
        result?.error || result?.message || "Kullanıcı oluşturulamadı."
      );
      setSaving(false);
      return;
    }

    setNewFullName("");
    setNewEmail("");
    setNewPassword("");
    setNewRole("tasarimci");

    setSuccessMessage("Kullanıcı başarıyla oluşturuldu.");
    setSaving(false);

    await loadData();
  }

  function updateUserEdit<K extends keyof UserEditState>(
    userId: string,
    field: K,
    value: UserEditState[K]
  ) {
    setUserEdits((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
      },
    }));
  }

  async function updateUserInfo(user: Profile) {
    const edit = userEdits[user.id];

    if (!edit) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const token = await getAccessToken();

    if (!token) {
      setErrorMessage("Oturum bulunamadı. Tekrar giriş yapmalısın.");
      setSaving(false);
      return;
    }

    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        full_name: edit.full_name.trim(),
        email: edit.email.trim().toLowerCase(),
        role: edit.role,
      }),
    });

    const result = await readApiResponse(response);

    if (!response.ok) {
      setErrorMessage(
        result?.error || result?.message || "Kullanıcı güncellenemedi."
      );
      setSaving(false);
      return;
    }

    setSuccessMessage("Kullanıcı bilgileri güncellendi.");
    setSaving(false);

    await loadData();
  }

  async function updateUserPassword(user: Profile) {
    const edit = userEdits[user.id];

    if (!edit?.password) {
      setErrorMessage("Yeni şifre alanı boş olamaz.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const token = await getAccessToken();

    if (!token) {
      setErrorMessage("Oturum bulunamadı. Tekrar giriş yapmalısın.");
      setSaving(false);
      return;
    }

    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        password: edit.password,
      }),
    });

    const result = await readApiResponse(response);

    if (!response.ok) {
      setErrorMessage(
        result?.error || result?.message || "Şifre değiştirilemedi."
      );
      setSaving(false);
      return;
    }

    setSuccessMessage("Kullanıcı şifresi güncellendi.");
    setSaving(false);

    await loadData();
  }

  async function toggleUserActive(user: Profile) {
    if (user.id === profile?.id) {
      setErrorMessage("Kendi hesabını pasif yapamazsın.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const token = await getAccessToken();

    if (!token) {
      setErrorMessage("Oturum bulunamadı. Tekrar giriş yapmalısın.");
      setSaving(false);
      return;
    }

    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        is_active: !user.is_active,
      }),
    });

    const result = await readApiResponse(response);

    if (!response.ok) {
      setErrorMessage(
        result?.error || result?.message || "Kullanıcı durumu değiştirilemedi."
      );
      setSaving(false);
      return;
    }

    setSuccessMessage(
      user.is_active
        ? "Kullanıcı pasif hale getirildi."
        : "Kullanıcı aktif hale getirildi."
    );
    setSaving(false);

    await loadData();
  }

  async function deleteUser(user: Profile) {
    if (user.id === profile?.id) {
      setErrorMessage("Kendi hesabını silemezsin.");
      return;
    }

    const confirmed = window.confirm(
      `${user.full_name} adlı kullanıcıyı silmek istediğine emin misin? Eğer bu kullanıcıya bağlı bilet varsa silme işlemi engellenebilir.`
    );

    if (!confirmed) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const token = await getAccessToken();

    if (!token) {
      setErrorMessage("Oturum bulunamadı. Tekrar giriş yapmalısın.");
      setSaving(false);
      return;
    }

    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await readApiResponse(response);

    if (!response.ok) {
      setErrorMessage(
        result?.error ||
          result?.message ||
          "Kullanıcı silinemedi. Kullanıcıya bağlı bilet olabilir."
      );
      setSaving(false);
      return;
    }

    setSuccessMessage("Kullanıcı silindi.");
    setSaving(false);

    await loadData();
  }

  const filtrelenmisTickets = useMemo(() => {
    return tickets.filter((ticket) => biletOdemeFiltresineUyuyor(ticket));
  }, [tickets, odemeYontemiFiltresi]);

  const aktifKullanicilar = users.filter((user) => user.is_active);
  const adminler = users.filter((user) => user.role === "admin");
  const tasarimcilar = users.filter((user) => user.role === "tasarimci");
  const dovmeciler = users.filter((user) => user.role === "dovmeci");

  const yapilanIsler = filtrelenmisTickets.filter(
    (ticket) => ticket.durum === "yapildi"
  );

  const bekleyenIsler = filtrelenmisTickets.filter((ticket) => {
    return ticket.durum === "randevu" || ticket.durum === "beklemede";
  });

  const iptalIsler = filtrelenmisTickets.filter(
    (ticket) => ticket.durum === "iptal"
  );

  const refreshliIsler = filtrelenmisTickets.filter((ticket) =>
    biletRefreshMi(ticket)
  );

  const garantiIsler = filtrelenmisTickets.filter(
    (ticket) => ticket.garanti_kapsaminda
  );

  const toplamUcret = filtrelenmisTickets.reduce((total, ticket) => {
    return total + Number(getFinance(ticket)?.toplam_ucret || 0);
  }, 0);

  const toplamAlinan = filtrelenmisTickets.reduce((total, ticket) => {
    return total + getTicketAlinan(ticket, odemeYontemiFiltresi);
  }, 0);

  const toplamAlinanGenel = filtrelenmisTickets.reduce((total, ticket) => {
    return total + getTicketAlinan(ticket, "tum");
  }, 0);

  const toplamNakit = filtrelenmisTickets.reduce((total, ticket) => {
    return total + getTicketNakit(ticket);
  }, 0);

  const toplamKart = filtrelenmisTickets.reduce((total, ticket) => {
    return total + getTicketKart(ticket);
  }, 0);

  const toplamKalan = toplamUcret - toplamAlinanGenel;

  const tasarimciOzetleri = useMemo(() => {
    return tasarimcilar.map((tasarimci) => {
      const tasarimciTickets = filtrelenmisTickets.filter((ticket) => {
        return ticket.tasarimci_id === tasarimci.id;
      });

      const ucret = tasarimciTickets.reduce((total, ticket) => {
        return total + Number(getFinance(ticket)?.toplam_ucret || 0);
      }, 0);

      const alinan = tasarimciTickets.reduce((total, ticket) => {
        return total + getTicketAlinan(ticket, odemeYontemiFiltresi);
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
        refresh: tasarimciTickets.filter((ticket) => biletRefreshMi(ticket))
          .length,
        ucret,
        alinan,
        nakit,
        kart,
        kalan: ucret - alinanGenel,
      };
    });
  }, [tasarimcilar, filtrelenmisTickets, odemeYontemiFiltresi]);

  const dovmeciOzetleri = useMemo(() => {
    return dovmeciler.map((dovmeci) => {
      const dovmeciTickets = filtrelenmisTickets.filter((ticket) => {
        return ticket.dovmeci_id === dovmeci.id;
      });

      const yapilanDovmeciIsleri = dovmeciTickets.filter((ticket) => {
        return ticket.durum === "yapildi";
      });

      const ucret = yapilanDovmeciIsleri.reduce((total, ticket) => {
        return total + Number(getFinance(ticket)?.toplam_ucret || 0);
      }, 0);

      return {
        id: dovmeci.id,
        full_name: dovmeci.full_name,
        biletSayisi: dovmeciTickets.length,
        yapilan: yapilanDovmeciIsleri.length,
        bekleyen: dovmeciTickets.filter((ticket) => {
          return ticket.durum === "randevu" || ticket.durum === "beklemede";
        }).length,
        refresh: dovmeciTickets.filter((ticket) => biletRefreshMi(ticket))
          .length,
        ucret,
      };
    });
  }, [dovmeciler, filtrelenmisTickets]);

  const sonBiletler = useMemo(() => {
    return [...filtrelenmisTickets]
      .sort((a, b) => {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      })
      .slice(0, 6);
  }, [filtrelenmisTickets]);

  if (loading) {
    return (
      <main className="min-h-screen elegant-page text-white flex items-center justify-center p-4 md:p-6">
        <div className="rounded-[2rem] elegant-card p-6 md:p-8">
          <h1 className="text-2xl font-bold">Admin paneli yükleniyor...</h1>
          <p className="text-zinc-400 mt-2 text-sm md:text-base">
            Kullanıcılar, biletler ve finansal özetler hazırlanıyor.
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
            Yönetim paneli
          </p>

          <h1 className="text-3xl md:text-4xl font-black mt-4">
            Admin Paneli
          </h1>

          <p className="text-zinc-400 mt-2 text-sm md:text-base">
            Kullanıcıları, rolleri, şifreleri, biletleri, ciroyu, ödeme
            yöntemlerini, garanti ve refresh durumlarını yönet.
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

        {successMessage && (
          <div className="rounded-3xl bg-emerald-500/10 border border-emerald-500/30 p-4 md:p-5 mb-6">
            <p className="text-emerald-200 font-semibold">Başarılı</p>
            <p className="text-emerald-100/80 mt-2 text-sm">{successMessage}</p>
          </div>
        )}

        <StudioPrintSettings />
        
        <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black">
                Ödeme Filtresi
              </h2>
              <p className="text-zinc-500 text-sm mt-1">
                Nakit veya kart seçerek admin özetlerini ödeme yöntemine göre
                süzebilirsin.
              </p>
            </div>

            <div className="w-full md:w-72">
              <label className="block text-sm text-zinc-400 mb-2">
                Ödeme Yöntemi
              </label>
              <select
                value={odemeYontemiFiltresi}
                onChange={(event) =>
                  setOdemeYontemiFiltresi(event.target.value as OdemeFiltresi)
                }
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="tum">Tüm ödemeler</option>
                <option value="nakit">Nakit</option>
                <option value="kart">Kart</option>
              </select>
            </div>
          </div>

          <div className="rounded-2xl elegant-card-soft p-4 mt-5">
            <p className="text-sm text-zinc-400">
              Aktif filtre:{" "}
              <span className="font-bold text-white">
                {odemeYontemiEtiketi(odemeYontemiFiltresi)}
              </span>
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl md:text-2xl font-black mb-4">Genel Özet</h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Toplam Bilet</p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {filtrelenmisTickets.length}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Toplam Ciro</p>
              <p className="text-lg md:text-2xl font-bold mt-2">
                {formatPrice(toplamUcret)}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">
                {odemeYontemiFiltresi === "tum"
                  ? "Toplam Alınan"
                  : `${odemeYontemiEtiketi(odemeYontemiFiltresi)} Alınan`}
              </p>
              <p className="text-lg md:text-2xl font-bold mt-2">
                {formatPrice(toplamAlinan)}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Toplam Kalan</p>
              <p className="text-lg md:text-2xl font-bold mt-2">
                {formatPrice(toplamKalan)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Yapılan İş</p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {yapilanIsler.length}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Bekleyen İş</p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {bekleyenIsler.length}
              </p>
            </div>

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

            <div className="rounded-2xl elegant-card p-4 md:p-5 col-span-2 lg:col-span-1">
              <p className="text-zinc-400 text-xs md:text-sm">Refresh</p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {refreshliIsler.length}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mt-4">
            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">İptal</p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {iptalIsler.length}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Garanti</p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {garantiIsler.length}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5 col-span-2 lg:col-span-1">
              <p className="text-zinc-400 text-xs md:text-sm">
                Gerçek Toplam Alınan
              </p>
              <p className="text-lg md:text-2xl font-bold mt-2">
                {formatPrice(toplamAlinanGenel)}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl md:text-2xl font-black mb-4">
            Kullanıcı Özeti
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Aktif Kullanıcı</p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {aktifKullanicilar.length}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Admin</p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {adminler.length}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Tasarımcı</p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {tasarimcilar.length}
              </p>
            </div>

            <div className="rounded-2xl elegant-card p-4 md:p-5">
              <p className="text-zinc-400 text-xs md:text-sm">Dövmeci</p>
              <p className="text-2xl md:text-3xl font-bold mt-2">
                {dovmeciler.length}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-black mb-4">
            Yeni Kullanıcı Oluştur
          </h2>

          <form
            onSubmit={handleCreateUser}
            className="grid grid-cols-1 md:grid-cols-5 gap-4"
          >
            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Ad Soyad
              </label>
              <input
                value={newFullName}
                onChange={(event) => setNewFullName(event.target.value)}
                required
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                placeholder="Ad Soyad"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                E-posta
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                required
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                placeholder="ornek@tattoo.com"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Şifre</label>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                minLength={6}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                placeholder="En az 6 karakter"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Rol</label>
              <select
                value={newRole}
                onChange={(event) => setNewRole(event.target.value as UserRole)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              >
                <option value="admin">Admin</option>
                <option value="tasarimci">Tasarımcı</option>
                <option value="dovmeci">Dövmeci</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl elegant-button-gold px-4 py-4 font-black transition disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Kullanıcı Oluştur"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-black mb-4">
            Kullanıcı Yönetimi
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {users.map((user) => {
              const edit = userEdits[user.id];
              const isCurrentUser = user.id === profile?.id;

              return (
                <div
                  key={user.id}
                  className="rounded-3xl elegant-card-soft p-4 md:p-5"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <p className="font-bold text-lg">{user.full_name}</p>

                    <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                      {roleLabel(user.role)}
                    </span>

                    {user.is_active ? (
                      <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-200">
                        Aktif
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-500/10 border border-red-500/30 px-3 py-1 text-xs text-red-200">
                        Pasif
                      </span>
                    )}

                    {isCurrentUser && (
                      <span className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs text-yellow-200">
                        Sen
                      </span>
                    )}
                  </div>

                  <p className="text-zinc-500 text-sm mb-4">{user.email}</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">
                        Ad Soyad
                      </label>
                      <input
                        value={edit?.full_name || ""}
                        onChange={(event) =>
                          updateUserEdit(
                            user.id,
                            "full_name",
                            event.target.value
                          )
                        }
                        className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">
                        E-posta
                      </label>
                      <input
                        type="email"
                        value={edit?.email || ""}
                        onChange={(event) =>
                          updateUserEdit(user.id, "email", event.target.value)
                        }
                        className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">
                        Rol
                      </label>
                      <select
                        value={edit?.role || user.role}
                        onChange={(event) =>
                          updateUserEdit(
                            user.id,
                            "role",
                            event.target.value as UserRole
                          )
                        }
                        disabled={isCurrentUser}
                        className="w-full rounded-2xl elegant-input px-4 py-4 text-white disabled:opacity-50"
                      >
                        <option value="admin">Admin</option>
                        <option value="tasarimci">Tasarımcı</option>
                        <option value="dovmeci">Dövmeci</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateUserInfo(user)}
                    disabled={saving}
                    className="mt-4 w-full rounded-2xl elegant-button-gold px-4 py-4 font-black transition disabled:opacity-50"
                  >
                    Bilgileri Güncelle
                  </button>

                  <div className="mt-4">
                    <label className="block text-sm text-zinc-400 mb-2">
                      Yeni Şifre
                    </label>
                    <input
                      type="password"
                      value={edit?.password || ""}
                      onChange={(event) =>
                        updateUserEdit(user.id, "password", event.target.value)
                      }
                      className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                      placeholder="Yeni şifre"
                    />

                    <button
                      type="button"
                      onClick={() => updateUserPassword(user)}
                      disabled={saving}
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 font-semibold text-white hover:bg-white/10 transition disabled:opacity-50"
                    >
                      Şifreyi Değiştir
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => toggleUserActive(user)}
                      disabled={saving || isCurrentUser}
                      className={
                        user.is_active
                          ? "rounded-2xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 px-4 py-4 font-semibold hover:bg-yellow-500/20 transition disabled:opacity-50"
                          : "rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 px-4 py-4 font-semibold hover:bg-emerald-500/20 transition disabled:opacity-50"
                      }
                    >
                      {user.is_active ? "Pasif Yap" : "Aktif Yap"}
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteUser(user)}
                      disabled={saving || isCurrentUser}
                      className="rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-4 font-semibold hover:bg-red-500/20 transition disabled:opacity-50"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-black mb-4">
            Tasarımcı Özeti
          </h2>

          {tasarimciOzetleri.length === 0 ? (
            <div className="rounded-3xl elegant-card-soft p-4 md:p-5 text-zinc-400">
              Henüz tasarımcı bulunmuyor.
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
                    <div className="rounded-2xl elegant-card p-3">
                      <p className="text-zinc-500 text-xs">Bilet</p>
                      <p className="font-bold mt-1">{item.biletSayisi}</p>
                    </div>

                    <div className="rounded-2xl elegant-card p-3">
                      <p className="text-zinc-500 text-xs">Yapılan</p>
                      <p className="font-bold mt-1">{item.yapilan}</p>
                    </div>

                    <div className="rounded-2xl elegant-card p-3">
                      <p className="text-zinc-500 text-xs">Refresh</p>
                      <p className="font-bold mt-1">{item.refresh}</p>
                    </div>

                    <div className="rounded-2xl elegant-card p-3">
                      <p className="text-zinc-500 text-xs">Kalan</p>
                      <p className="font-bold mt-1">
                        {formatPrice(item.kalan)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <div className="rounded-2xl elegant-card p-3">
                      <p className="text-zinc-500 text-xs">Ciro</p>
                      <p className="font-bold mt-1">{formatPrice(item.ucret)}</p>
                    </div>

                    <div className="rounded-2xl elegant-card p-3">
                      <p className="text-zinc-500 text-xs">
                        {odemeYontemiFiltresi === "tum"
                          ? "Alınan"
                          : odemeYontemiEtiketi(odemeYontemiFiltresi)}
                      </p>
                      <p className="font-bold mt-1">
                        {formatPrice(item.alinan)}
                      </p>
                    </div>

                    <div className="rounded-2xl elegant-card p-3">
                      <p className="text-zinc-500 text-xs">Nakit</p>
                      <p className="font-bold mt-1">
                        {formatPrice(item.nakit)}
                      </p>
                    </div>

                    <div className="rounded-2xl elegant-card p-3">
                      <p className="text-zinc-500 text-xs">Kart</p>
                      <p className="font-bold mt-1">
                        {formatPrice(item.kart)}
                      </p>
                    </div>
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
            <div className="rounded-3xl elegant-card-soft p-4 md:p-5 text-zinc-400">
              Henüz dövmeci bulunmuyor.
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
                    <div className="rounded-2xl elegant-card p-3">
                      <p className="text-zinc-500 text-xs">İş</p>
                      <p className="font-bold mt-1">{item.biletSayisi}</p>
                    </div>

                    <div className="rounded-2xl elegant-card p-3">
                      <p className="text-zinc-500 text-xs">Yapılan</p>
                      <p className="font-bold mt-1">{item.yapilan}</p>
                    </div>

                    <div className="rounded-2xl elegant-card p-3">
                      <p className="text-zinc-500 text-xs">Bekleyen</p>
                      <p className="font-bold mt-1">{item.bekleyen}</p>
                    </div>

                    <div className="rounded-2xl elegant-card p-3">
                      <p className="text-zinc-500 text-xs">Refresh</p>
                      <p className="font-bold mt-1">{item.refresh}</p>
                    </div>

                    <div className="rounded-2xl elegant-card p-3 col-span-2 md:col-span-1">
                      <p className="text-zinc-500 text-xs">Ciro</p>
                      <p className="font-bold mt-1">{formatPrice(item.ucret)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] elegant-card p-4 md:p-6">
          <h2 className="text-xl md:text-2xl font-black mb-4">
            Son Oluşturulan Biletler
          </h2>

          {sonBiletler.length === 0 ? (
            <div className="rounded-3xl elegant-card-soft p-4 md:p-5 text-zinc-400">
              Seçili ödeme filtresine uygun bilet bulunamadı.
            </div>
          ) : (
            <div className="space-y-3">
              {sonBiletler.map((ticket) => {
                const toplam = Number(getFinance(ticket)?.toplam_ucret || 0);
                const alinan = getTicketAlinan(ticket, "tum");
                const nakit = getTicketNakit(ticket);
                const kart = getTicketKart(ticket);
                const kalan = toplam - alinan;

                return (
                  <a
                    key={ticket.id}
                    href={`/biletler/${ticket.id}`}
                    className={
                      biletRefreshMi(ticket)
                        ? "block rounded-3xl bg-zinc-950 border border-yellow-500/30 p-4 hover:border-yellow-400 transition"
                        : "block rounded-3xl elegant-card-soft p-4 transition hover:border-yellow-500/30"
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                      <p className="font-bold">{ticket.bilet_no}</p>

                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                        {durumEtiketi(ticket.durum)}
                      </span>

                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                        {formatDate(ticket.randevu_tarihi)}
                      </span>

                      {biletRefreshMi(ticket) && (
                        <span className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs font-semibold text-yellow-200">
                          REFRESH
                        </span>
                      )}

                      {ticket.garanti_kapsaminda && (
                        <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-200">
                          GARANTİ
                        </span>
                      )}

                      {nakit > 0 && (
                        <span className={odemeYontemiBadgeClass("nakit")}>
                          Nakit: {formatPrice(nakit)}
                        </span>
                      )}

                      {kart > 0 && (
                        <span className={odemeYontemiBadgeClass("kart")}>
                          Kart: {formatPrice(kart)}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mt-4">
                      <div className="rounded-2xl elegant-card p-3">
                        <p className="text-zinc-500 text-xs">Toplam</p>
                        <p className="font-bold mt-1 text-sm md:text-base">
                          {formatPrice(toplam)}
                        </p>
                      </div>

                      <div className="rounded-2xl elegant-card p-3">
                        <p className="text-zinc-500 text-xs">Alınan</p>
                        <p className="font-bold mt-1 text-sm md:text-base">
                          {formatPrice(alinan)}
                        </p>
                      </div>

                      <div className="rounded-2xl elegant-card p-3">
                        <p className="text-zinc-500 text-xs">Nakit / Kart</p>
                        <p className="font-bold mt-1 text-sm md:text-base">
                          {formatPrice(nakit)} / {formatPrice(kart)}
                        </p>
                      </div>

                      <div className="rounded-2xl elegant-card p-3">
                        <p className="text-zinc-500 text-xs">Kalan</p>
                        <p className="font-bold mt-1 text-sm md:text-base">
                          {formatPrice(kalan)}
                        </p>
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