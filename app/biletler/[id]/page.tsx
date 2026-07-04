"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import {
  CurrentStudio,
  StudioStaffMember,
  getCurrentStudio,
  getPanelPathByRole,
  getStudioStaff,
} from "../../../lib/saas/studio";

type UserRole = "owner" | "admin" | "tasarimci" | "dovmeci";
type TicketStatus = "bekliyor" | "yapildi" | "iptal";
type MusteriKaynagi = "kapi" | "sosyal_medya";
type SaasMusteriKaynagi = "kapi_musterisi" | "sosyal_medya";
type OdemeYontemi = "nakit" | "kart";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

type Person = {
  full_name: string;
  email: string | null;
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

type PriceHistoryItem = {
  id: string;
  ticket_id: string;
  old_price: number;
  new_price: number;
  changed_by: string | null;
  changed_at: string;
  changed_by_profile: Person | null;
};

type Ticket = {
  id: string;
  bilet_no: string;
  dovme_bolgesi: string | null;
  dovme_gorseli_url: string | null;
  randevu_tarihi: string;
  randevu_saati: string | null;
  durum: TicketStatus;
  tasarimci_notu: string | null;
  garanti_kapsaminda: boolean;
  created_at: string;
  tasarimci_id: string;
  dovmeci_id: string;

  tasarimci: Person | null;
  dovmeci: Person | null;

  ticket_customers: Customer | null;
  ticket_finances: Finance | null;
  ticket_payments: Payment[] | null;
};

type PaymentForm = {
  id?: string;
  odeme_tarihi: string;
  odeme_tutari: string;
  odeme_yontemi: OdemeYontemi;
};

type TicketForm = {
  musteri_ad_soyad: string;
  musteri_telefon: string;
  musteri_kaynagi: MusteriKaynagi;
  randevu_tarihi: string;
  randevu_saati: string;
  tasarimci_id: string;
  dovmeci_id: string;
  durum: TicketStatus;
  toplam_ucret: string;
  garanti_kapsaminda: boolean;
  tasarimci_notu: string;
};

type DetailRow = {
  ticket_id: string;
  ticket_no: string;
  studio_id: string;
  customer_name: string;
  customer_phone: string | null;
  source: SaasMusteriKaynagi;
  tattoo_date: string;
  appointment_time: string | null;
  status: TicketStatus;
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
  designer_note: string | null;
  payments: Payment[] | null;
  refreshes: TicketRefresh[] | null;
  price_history: PriceHistoryItem[] | null;
};

const emptyForm: TicketForm = {
  musteri_ad_soyad: "",
  musteri_telefon: "",
  musteri_kaynagi: "sosyal_medya",
  randevu_tarihi: "",
  randevu_saati: "",
  tasarimci_id: "",
  dovmeci_id: "",
  durum: "bekliyor",
  toplam_ucret: "",
  garanti_kapsaminda: false,
  tasarimci_notu: "",
};

function todayInputDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function saasSourceToOld(source?: SaasMusteriKaynagi | null): MusteriKaynagi {
  if (source === "kapi_musterisi") return "kapi";
  return "sosyal_medya";
}

function oldSourceToSaas(source: MusteriKaynagi): SaasMusteriKaynagi {
  if (source === "kapi") return "kapi_musterisi";
  return "sosyal_medya";
}

function studioRoleToOldRole(role: CurrentStudio["role"]): UserRole {
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  if (role === "artist") return "dovmeci";
  if (role === "designer") return "tasarimci";

  return "admin";
}

function formatDate(value: string) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  if (!value) return "-";

  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(value: number) {
  return `${Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}₺`;
}

function durumEtiketi(durum: TicketStatus) {
  if (durum === "bekliyor") return "Bekliyor";
  if (durum === "yapildi") return "Yapıldı";
  if (durum === "iptal") return "İptal";
  return durum;
}

function musteriKaynagiEtiketi(kaynak?: MusteriKaynagi | null) {
  if (kaynak === "kapi") return "Kapı";
  if (kaynak === "sosyal_medya") return "Sosyal Medya";
  return "-";
}

function odemeYontemiEtiketi(yontem?: OdemeYontemi | null) {
  if (yontem === "nakit") return "Nakit";
  if (yontem === "kart") return "Kart";
  return "-";
}

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = String(params.id || "");

  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [designers, setDesigners] = useState<Profile[]>([]);
  const [tattooers, setTattooers] = useState<Profile[]>([]);

  const [form, setForm] = useState<TicketForm>(emptyForm);
  const [payments, setPayments] = useState<PaymentForm[]>([]);

  const [refreshes, setRefreshes] = useState<TicketRefresh[]>([]);
  const [newRefreshDate, setNewRefreshDate] = useState(todayInputDate());
  const [newRefreshNote, setNewRefreshNote] = useState("");

  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshSaving, setRefreshSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingRefreshId, setDeletingRefreshId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadData();
  }, [ticketId]);

  const customer = useMemo(() => {
    return ticket?.ticket_customers || null;
  }, [ticket]);

  const finance = useMemo(() => {
    return ticket?.ticket_finances || null;
  }, [ticket]);

  const tasarimci = useMemo(() => {
    return ticket?.tasarimci || null;
  }, [ticket]);

  const dovmeci = useMemo(() => {
    return ticket?.dovmeci || null;
  }, [ticket]);

  const toplamAlinan = payments.reduce((total, payment) => {
    return total + Number(payment.odeme_tutari || 0);
  }, 0);

  const toplamUcret = Number(form.toplam_ucret || 0);
  const kalanTutar = toplamUcret - toplamAlinan;

  const canChangeDesigner =
    profile?.role === "owner" || profile?.role === "admin";

  const canDeleteRecords =
    profile?.role === "owner" || profile?.role === "admin";

  async function getDisplayImageUrl(storedValue: string | null) {
    if (!storedValue) return null;
    if (storedValue.startsWith("http://") || storedValue.startsWith("https://")) {
      return storedValue;
    }

    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("studio-assets")
      .createSignedUrl(storedValue, 60 * 60);

    if (error) {
      console.error("Görsel imzalı bağlantısı alınamadı:", error.message);
      return null;
    }

    return data.signedUrl;
  }

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

    if (currentStudio.role === "artist") {
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

    const staff = await getStudioStaff(currentStudio.studio_id);
    const people: Profile[] = staff.map((member) => ({
      id: member.member_id,
      full_name: member.full_name,
      email: member.email || "",
      role: studioRoleToOldRole(member.role),
      is_active: member.is_active,
    }));

    setDesigners(
      people.filter(
        (person) => person.role === "admin" || person.role === "tasarimci"
      )
    );

    setTattooers(people.filter((person) => person.role === "dovmeci"));

    const { data, error } = await supabase.rpc("get_bilet_detail_page", {
      target_studio_id: currentStudio.studio_id,
      target_ticket_id: ticketId,
    });

    if (error || !data || data.length === 0) {
      setErrorMessage(error?.message || "Bilet bulunamadı.");
      setLoading(false);
      return;
    }

    const row = data[0] as DetailRow;

    const loadedTicket: Ticket = {
      id: row.ticket_id,
      bilet_no: row.ticket_no,
      dovme_bolgesi: row.customer_name,
      dovme_gorseli_url: row.image_url,
      randevu_tarihi: row.tattoo_date,
      randevu_saati: row.appointment_time,
      durum: row.status,
      tasarimci_notu: row.designer_note,
      garanti_kapsaminda: row.has_guarantee,
      created_at: row.created_at,
      tasarimci_id: row.designer_member_id || "",
      dovmeci_id: row.artist_member_id || "",
      tasarimci: row.designer_name
        ? { full_name: row.designer_name, email: row.designer_email }
        : null,
      dovmeci: row.artist_name
        ? { full_name: row.artist_name, email: row.artist_email }
        : null,
      ticket_customers: {
        musteri_ad_soyad: row.customer_name || "",
        musteri_telefon: row.customer_phone || "",
        musteri_kaynagi: saasSourceToOld(row.source),
      },
      ticket_finances: {
        toplam_ucret: Number(row.price || 0),
      },
      ticket_payments: row.payments || [],
    };

    setTicket(loadedTicket);
    setRefreshes(row.refreshes || []);
    setPriceHistory(row.price_history || []);

    setForm({
      musteri_ad_soyad: row.customer_name || "",
      musteri_telefon: row.customer_phone || "",
      musteri_kaynagi: saasSourceToOld(row.source),
      randevu_tarihi: row.tattoo_date || "",
      randevu_saati: row.appointment_time ? row.appointment_time.slice(0, 5) : "",
      tasarimci_id: row.designer_member_id || "",
      dovmeci_id: row.artist_member_id || "",
      durum: row.status || "bekliyor",
      toplam_ucret: String(Number(row.price || 0)),
      garanti_kapsaminda: Boolean(row.has_guarantee),
      tasarimci_notu: row.designer_note || "",
    });

    setPayments(
      (row.payments || []).map((payment) => ({
        id: payment.id,
        odeme_tarihi: payment.odeme_tarihi,
        odeme_tutari: String(Number(payment.odeme_tutari || 0)),
        odeme_yontemi: payment.odeme_yontemi || "nakit",
      }))
    );

    setImagePreviewUrl(await getDisplayImageUrl(row.image_url));
    setImageFile(null);
    setLoading(false);
  }

  function updateForm<K extends keyof TicketForm>(key: K, value: TicketForm[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));

    setErrorMessage("");
    setSuccessMessage("");
  }

  function addPayment() {
    setPayments((prev) => [
      ...prev,
      {
        odeme_tarihi: todayInputDate(),
        odeme_tutari: "",
        odeme_yontemi: "nakit",
      },
    ]);

    setErrorMessage("");
    setSuccessMessage("");
  }

  function updatePayment<K extends keyof PaymentForm>(
    index: number,
    key: K,
    value: PaymentForm[K]
  ) {
    setPayments((prev) => {
      return prev.map((payment, paymentIndex) => {
        if (paymentIndex !== index) return payment;
        return {
          ...payment,
          [key]: value,
        };
      });
    });

    setErrorMessage("");
    setSuccessMessage("");
  }

  function removePayment(index: number) {
    setPayments((prev) => prev.filter((_, paymentIndex) => paymentIndex !== index));
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function uploadImageIfNeeded() {
    if (!imageFile) {
      return ticket?.dovme_gorseli_url || null;
    }

    if (!studio) {
      throw new Error("Stüdyo bilgisi bulunamadı.");
    }

    const supabase = createClient();
    const fileExt = imageFile.name.split(".").pop() || "png";
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${studio.studio_id}/tickets/${ticketId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("studio-assets")
      .upload(filePath, imageFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    return filePath;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticket || !studio) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (!form.musteri_ad_soyad.trim()) {
        throw new Error("Müşteri adı soyadı zorunlu.");
      }

      if (!form.musteri_telefon.trim()) {
        throw new Error("Müşteri telefonu zorunlu.");
      }

      if (!form.randevu_tarihi) {
        throw new Error("Randevu tarihi zorunlu.");
      }

      const effectiveDesignerId = canChangeDesigner
        ? form.tasarimci_id
        : ticket.tasarimci_id;

      if (!effectiveDesignerId) {
        throw new Error("Tasarımcı bilgisi zorunlu.");
      }

      if (Number(form.toplam_ucret || 0) < 0) {
        throw new Error("Toplam ücret negatif olamaz.");
      }

      const supabase = createClient();
      const imageUrl = await uploadImageIfNeeded();

      const validPayments = payments
        .filter((payment) => {
          return (
            payment.odeme_tarihi &&
            Number(payment.odeme_tutari || 0) > 0 &&
            payment.odeme_yontemi
          );
        })
        .map((payment) => ({
          paid_date: payment.odeme_tarihi,
          amount: Number(payment.odeme_tutari || 0),
          method: payment.odeme_yontemi,
        }));

      const { error } = await supabase.rpc("update_bilet_detail", {
        target_studio_id: studio.studio_id,
        target_ticket_id: ticket.id,
        p_customer_name: form.musteri_ad_soyad.trim(),
        p_customer_phone: form.musteri_telefon.trim(),
        p_source: oldSourceToSaas(form.musteri_kaynagi),
        p_tattoo_date: form.randevu_tarihi,
        p_appointment_time: form.randevu_saati || null,
        p_status: form.durum,
        p_designer_member_id: effectiveDesignerId,
        p_artist_member_id: form.dovmeci_id || null,
        p_price: Number(form.toplam_ucret || 0),
        p_has_guarantee: form.garanti_kapsaminda,
        p_image_url: imageUrl,
        p_designer_note: form.tasarimci_notu.trim() || null,
        p_payments: validPayments,
      });

      if (error) {
        throw new Error(error.message);
      }

      setSuccessMessage("Bilet güncellendi.");
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Bilet güncellenemedi.";
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddRefresh() {
    if (!ticket || !profile || !studio) return;

    setRefreshSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (!newRefreshDate) {
        throw new Error("Refresh tarihi zorunlu.");
      }

      const supabase = createClient();
      const { error } = await supabase.rpc("add_bilet_refresh", {
        target_studio_id: studio.studio_id,
        target_ticket_id: ticket.id,
        p_refresh_date: newRefreshDate,
        p_note: newRefreshNote.trim() || null,
      });

      if (error) {
        throw new Error(error.message);
      }

      setNewRefreshDate(todayInputDate());
      setNewRefreshNote("");
      setSuccessMessage("Refresh kaydı eklendi.");
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Refresh kaydı eklenemedi.";
      setErrorMessage(message);
    } finally {
      setRefreshSaving(false);
    }
  }

  async function handleDeleteRefresh(refreshId: string) {
    if (!ticket || !studio || !canDeleteRecords) {
      setErrorMessage("Bu refresh kaydını silme yetkiniz yok.");
      return;
    }

    const confirmed = window.confirm(
      "Bu refresh kaydını silmek istediğine emin misin?\n\n" +
        "Bu işlem yalnızca seçilen yanlış refresh geçmişini kaldırır."
    );

    if (!confirmed) return;

    setDeletingRefreshId(refreshId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc(
        "admin_delete_ticket_refresh",
        {
          target_refresh_id: refreshId,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      await loadData();
      setSuccessMessage("Refresh kaydı başarıyla silindi.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Refresh kaydı silinemedi.";
      setErrorMessage(message);
    } finally {
      setDeletingRefreshId(null);
    }
  }

  async function handleDeleteTicket() {
    if (!ticket || !studio || !canDeleteRecords) {
      setErrorMessage("Bu bileti silme yetkiniz yok.");
      return;
    }

    const confirmed = window.confirm(
      "Bu bileti tamamen silmek istediğine emin misin?\n\n" +
        "Bilete bağlı ödeme, refresh ve fiyat değişikliği kayıtları da silinecek. " +
        "Bu işlem geri alınamaz."
    );

    if (!confirmed) return;

    setDeleting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc("admin_delete_ticket", {
        target_ticket_id: ticket.id,
      });

      if (error) {
        throw new Error(error.message);
      }

      router.push("/biletler");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Bilet silinemedi.";
      setErrorMessage(message);
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="elegant-page min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2rem] elegant-card p-6">
            <p className="text-zinc-400">Bilet yükleniyor...</p>
          </div>
        </div>
      </main>
    );
  }

  if (errorMessage && !ticket) {
    return (
      <main className="elegant-page min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2rem] elegant-card p-6">
            <h1 className="text-2xl font-black">Bilet bulunamadı</h1>
            <p className="text-zinc-400 mt-2">{errorMessage}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!ticket) {
    return null;
  }

  return (
    <main className="elegant-page min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
              Bilet Detayı
            </p>

            <h1 className="text-3xl md:text-5xl font-black mt-4">
              #{ticket.bilet_no}
            </h1>

            <p className="text-zinc-500 mt-2">
              {customer?.musteri_ad_soyad || "Müşteri"} · {formatDate(ticket.randevu_tarihi)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
              {durumEtiketi(ticket.durum)}
            </span>

            {ticket.garanti_kapsaminda && (
              <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-200">
                Garanti
              </span>
            )}

            {refreshes.length > 0 && (
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200">
                Refresh Var
              </span>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-3xl bg-red-500/10 border border-red-500/30 p-4 mb-6">
            <p className="text-red-200 font-semibold">Hata</p>
            <p className="text-red-100/80 text-sm mt-1">{errorMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="rounded-3xl bg-emerald-500/10 border border-emerald-500/30 p-4 mb-6">
            <p className="text-emerald-200 font-semibold">Başarılı</p>
            <p className="text-emerald-100/80 text-sm mt-1">{successMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="rounded-[2rem] elegant-card p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-black">Müşteri ve Randevu Bilgileri</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Müşteri Ad Soyad</label>
                <input
                  value={form.musteri_ad_soyad}
                  onChange={(event) => updateForm("musteri_ad_soyad", event.target.value)}
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Telefon</label>
                <input
                  value={form.musteri_telefon}
                  onChange={(event) => updateForm("musteri_telefon", event.target.value)}
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Müşteri Kaynağı</label>
                <select
                  value={form.musteri_kaynagi}
                  onChange={(event) => updateForm("musteri_kaynagi", event.target.value as MusteriKaynagi)}
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                >
                  <option value="sosyal_medya">Sosyal Medya</option>
                  <option value="kapi">Kapı</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Randevu Tarihi</label>
                <input
                  type="date"
                  value={form.randevu_tarihi}
                  onChange={(event) => updateForm("randevu_tarihi", event.target.value)}
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Randevu Saati</label>
                <input
                  type="time"
                  value={form.randevu_saati}
                  onChange={(event) => updateForm("randevu_saati", event.target.value)}
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Durum</label>
                <select
                  value={form.durum}
                  onChange={(event) => updateForm("durum", event.target.value as TicketStatus)}
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                >
                  <option value="bekliyor">Bekliyor</option>
                  <option value="yapildi">Yapıldı</option>
                  <option value="iptal">İptal</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Tasarımcı</label>

                {canChangeDesigner ? (
                  <select
                    value={form.tasarimci_id}
                    onChange={(event) =>
                      updateForm("tasarimci_id", event.target.value)
                    }
                    className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                  >
                    <option value="">Tasarımcı seç</option>
                    {designers.map((designer) => (
                      <option key={designer.id} value={designer.id}>
                        {designer.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full rounded-2xl elegant-input px-4 py-4 text-white opacity-80">
                    {tasarimci?.full_name || "Tasarımcı bilgisi yok"}
                    <span className="ml-2 text-xs text-zinc-500">
                      Sadece admin değiştirebilir
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Dövmeci <span className="text-zinc-600">(opsiyonel)</span>
                </label>
                <select
                  value={form.dovmeci_id}
                  onChange={(event) => updateForm("dovmeci_id", event.target.value)}
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                >
                  <option value="">Daha sonra atanacak</option>
                  {tattooers.map((tattooer) => (
                    <option key={tattooer.id} value={tattooer.id}>
                      {tattooer.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => updateForm("garanti_kapsaminda", !form.garanti_kapsaminda)}
                  className={
                    form.garanti_kapsaminda
                      ? "w-full rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-4 font-semibold text-yellow-200"
                      : "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 font-semibold text-zinc-300"
                  }
                >
                  {form.garanti_kapsaminda ? "Garanti Kapsamında" : "Garanti Yok"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] elegant-card p-4 md:p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div>
                <h2 className="text-xl md:text-2xl font-black">Ücret ve Ödemeler</h2>
                <p className="text-zinc-500 text-sm mt-2">
                  Fiyat değişirse güvenlik kaydına otomatik işlenir.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
                <div className="rounded-3xl elegant-card-soft p-4">
                  <p className="text-xs text-zinc-500">Toplam</p>
                  <p className="text-lg font-black mt-1">{formatPrice(toplamUcret)}</p>
                </div>

                <div className="rounded-3xl elegant-card-soft p-4">
                  <p className="text-xs text-zinc-500">Alınan</p>
                  <p className="text-lg font-black mt-1 text-emerald-200">{formatPrice(toplamAlinan)}</p>
                </div>

                <div className="rounded-3xl elegant-card-soft p-4">
                  <p className="text-xs text-zinc-500">Kalan</p>
                  <p className="text-lg font-black mt-1 text-yellow-200">{formatPrice(kalanTutar)}</p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm text-zinc-400 mb-2">Toplam Ücret</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.toplam_ucret}
                onChange={(event) => updateForm("toplam_ucret", event.target.value)}
                className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              />
            </div>

            <div className="mt-6 space-y-3">
              {payments.length === 0 ? (
                <div className="rounded-3xl elegant-card-soft p-5">
                  <p className="text-zinc-500 text-sm">Henüz ödeme kaydı yok.</p>
                </div>
              ) : (
                payments.map((payment, index) => (
                  <div key={`${payment.id || "new"}-${index}`} className="rounded-3xl elegant-card-soft p-4">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-2">Ödeme Tarihi</label>
                        <input
                          type="date"
                          value={payment.odeme_tarihi}
                          onChange={(event) => updatePayment(index, "odeme_tarihi", event.target.value)}
                          className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-500 mb-2">Ödeme Tutarı</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={payment.odeme_tutari}
                          onChange={(event) => updatePayment(index, "odeme_tutari", event.target.value)}
                          className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-500 mb-2">Ödeme Yöntemi</label>
                        <select
                          value={payment.odeme_yontemi}
                          onChange={(event) => updatePayment(index, "odeme_yontemi", event.target.value as OdemeYontemi)}
                          className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
                        >
                          <option value="nakit">Nakit</option>
                          <option value="kart">Kart</option>
                        </select>
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removePayment(index)}
                          className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-semibold text-red-200 hover:bg-red-500/20 transition"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}

              <button
                type="button"
                onClick={addPayment}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 font-semibold text-emerald-200 hover:bg-emerald-500/20 transition"
              >
                Ödeme Ekle
              </button>
            </div>
          </section>

          <section className="rounded-[2rem] elegant-card p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-black">Görsel ve Not</h2>

            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 mt-6">
              <div>
                {imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt="Dövme görseli"
                    className="h-64 w-full rounded-3xl object-cover bg-black/30 border border-white/10"
                  />
                ) : (
                  <div className="h-64 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500">
                    Görsel yok
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                  className="mt-4 w-full rounded-2xl elegant-input px-4 py-4 text-white"
                />

                {imageFile && (
                  <p className="text-zinc-500 text-sm mt-2">Seçilen dosya: {imageFile.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Tasarımcı Notu</label>
                <textarea
                  value={form.tasarimci_notu}
                  onChange={(event) => updateForm("tasarimci_notu", event.target.value)}
                  rows={10}
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white resize-none"
                  placeholder="Bu biletle ilgili özel not..."
                />

                <div className="rounded-3xl elegant-card-soft p-4 mt-4 text-sm text-zinc-400">
                  Tasarımcı: <span className="text-white font-semibold">{tasarimci?.full_name || "-"}</span>
                  <br />
                  Dövmeci: <span className="text-white font-semibold">{dovmeci?.full_name || "-"}</span>
                  <br />
                  Kaynak: <span className="text-white font-semibold">{musteriKaynagiEtiketi(customer?.musteri_kaynagi)}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] elegant-card p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
              <div>
                <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
                  Güvenlik kaydı
                </p>

                <h2 className="text-xl md:text-2xl font-black mt-4">Fiyat Değişiklik Geçmişi</h2>

                <p className="text-zinc-500 text-sm mt-2">
                  Bu bilette fiyat değiştirildiğinde eski fiyat, yeni fiyat, değiştiren kullanıcı ve tarih burada görünür.
                </p>
              </div>
            </div>

            {priceHistory.length === 0 ? (
              <div className="rounded-3xl elegant-card-soft p-5">
                <p className="text-zinc-500 text-sm">Bu bilet için henüz fiyat değişikliği kaydı yok.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {priceHistory.map((history) => {
                  return (
                    <div key={history.id} className="rounded-3xl elegant-card-soft p-4 md:p-5">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="font-black text-white">
                            {formatPrice(Number(history.old_price || 0))}{" "}
                            <span className="text-zinc-500 font-semibold">→</span>{" "}
                            <span className="text-yellow-200">{formatPrice(Number(history.new_price || 0))}</span>
                          </p>

                          <p className="text-zinc-500 text-sm mt-2">
                            Değiştiren:{" "}
                            <span className="text-zinc-200 font-semibold">
                              {history.changed_by_profile?.full_name || "Bilinmeyen kullanıcı"}
                            </span>
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                          {formatDateTime(history.changed_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-[2rem] elegant-card p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-black">Refresh Geçmişi</h2>

            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-3 mt-6">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Refresh Tarihi</label>
                <input
                  type="date"
                  value={newRefreshDate}
                  onChange={(event) => setNewRefreshDate(event.target.value)}
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Refresh Notu</label>
                <input
                  value={newRefreshNote}
                  onChange={(event) => setNewRefreshNote(event.target.value)}
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                  placeholder="Opsiyonel not"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAddRefresh}
                  disabled={refreshSaving}
                  className="w-full rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-4 font-semibold text-cyan-200 hover:bg-cyan-500/20 transition disabled:opacity-50"
                >
                  {refreshSaving ? "Ekleniyor..." : "Refresh Ekle"}
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {refreshes.length === 0 ? (
                <div className="rounded-3xl elegant-card-soft p-5">
                  <p className="text-zinc-500 text-sm">Bu bilet için refresh kaydı yok.</p>
                </div>
              ) : (
                refreshes.map((refresh) => (
                  <div key={refresh.id} className="rounded-3xl elegant-card-soft p-4 md:p-5">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="font-black text-cyan-100">
                          {formatDate(refresh.refresh_tarihi)}
                        </p>
                        <p className="text-zinc-500 text-sm mt-2">
                          {refresh.refresh_notu || "Not yok"}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 md:items-end">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                          Kayıt: {formatDateTime(refresh.created_at)}
                        </div>

                        {canDeleteRecords && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRefresh(refresh.id)}
                            disabled={deletingRefreshId === refresh.id}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingRefreshId === refresh.id
                              ? "Siliniyor..."
                              : "Refresh Kaydını Sil"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <div className="flex flex-col md:flex-row gap-3">
            <a
              href={`/biletler/${ticket.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-6 py-4 text-center font-black text-yellow-200 hover:bg-yellow-500/20 transition"
            >
              Çıktı Al
            </a>

            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl elegant-button-gold px-8 py-4 font-black transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Kaydediliyor..." : "Bileti Güncelle"}
            </button>
          </div>
        </form>

        {canDeleteRecords && (
          <section className="rounded-[2rem] border border-red-500/20 bg-red-500/5 p-4 md:p-6 mt-8">
            <h2 className="text-xl font-black text-red-100">Tehlikeli Alan</h2>

            <p className="text-red-100/60 text-sm mt-2">
              Bu bileti silersen bilet ve bağlı ödeme, refresh ve fiyat geçmişi
              kayıtları kaldırılır. Bu işlem geri alınamaz. Bu alan yalnızca
              owner ve admin kullanıcılarında görünür.
            </p>

            <button
              type="button"
              onClick={handleDeleteTicket}
              disabled={deleting}
              className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4 font-semibold text-red-200 hover:bg-red-500/20 transition disabled:opacity-50"
            >
              {deleting ? "Siliniyor..." : "Bileti Sil"}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
