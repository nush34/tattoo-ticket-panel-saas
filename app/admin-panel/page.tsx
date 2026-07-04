"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import {
  CurrentStudio,
  StudioStaffMember,
  getCurrentStudio,
  getPanelPathByRole,
  getStudioStaff,
} from "../../lib/saas/studio";
import {
  createStudioMember,
  updateStudioMember,
} from "../../lib/saas/members";

type UserRole = "owner" | "admin" | "tasarimci" | "dovmeci";
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

type AdminPanelTicketRow = {
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
  source: "kapi_musterisi" | "sosyal_medya" | "diger";
  payments: Payment[] | null;
  refreshes: TicketRefresh[] | null;
};

type UserEditState = {
  full_name: string;
  email: string;
  role: UserRole;
  password: string;
};

function studioRoleToOldRole(
  role: CurrentStudio["role"] | StudioStaffMember["role"]
): UserRole {
  if (role === "owner") return "owner";
  if (role === "artist") return "dovmeci";
  if (role === "designer") return "tasarimci";
  return "admin";
}

function oldRoleToSaasRole(role: UserRole): "admin" | "designer" | "artist" {
  if (role === "dovmeci") return "artist";
  if (role === "tasarimci") return "designer";
  return "admin";
}

function statusToOldStatus(status: AdminPanelTicketRow["status"]) {
  if (status === "bekliyor") return "beklemede";
  if (status === "yapildi") return "yapildi";
  if (status === "iptal") return "iptal";
  return "beklemede";
}

