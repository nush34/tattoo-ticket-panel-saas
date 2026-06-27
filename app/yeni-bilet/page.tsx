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

type UserRole = "owner" | "admin" | "tasarimci" | "dovmeci";
type MusteriKaynagi = "kapi" | "sosyal_medya";
type OdemeYontemi = "nakit" | "kart";
type TicketStatus = "bekliyor" | "yapildi" | "iptal";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

type PaymentForm = {
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
  toplam_ucret: string;
  durum: TicketStatus;
  garanti_kapsaminda: boolean;
  tasarimci_notu: string;
};

type CreatedTicketRow = {
  ticket_id: string;
  ticket_no: string;
};

function getTodayForInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function getCurrentTimeForInput() {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function studioRoleToOldRole(
  role: CurrentStudio["role"] | StudioStaffMember["role"]
): UserRole {
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  if (role === "designer") return "tasarimci";
  return "dovmeci";
}

function oldSourceToSaas(source: MusteriKaynagi) {
  if (source === "kapi") return "kapi_musterisi";
  return "sosyal_medya";
}

function roleLabel(role: UserRole) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "tasarimci") return "Tasarımcı";
  if (role === "dovmeci") return "Dövmeci";
  return role;
}

export default function YeniBiletPage() {
  const router = useRouter();

  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const [form, setForm] = useState<TicketForm>({
    musteri_ad_soyad: "",
    musteri_telefon: "",
    musteri_kaynagi: "sosyal_medya",
    randevu_tarihi: getTodayForInput(),
    randevu_saati: getCurrentTimeForInput(),
    tasarimci_id: "",
    dovmeci_id: "",
    toplam_ucret: "",
    durum: "bekliyor",
    garanti_kapsaminda: false,
    tasarimci_notu: "",
  });

  const [payments, setPayments] = useState<PaymentForm[]>([
    {
      odeme_tarihi: getTodayForInput(),
      odeme_tutari: "",
      odeme_yontemi: "nakit",
    },
  ]);

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

    const cleanUsers: Profile[] = staff.map((member) => ({
      id: member.member_id,
      full_name: member.full_name,
      email: member.email || "",
      role: studioRoleToOldRole(member.role),
      is_active: member.is_active,
    }));

    setUsers(cleanUsers);

    const activeUsers = cleanUsers.filter((user) => user.is_active);
    const firstDesigner =
      activeUsers.find((user) => user.role === "tasarimci") ||
      activeUsers.find((user) => user.role === "admin") ||
      activeUsers.find((user) => user.role === "owner");

    const currentUserCanChooseDesigner =
      currentStudio.role === "owner" || currentStudio.role === "admin";

    setForm((prev) => ({
      ...prev,
      tasarimci_id: currentUserCanChooseDesigner
        ? firstDesigner?.id || ""
        : currentStudio.member_id,
      dovmeci_id: "",
    }));

    setLoading(false);
  }

  const tasarimcilar = useMemo(() => {
    return users.filter((user) => {
      return (
        user.is_active &&
        (user.role === "owner" || user.role === "admin" || user.role === "tasarimci")
      );
    });
  }, [users]);

  const dovmeciler = useMemo(() => {
    return users.filter((user) => user.is_active && user.role === "dovmeci");
  }, [users]);

  const canChooseDesigner = profile?.role === "owner" || profile?.role === "admin";

  function updateForm<K extends keyof TicketForm>(key: K, value: TicketForm[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));

    setErrorMessage("");
    setSuccessMessage("");
  }

  function updatePayment(index: number, key: keyof PaymentForm, value: string) {
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

  function addPayment() {
    setPayments((prev) => [
      ...prev,
      {
        odeme_tarihi: getTodayForInput(),
        odeme_tutari: "",
        odeme_yontemi: "nakit",
      },
    ]);
  }

  function removePayment(index: number) {
    setPayments((prev) => {
      if (prev.length === 1) {
        return [
          {
            odeme_tarihi: getTodayForInput(),
            odeme_tutari: "",
            odeme_yontemi: "nakit",
          },
        ];
      }

      return prev.filter((_, paymentIndex) => paymentIndex !== index);
    });
  }

  function formatPrice(value: number) {
    return `${value.toLocaleString("tr-TR")} TL`;
  }

  function odemeYontemiEtiketi(yontem: OdemeYontemi) {
    if (yontem === "kart") return "Kart";
    return "Nakit";
  }

  function durumEtiketi(status: TicketStatus) {
    if (status === "bekliyor") return "Bekliyor";
    if (status === "yapildi") return "Yapıldı";
    if (status === "iptal") return "İptal";
    return status;
  }

  const toplamUcretNumber = Number(form.toplam_ucret || 0);

  const toplamAlinanNumber = payments.reduce((total, payment) => {
    return total + Number(payment.odeme_tutari || 0);
  }, 0);

  const toplamNakitNumber = payments.reduce((total, payment) => {
    if (payment.odeme_yontemi !== "nakit") return total;
    return total + Number(payment.odeme_tutari || 0);
  }, 0);

  const toplamKartNumber = payments.reduce((total, payment) => {
    if (payment.odeme_yontemi !== "kart") return total;
    return total + Number(payment.odeme_tutari || 0);
  }, 0);

  const toplamKalanNumber = toplamUcretNumber - toplamAlinanNumber;

  async function uploadImage() {
    if (!selectedImage) return null;

    if (!studio) {
      throw new Error("Stüdyo bilgisi bulunamadı.");
    }

    const supabase = createClient();
    const fileExt = selectedImage.name.split(".").pop() || "jpg";
    const safeExt = fileExt.toLowerCase();
    const filePath = `${studio.studio_id}/tickets/${crypto.randomUUID()}.${safeExt}`;

    const { error: uploadError } = await supabase.storage
      .from("studio-assets")
      .upload(filePath, selectedImage, {
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

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (!profile || !studio) {
        throw new Error("Oturum bulunamadı.");
      }

      if (!form.musteri_ad_soyad.trim()) {
        throw new Error("Müşteri adı soyadı zorunlu.");
      }

      if (!form.musteri_telefon.trim()) {
        throw new Error("Müşteri telefonu zorunlu.");
      }

      if (!form.randevu_tarihi) {
        throw new Error("Randevu tarihi zorunlu.");
      }

      if (!form.randevu_saati) {
        throw new Error("Randevu saati zorunlu.");
      }

      const finalDesignerId = canChooseDesigner ? form.tasarimci_id : profile.id;

      if (!finalDesignerId) {
        throw new Error("Tasarımcı seçimi zorunlu.");
      }

      const toplamUcret = Number(form.toplam_ucret || 0);

      if (!toplamUcret || toplamUcret <= 0) {
        throw new Error("Toplam ücret sıfırdan büyük olmalı.");
      }

      const imageUrl = await uploadImage();
      const supabase = createClient();

      const validPayments = payments
        .map((payment) => ({
          paid_date: payment.odeme_tarihi,
          amount: Number(payment.odeme_tutari || 0),
          method: payment.odeme_yontemi,
        }))
        .filter((payment) => {
          return payment.paid_date && payment.amount > 0;
        });

      const { data, error } = await supabase.rpc("create_yeni_bilet_page_ticket", {
        target_studio_id: studio.studio_id,
        p_customer_name: form.musteri_ad_soyad.trim(),
        p_customer_phone: form.musteri_telefon.trim(),
        p_source: oldSourceToSaas(form.musteri_kaynagi),
        p_tattoo_date: form.randevu_tarihi,
        p_appointment_time: form.randevu_saati || null,
        p_status: form.durum,
        p_designer_member_id: finalDesignerId,
        p_artist_member_id: form.dovmeci_id || null,
        p_price: toplamUcret,
        p_has_guarantee: form.garanti_kapsaminda,
        p_image_url: imageUrl,
        p_designer_note: form.tasarimci_notu.trim() || null,
        p_payments: validPayments,
      });

      if (error) {
        throw new Error(error.message);
      }

      const createdTicket = Array.isArray(data)
        ? ((data[0] || null) as CreatedTicketRow | null)
        : ((data || null) as CreatedTicketRow | null);

      if (!createdTicket?.ticket_id) {
        throw new Error("Bilet oluşturuldu ama bilet numarası alınamadı.");
      }

      setSuccessMessage(`${createdTicket.ticket_no} numaralı bilet oluşturuldu.`);

      setForm({
        musteri_ad_soyad: "",
        musteri_telefon: "",
        musteri_kaynagi: "sosyal_medya",
        randevu_tarihi: getTodayForInput(),
        randevu_saati: getCurrentTimeForInput(),
        tasarimci_id: canChooseDesigner ? tasarimcilar[0]?.id || "" : profile.id,
        dovmeci_id: "",
        toplam_ucret: "",
        durum: "bekliyor",
        garanti_kapsaminda: false,
        tasarimci_notu: "",
      });

      setPayments([
        {
          odeme_tarihi: getTodayForInput(),
          odeme_tutari: "",
          odeme_yontemi: "nakit",
        },
      ]);

      setSelectedImage(null);
      router.push(`/biletler/${createdTicket.ticket_id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Bilet oluşturulamadı.";
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen elegant-page text-white flex items-center justify-center p-4 md:p-6">
        <div className="rounded-[2rem] elegant-card p-6 md:p-8">
          <h1 className="text-2xl font-bold">Yeni bilet sayfası yükleniyor...</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            Tasarımcı ve dövmeci bilgileri hazırlanıyor.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen elegant-page text-white p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 md:mb-8">
          <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
            Yeni kayıt
          </p>

          <h1 className="text-3xl md:text-4xl font-black mt-4">
            Yeni Bilet Oluştur
          </h1>

          <p className="text-zinc-400 mt-2 text-sm md:text-base">
            Müşteri bilgisi, müşteri kaynağı, randevu tarihi, dövmeci, ödeme
            yöntemi ve görsel bilgilerini gir.
          </p>

          {profile && (
            <p className="text-zinc-500 mt-2 text-xs md:text-sm">
              Giriş yapan kullanıcı: {profile.full_name} / {roleLabel(profile.role)}
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
            <p className="text-emerald-100/80 mt-2 text-sm">{successMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-[2rem] elegant-card p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-black mb-4">
              Müşteri Bilgileri
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Müşteri Ad Soyad
                </label>
                <input
                  value={form.musteri_ad_soyad}
                  onChange={(event) =>
                    updateForm("musteri_ad_soyad", event.target.value)
                  }
                  required
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                  placeholder="Müşteri adı soyadı"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Telefon
                </label>
                <input
                  value={form.musteri_telefon}
                  onChange={(event) =>
                    updateForm("musteri_telefon", event.target.value)
                  }
                  required
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                  placeholder="05xx xxx xx xx"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Müşteri Kaynağı
                </label>
                <select
                  value={form.musteri_kaynagi}
                  onChange={(event) =>
                    updateForm(
                      "musteri_kaynagi",
                      event.target.value as MusteriKaynagi
                    )
                  }
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                >
                  <option value="sosyal_medya">Sosyal medya</option>
                  <option value="kapi">Kapı müşterisi</option>
                </select>
                <p className="text-xs text-zinc-500 mt-2">
                  Dövme sanatçısı net değilse boş bırakabilirsin. Bilet detayından sonradan atanabilir.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] elegant-card p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-black mb-4">
              Randevu ve Ekip
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Randevu Tarihi
                </label>
                <input
                  type="date"
                  value={form.randevu_tarihi}
                  onChange={(event) =>
                    updateForm("randevu_tarihi", event.target.value)
                  }
                  required
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Randevu Saati
                </label>
                <input
                  type="time"
                  value={form.randevu_saati}
                  onChange={(event) =>
                    updateForm("randevu_saati", event.target.value)
                  }
                  required
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Tasarımcı
                </label>
                {canChooseDesigner ? (
                  <select
                    value={form.tasarimci_id}
                    onChange={(event) =>
                      updateForm("tasarimci_id", event.target.value)
                    }
                    required
                    className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                  >
                    <option value="">Tasarımcı seç</option>
                    {tasarimcilar.map((tasarimci) => (
                      <option key={tasarimci.id} value={tasarimci.id}>
                        {tasarimci.full_name} / {roleLabel(tasarimci.role)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-2xl elegant-card-soft px-4 py-4">
                    <p className="font-semibold">{profile?.full_name}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Bu bilet otomatik olarak giriş yapan tasarımcıya atanır ve değiştirilemez.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Dövmeci <span className="text-zinc-600">(opsiyonel)</span>
                </label>
                <select
                  value={form.dovmeci_id}
                  onChange={(event) =>
                    updateForm("dovmeci_id", event.target.value)
                  }
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                >
                  <option value="">Daha sonra atanacak</option>
                  {dovmeciler.map((dovmeci) => (
                    <option key={dovmeci.id} value={dovmeci.id}>
                      {dovmeci.full_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 mt-2">
                  Sanatçı net değilse boş bırakabilirsin. Bilet detayından sonradan atanabilir.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] elegant-card p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-black mb-4">
              Ücret ve Durum
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Toplam Ücret
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.toplam_ucret}
                  onChange={(event) =>
                    updateForm("toplam_ucret", event.target.value)
                  }
                  required
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                  placeholder="Örn: 5000"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Durum
                </label>
                <select
                  value={form.durum}
                  onChange={(event) =>
                    updateForm("durum", event.target.value as TicketStatus)
                  }
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                >
                  <option value="bekliyor">Bekliyor</option>
                  <option value="yapildi">Yapıldı</option>
                  <option value="iptal">İptal</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-400 mb-2">
                  Garanti Durumu
                </label>

                <button
                  type="button"
                  onClick={() =>
                    updateForm("garanti_kapsaminda", !form.garanti_kapsaminda)
                  }
                  className={
                    form.garanti_kapsaminda
                      ? "w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-left font-semibold text-emerald-200"
                      : "w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-left font-semibold text-zinc-300"
                  }
                >
                  {form.garanti_kapsaminda
                    ? "Garanti kapsamında"
                    : "Garanti kapsamında değil"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
              <div className="rounded-2xl elegant-card-soft p-4">
                <p className="text-xs text-zinc-500">Toplam</p>
                <p className="font-bold mt-1 text-sm md:text-base">
                  {formatPrice(toplamUcretNumber)}
                </p>
              </div>

              <div className="rounded-2xl elegant-card-soft p-4">
                <p className="text-xs text-zinc-500">Alınan</p>
                <p className="font-bold mt-1 text-sm md:text-base">
                  {formatPrice(toplamAlinanNumber)}
                </p>
              </div>

              <div className="rounded-2xl elegant-card-soft p-4">
                <p className="text-xs text-zinc-500">Nakit</p>
                <p className="font-bold mt-1 text-sm md:text-base">
                  {formatPrice(toplamNakitNumber)}
                </p>
              </div>

              <div className="rounded-2xl elegant-card-soft p-4">
                <p className="text-xs text-zinc-500">Kart</p>
                <p className="font-bold mt-1 text-sm md:text-base">
                  {formatPrice(toplamKartNumber)}
                </p>
              </div>

              <div className="rounded-2xl elegant-card-soft p-4 col-span-2 md:col-span-1">
                <p className="text-xs text-zinc-500">Kalan</p>
                <p className="font-bold mt-1 text-sm md:text-base">
                  {formatPrice(toplamKalanNumber)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] elegant-card p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl md:text-2xl font-black">Ödemeler</h2>
                <p className="text-zinc-500 text-sm mt-1">
                  Her ödeme için nakit veya kart seçimi yapabilirsin.
                </p>
              </div>

              <button
                type="button"
                onClick={addPayment}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold hover:bg-white/10 transition"
              >
                Ödeme Ekle
              </button>
            </div>

            <div className="space-y-3">
              {payments.map((payment, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-3xl elegant-card-soft p-4"
                >
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Ödeme Tarihi
                    </label>
                    <input
                      type="date"
                      value={payment.odeme_tarihi}
                      onChange={(event) =>
                        updatePayment(index, "odeme_tarihi", event.target.value)
                      }
                      className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Ödeme Tutarı
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={payment.odeme_tutari}
                      onChange={(event) =>
                        updatePayment(index, "odeme_tutari", event.target.value)
                      }
                      className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                      placeholder="Örn: 1000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Ödeme Yöntemi
                    </label>
                    <select
                      value={payment.odeme_yontemi}
                      onChange={(event) =>
                        updatePayment(
                          index,
                          "odeme_yontemi",
                          event.target.value as OdemeYontemi
                        )
                      }
                      className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                    >
                      <option value="nakit">Nakit</option>
                      <option value="kart">Kart</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removePayment(index)}
                      className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4 font-semibold text-red-200 hover:bg-red-500/20 transition"
                    >
                      Ödemeyi Kaldır
                    </button>
                  </div>

                  <div className="md:col-span-4">
                    <p className="text-xs text-zinc-500">
                      Ödeme #{index + 1}: {" "}
                      <span className="text-zinc-300 font-semibold">
                        {payment.odeme_tutari
                          ? formatPrice(Number(payment.odeme_tutari || 0))
                          : "Tutar girilmedi"}
                      </span>{" "}
                      / {odemeYontemiEtiketi(payment.odeme_yontemi)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] elegant-card p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-black mb-4">
              Görsel ve Not
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Dövme Görseli
                </label>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setSelectedImage(event.target.files?.[0] || null)
                  }
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                />

                {selectedImage && (
                  <p className="text-zinc-500 text-sm mt-2">
                    Seçilen dosya: {selectedImage.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Tasarımcı Notu
                </label>

                <textarea
                  value={form.tasarimci_notu}
                  onChange={(event) =>
                    updateForm("tasarimci_notu", event.target.value)
                  }
                  rows={5}
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white resize-none"
                  placeholder="Dövme, müşteri veya randevu hakkında not..."
                />
              </div>
            </div>
          </section>

          <div className="flex flex-col md:flex-row gap-3 md:justify-end">
            <a
              href="/biletler"
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
            >
              Vazgeç
            </a>

            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl elegant-button-gold px-8 py-4 font-black transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Bilet oluşturuluyor..." : "Bileti Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