export default function AdminPanelPage() {
  const router = useRouter();

  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingTicketId, setDeletingTicketId] = useState<string | null>(null);

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

    if (currentStudio.role !== "owner" && currentStudio.role !== "admin") {
      router.push(getPanelPathByRole(currentStudio.role));
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

    const cleanUsers: Profile[] = staffList.map((member) => ({
      id: member.member_id,
      full_name: member.full_name,
      email: member.email || "",
      role: studioRoleToOldRole(member.role),
      is_active: member.is_active,
    }));

    setUsers(cleanUsers);

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

    const { data: adminTicketData, error: ticketError } = await supabase.rpc(
      "get_admin_panel_tickets",
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
      (adminTicketData || []) as AdminPanelTicketRow[]
    ).map((ticket) => ({
      id: ticket.ticket_id,
      bilet_no: ticket.ticket_no,
      dovme_bolgesi: ticket.customer_name || "-",
      randevu_tarihi: ticket.tattoo_date,
      durum: statusToOldStatus(ticket.status),
      garanti_kapsaminda: ticket.has_guarantee,
      created_at: ticket.created_at,
      tasarimci_id: ticket.designer_member_id || "",
      dovmeci_id: ticket.artist_member_id || "",
      ticket_finances: {
        toplam_ucret: Number(ticket.price || 0),
      },
      ticket_payments: ticket.payments || [],
      ticket_refreshes: ticket.refreshes || [],
    }));

    setTickets(cleanTickets);
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
    if (role === "owner") return "Owner";
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

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!studio) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const result = await createStudioMember({
      studioId: studio.studio_id,
      fullName: newFullName.trim(),
      email: newEmail.trim().toLowerCase(),
      password: newPassword,
      role: oldRoleToSaasRole(newRole),
    });

    if (result.error) {
      setErrorMessage(result.error || "Kullanıcı oluşturulamadı.");
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

  async function updateUserInfo(userId: string) {
    if (!studio) return;

    const edit = userEdits[userId];

    if (!edit) return;

    if (edit.role === "owner") {
      setErrorMessage(
        "Owner kullanıcının bilgileri bu ekrandan değiştirilemez."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const result = await updateStudioMember({
      studioId: studio.studio_id,
      memberId: userId,
      action: "update_info",
      fullName: edit.full_name,
      email: edit.email,
      role: oldRoleToSaasRole(edit.role),
    });

    if (result.error) {
      setErrorMessage(result.error);
      setSaving(false);
      return;
    }

    setSuccessMessage("Kullanıcı bilgileri güncellendi.");
    setSaving(false);

    await loadData();
  }

  async function updateUserPassword(userId: string) {
    if (!studio) return;

    const edit = userEdits[userId];

    if (!edit) return;

    if (!edit.password || edit.password.length < 6) {
      setErrorMessage("Yeni şifre en az 6 karakter olmalı.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const result = await updateStudioMember({
      studioId: studio.studio_id,
      memberId: userId,
      action: "update_password",
      password: edit.password,
    });

    if (result.error) {
      setErrorMessage(result.error);
      setSaving(false);
      return;
    }

    setSuccessMessage("Kullanıcı şifresi güncellendi.");
    setSaving(false);

    await loadData();
  }

  async function toggleUserActive(userId: string, nextActive: boolean) {
    if (!studio) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const result = await updateStudioMember({
      studioId: studio.studio_id,
      memberId: userId,
      action: "set_active",
      isActive: nextActive,
    });

    if (result.error) {
      setErrorMessage(result.error);
      setSaving(false);
      return;
    }

    setSuccessMessage(
      nextActive ? "Kullanıcı aktif edildi." : "Kullanıcı pasif yapıldı."
    );
    setSaving(false);

    await loadData();
  }

  async function deleteUser(userId: string) {
    if (!studio) return;

    const confirmed = window.confirm(
      "Bu kullanıcı güvenli şekilde pasif yapılacak. Eski bilet bağlantıları korunacak. Devam edilsin mi?"
    );

    if (!confirmed) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const result = await updateStudioMember({
      studioId: studio.studio_id,
      memberId: userId,
      action: "delete_member",
    });

    if (result.error) {
      setErrorMessage(result.error);
      setSaving(false);
      return;
    }

    setSuccessMessage("Kullanıcı pasif yapıldı.");
    setSaving(false);

    await loadData();
  }

  async function handleDeleteTicket(ticketId: string) {
    if (!studio || !profile) return;

    if (profile.role !== "owner" && profile.role !== "admin") {
      setErrorMessage("Bu bileti silme yetkiniz yok.");
      return;
    }

    const confirmed = window.confirm(
      "Bu bileti tamamen silmek istediğine emin misin?\n\n" +
        "Bilete bağlı ödeme, refresh ve fiyat değişikliği kayıtları da silinecek. " +
        "Bu işlem geri alınamaz."
    );

    if (!confirmed) return;

    setDeletingTicketId(ticketId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc("admin_delete_ticket", {
        target_ticket_id: ticketId,
      });

      if (error) {
        throw new Error(error.message);
      }

      await loadData();
      setSuccessMessage("Bilet ve bağlı kayıtları başarıyla silindi.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Bilet silinemedi.";
      setErrorMessage(message);
    } finally {
      setDeletingTicketId(null);
    }
  }

  const filtrelenmisTickets = useMemo(() => {
    return tickets.filter((ticket) => biletOdemeFiltresineUyuyor(ticket));
  }, [tickets, odemeYontemiFiltresi]);

  const aktifKullanicilar = users.filter((user) => user.is_active);
  const adminler = users.filter(
    (user) => user.role === "owner" || user.role === "admin"
  );
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
      <>
        

        <main className="min-h-screen elegant-page text-white flex items-center justify-center p-4 md:p-6">
          <div className="rounded-[2rem] elegant-card p-6 md:p-8">
            <h1 className="text-2xl font-bold">Admin paneli yükleniyor...</h1>
            <p className="text-zinc-400 mt-2 text-sm md:text-base">
              Kullanıcılar, biletler ve finansal özetler hazırlanıyor.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      

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

          {successMessage && (
            <div className="rounded-3xl bg-emerald-500/10 border border-emerald-500/30 p-4 md:p-5 mb-6">
              <p className="text-emerald-200 font-semibold">Başarılı</p>
              <p className="text-emerald-100/80 mt-2 text-sm">
                {successMessage}
              </p>
            </div>
          )}

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
                <p className="text-zinc-400 text-xs md:text-sm">
                  Aktif Kullanıcı
                </p>
                <p className="text-2xl md:text-3xl font-bold mt-2">
                  {aktifKullanicilar.length}
                </p>
              </div>

              <div className="rounded-2xl elegant-card p-4 md:p-5">
                <p className="text-zinc-400 text-xs md:text-sm">Admin/Owner</p>
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
                <label className="block text-sm text-zinc-400 mb-2">
                  Şifre
                </label>
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
                  onChange={(event) =>
                    setNewRole(event.target.value as UserRole)
                  }
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
                const isOwner = user.role === "owner";

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
                          disabled={isOwner}
                          className="w-full rounded-2xl elegant-input px-4 py-4 text-white disabled:opacity-50"
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
                          disabled={isOwner}
                          className="w-full rounded-2xl elegant-input px-4 py-4 text-white disabled:opacity-50"
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
                          disabled={isCurrentUser || isOwner}
                          className="w-full rounded-2xl elegant-input px-4 py-4 text-white disabled:opacity-50"
                        >
                          {isOwner && <option value="owner">Owner</option>}
                          <option value="admin">Admin</option>
                          <option value="tasarimci">Tasarımcı</option>
                          <option value="dovmeci">Dövmeci</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateUserInfo(user.id)}
                      disabled={saving || isOwner}
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
                          updateUserEdit(
                            user.id,
                            "password",
                            event.target.value
                          )
                        }
                        className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                        placeholder="Yeni şifre"
                      />

                      <button
                        type="button"
                        onClick={() => updateUserPassword(user.id)}
                        disabled={saving}
                        className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 font-semibold text-white hover:bg-white/10 transition disabled:opacity-50"
                      >
                        Şifreyi Değiştir
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                      <button
                        type="button"
                        onClick={() =>
                          toggleUserActive(user.id, !user.is_active)
                        }
                        disabled={saving || isCurrentUser || isOwner}
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
                        onClick={() => deleteUser(user.id)}
                        disabled={saving || isCurrentUser || isOwner}
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
                        <p className="font-bold mt-1">
                          {formatPrice(item.ucret)}
                        </p>
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
                        <p className="font-bold mt-1">
                          {formatPrice(item.ucret)}
                        </p>
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
                    <div
                      key={ticket.id}
                      className={
                        biletRefreshMi(ticket)
                          ? "rounded-3xl bg-zinc-950 border border-yellow-500/30 p-4 transition hover:border-yellow-400"
                          : "rounded-3xl elegant-card-soft p-4 transition hover:border-yellow-500/30"
                      }
                    >
                      <a href={`/biletler/${ticket.id}`} className="block">
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

                      {(profile?.role === "owner" ||
                        profile?.role === "admin") && (
                        <div className="mt-4 flex justify-end border-t border-white/10 pt-4">
                          <button
                            type="button"
                            onClick={() => handleDeleteTicket(ticket.id)}
                            disabled={deletingTicketId === ticket.id}
                            className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingTicketId === ticket.id
                              ? "Siliniyor..."
                              : "Bileti Sil"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}