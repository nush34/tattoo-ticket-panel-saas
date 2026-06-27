"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import {
  CurrentStudio,
  getCurrentStudio,
  getPanelPathByStudio,
} from "../../lib/saas/studio";

type TicketStatus = "bekliyor" | "yapildi" | "iptal";
type PaymentMethod = "nakit" | "kart";
type CustomerSource = "kapi_musterisi" | "sosyal_medya";
type StatusFilter = "tum" | TicketStatus;

type Payment = {
  id: string;
  odeme_tarihi: string;
  odeme_tutari: number;
  odeme_yontemi: PaymentMethod | null;
};

type SoloTicket = {
  ticket_id: string;
  ticket_no: string;
  studio_id: string;
  customer_name: string;
  customer_phone: string | null;
  source: CustomerSource;
  tattoo_date: string;
  appointment_time: string | null;
  status: TicketStatus;
  has_guarantee: boolean;
  image_url: string | null;
  designer_note: string | null;
  price: number;
  payments: Payment[] | null;
  created_at: string;
  updated_at: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function lastDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPrice(value: number) {
  return `${Number(value || 0).toLocaleString("tr-TR")} TL`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusLabel(status: TicketStatus) {
  if (status === "bekliyor") return "Bekliyor";
  if (status === "yapildi") return "Yapıldı";
  if (status === "iptal") return "İptal";
  return status;
}

export default function SoloPanelPage() {
  const router = useRouter();

  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [tickets, setTickets] = useState<SoloTicket[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tattooDate, setTattooDate] = useState(todayISO());
  const [appointmentTime, setAppointmentTime] = useState("");
  const [price, setPrice] = useState("");
  const [initialPaid, setInitialPaid] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("nakit");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [extraPayments, setExtraPayments] = useState<
    Record<string, { paid_date: string; amount: string; method: PaymentMethod }>
  >({});

  const now = new Date();
  const [filterStart, setFilterStart] = useState(toISODate(firstDayOfMonth(now)));
  const [filterEnd, setFilterEnd] = useState(toISODate(lastDayOfMonth(now)));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("tum");
  const [calendarMonth, setCalendarMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(todayISO());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session?.user) {
      router.replace("/login");
      return;
    }

    const currentStudio = await getCurrentStudio();

    if (!currentStudio) {
      await supabase.auth.signOut();
      router.replace("/login");
      return;
    }

    if (currentStudio.account_type !== "individual") {
      router.replace(getPanelPathByStudio(currentStudio));
      return;
    }

    setStudio(currentStudio);

    const { data, error } = await supabase.rpc("get_solo_panel_tickets", {
      target_studio_id: currentStudio.studio_id,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const cleanTickets = ((data || []) as SoloTicket[]).map((ticket) => ({
      ...ticket,
      price: Number(ticket.price || 0),
      payments: ticket.payments || [],
    }));

    setTickets(cleanTickets);

    const previewEntries = await Promise.all(
      cleanTickets.map(async (ticket) => {
        const signedUrl = await getDisplayImageUrl(ticket.image_url);
        return [ticket.ticket_id, signedUrl] as const;
      })
    );

    const previewMap: Record<string, string> = {};
    previewEntries.forEach(([ticketId, signedUrl]) => {
      if (signedUrl) previewMap[ticketId] = signedUrl;
    });

    setImagePreviewUrls(previewMap);
    setLoading(false);
  }

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
      console.error("Solo panel görsel bağlantısı alınamadı:", error.message);
      return null;
    }

    return data.signedUrl;
  }

  async function uploadImage() {
    if (!selectedImage) return null;

    if (!studio) {
      throw new Error("Hesap bilgisi bulunamadı.");
    }

    const supabase = createClient();
    const fileExt = selectedImage.name.split(".").pop() || "jpg";
    const safeExt = fileExt.toLowerCase();
    const filePath = `${studio.studio_id}/solo-tickets/${crypto.randomUUID()}.${safeExt}`;

    const { error } = await supabase.storage
      .from("studio-assets")
      .upload(filePath, selectedImage, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    return filePath;
  }

  async function handleCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!studio) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    let imageUrl: string | null = null;

    try {
      imageUrl = await uploadImage();
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "Görsel yüklenemedi.";

      setErrorMessage(message);
      setSaving(false);
      return;
    }

    const { data, error } = await supabase.rpc("create_solo_ticket", {
      target_studio_id: studio.studio_id,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_source: "kapi_musterisi",
      p_tattoo_date: tattooDate,
      p_appointment_time: appointmentTime || null,
      p_status: "bekliyor",
      p_price: Number(price || 0),
      p_has_guarantee: false,
      p_image_url: imageUrl,
      p_designer_note: note,
      p_initial_paid_date: paymentDate || todayISO(),
      p_initial_paid_amount: Number(initialPaid || 0),
      p_initial_payment_method: paymentMethod,
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setSuccessMessage("Rezervasyon oluşturuldu.");
    setCustomerName("");
    setCustomerPhone("");
    setTattooDate(todayISO());
    setAppointmentTime("");
    setPrice("");
    setInitialPaid("");
    setPaymentDate(todayISO());
    setPaymentMethod("nakit");
    setSelectedImage(null);
    setNote("");
    setSaving(false);

    await loadData();
  }

  async function handleStatusChange(ticketId: string, nextStatus: TicketStatus) {
    if (!studio) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase.rpc("update_solo_ticket_status", {
      target_studio_id: studio.studio_id,
      target_ticket_id: ticketId,
      p_status: nextStatus,
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setSuccessMessage("Durum güncellendi.");
    setSaving(false);
    await loadData();
  }

  async function handleDeleteTicket(ticket: SoloTicket) {
    if (!studio) return;

    const confirmed = window.confirm(`${ticket.customer_name} rezervasyonu silinsin mi?`);
    if (!confirmed) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase.rpc("delete_solo_ticket", {
      target_studio_id: studio.studio_id,
      target_ticket_id: ticket.ticket_id,
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setSuccessMessage("Rezervasyon silindi.");
    setSaving(false);
    await loadData();
  }

  function updateExtraPayment(
    ticketId: string,
    field: "paid_date" | "amount" | "method",
    value: string
  ) {
    setExtraPayments((prev) => ({
      ...prev,
      [ticketId]: {
        paid_date: prev[ticketId]?.paid_date || todayISO(),
        amount: prev[ticketId]?.amount || "",
        method: prev[ticketId]?.method || "nakit",
        [field]: value,
      },
    }));
  }

  async function handleAddPayment(ticket: SoloTicket) {
    if (!studio) return;

    const payment = extraPayments[ticket.ticket_id] || {
      paid_date: todayISO(),
      amount: "",
      method: "nakit" as PaymentMethod,
    };

    const amount = Number(payment.amount || 0);

    if (amount <= 0) {
      setErrorMessage("Ödeme tutarı sıfırdan büyük olmalı.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase.rpc("add_solo_ticket_payment", {
      target_studio_id: studio.studio_id,
      target_ticket_id: ticket.ticket_id,
      p_paid_date: payment.paid_date || todayISO(),
      p_amount: amount,
      p_method: payment.method,
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setExtraPayments((prev) => ({
      ...prev,
      [ticket.ticket_id]: {
        paid_date: todayISO(),
        amount: "",
        method: "nakit",
      },
    }));

    setSuccessMessage("Ödeme eklendi.");
    setSaving(false);
    await loadData();
  }

  function ticketPaid(ticket: SoloTicket, method?: PaymentMethod) {
    return (ticket.payments || []).reduce((total, payment) => {
      const paymentMethod = payment.odeme_yontemi || "nakit";
      if (method && paymentMethod !== method) return total;
      return total + Number(payment.odeme_tutari || 0);
    }, 0);
  }

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (filterStart && ticket.tattoo_date < filterStart) return false;
      if (filterEnd && ticket.tattoo_date > filterEnd) return false;
      if (statusFilter !== "tum" && ticket.status !== statusFilter) return false;
      return true;
    });
  }, [tickets, filterStart, filterEnd, statusFilter]);

  const summary = useMemo(() => {
    const totalPrice = filteredTickets.reduce((total, ticket) => total + Number(ticket.price || 0), 0);
    const totalPaid = filteredTickets.reduce((total, ticket) => total + ticketPaid(ticket), 0);
    const totalNakit = filteredTickets.reduce((total, ticket) => total + ticketPaid(ticket, "nakit"), 0);
    const totalKart = filteredTickets.reduce((total, ticket) => total + ticketPaid(ticket, "kart"), 0);

    return {
      count: filteredTickets.length,
      bekliyor: filteredTickets.filter((ticket) => ticket.status === "bekliyor").length,
      yapildi: filteredTickets.filter((ticket) => ticket.status === "yapildi").length,
      iptal: filteredTickets.filter((ticket) => ticket.status === "iptal").length,
      totalPrice,
      totalPaid,
      totalRemaining: totalPrice - totalPaid,
      totalNakit,
      totalKart,
    };
  }, [filteredTickets, tickets]);

  const calendarDays = useMemo(() => {
    const start = firstDayOfMonth(calendarMonth);
    const end = lastDayOfMonth(calendarMonth);
    const firstWeekDay = (start.getDay() + 6) % 7;
    const days: Array<{ date: string | null; day: number | null; count: number }> = [];

    for (let i = 0; i < firstWeekDay; i += 1) {
      days.push({ date: null, day: null, count: 0 });
    }

    for (let day = 1; day <= end.getDate(); day += 1) {
      const date = toISODate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
      const count = tickets.filter((ticket) => ticket.tattoo_date === date).length;
      days.push({ date, day, count });
    }

    return days;
  }, [calendarMonth, tickets]);

  const selectedDayTickets = tickets.filter((ticket) => ticket.tattoo_date === selectedDay);

  if (loading) {
    return (
      <main className="min-h-screen elegant-page text-white flex items-center justify-center p-4 md:p-6">
        <div className="rounded-[2rem] elegant-card p-6 md:p-8">
          <h1 className="text-2xl font-bold">Solo panel yükleniyor...</h1>
          <p className="text-zinc-400 mt-2 text-sm md:text-base">Rezervasyonların hazırlanıyor.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen elegant-page text-white p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">Bireysel Solo Panel</p>
            <h1 className="text-3xl md:text-4xl font-black mt-4">{studio?.studio_name}</h1>
            <p className="text-zinc-400 mt-2 text-sm md:text-base">Rezervasyonlarını, cirolarını ve takvimini tek ekrandan takip et.</p>
          </div>

          <Link href="/ayarlar" className="rounded-2xl elegant-button-gold px-5 py-3 text-sm font-bold">Kimlik / Baskı Ayarları</Link>
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

        <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-black mb-4">Filtre</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Başlangıç</label>
              <input type="date" value={filterStart} onChange={(event) => setFilterStart(event.target.value)} className="w-full rounded-2xl elegant-input px-4 py-4 text-white" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Bitiş</label>
              <input type="date" value={filterEnd} onChange={(event) => setFilterEnd(event.target.value)} className="w-full rounded-2xl elegant-input px-4 py-4 text-white" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Durum</label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="w-full rounded-2xl elegant-input px-4 py-4 text-white">
                <option value="tum">Tüm durumlar</option>
                <option value="bekliyor">Bekliyor</option>
                <option value="yapildi">Yapıldı</option>
                <option value="iptal">İptal</option>
              </select>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-8 gap-3 md:gap-4 mb-8">
          <SummaryCard title="Rezervasyon" value={summary.count} />
          <SummaryCard title="Bekleyen" value={summary.bekliyor} />
          <SummaryCard title="Yapılan" value={summary.yapildi} />
          <SummaryCard title="İptal" value={summary.iptal} />
          <SummaryCard title="Ciro" value={formatPrice(summary.totalPrice)} />
          <SummaryCard title="Alınan" value={formatPrice(summary.totalPaid)} />
          <SummaryCard title="Nakit" value={formatPrice(summary.totalNakit)} />
          <SummaryCard title="Kart" value={formatPrice(summary.totalKart)} />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <div className="rounded-[2rem] elegant-card p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-black mb-4">Yeni Rezervasyon</h2>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Müşteri Adı" value={customerName} onChange={setCustomerName} required />
                <Input label="Telefon" value={customerPhone} onChange={setCustomerPhone} required />
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Tarih</label>
                  <input type="date" value={tattooDate} onChange={(event) => setTattooDate(event.target.value)} required className="w-full rounded-2xl elegant-input px-4 py-4 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Saat</label>
                  <input type="time" value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} className="w-full rounded-2xl elegant-input px-4 py-4 text-white" />
                </div>
                <Input label="Toplam Fiyat" value={price} onChange={setPrice} type="number" required />
                <Input label="Alınan Ödeme" value={initialPaid} onChange={setInitialPaid} type="number" />
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Ödeme Tarihi</label>
                  <input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="w-full rounded-2xl elegant-input px-4 py-4 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Ödeme Tipi</label>
                  <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className="w-full rounded-2xl elegant-input px-4 py-4 text-white">
                    <option value="nakit">Nakit</option>
                    <option value="kart">Kart</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-zinc-400 mb-2">Dövme Görseli</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setSelectedImage(event.target.files?.[0] || null)}
                    className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                  />
                  {selectedImage && (
                    <p className="text-zinc-500 text-sm mt-2">
                      Seçilen görsel: {selectedImage.name}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Not</label>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="w-full rounded-2xl elegant-input px-4 py-4 text-white" />
              </div>

              <button type="submit" disabled={saving} className="w-full rounded-2xl elegant-button-gold px-4 py-4 font-black transition disabled:opacity-50">
                {saving ? "Oluşturuluyor..." : "Rezervasyon Oluştur"}
              </button>
            </form>
          </div>

          <div className="rounded-[2rem] elegant-card p-4 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="rounded-2xl elegant-card-soft px-4 py-3 text-sm font-semibold">Önceki</button>
              <h2 className="text-xl md:text-2xl font-black">{calendarMonth.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}</h2>
              <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="rounded-2xl elegant-card-soft px-4 py-3 text-sm font-semibold">Sonraki</button>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-xs text-zinc-500 mb-2">
              {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day) => <div key={day}>{day}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => (
                <button
                  key={`${day.date || 'empty'}-${index}`}
                  type="button"
                  disabled={!day.date}
                  onClick={() => day.date && setSelectedDay(day.date)}
                  className={
                    day.date === selectedDay
                      ? "min-h-16 rounded-2xl border border-yellow-500/40 bg-yellow-500/15 p-2 text-left"
                      : "min-h-16 rounded-2xl border border-white/10 bg-white/5 p-2 text-left disabled:opacity-20"
                  }
                >
                  <p className="font-bold">{day.day || ''}</p>
                  {day.count > 0 && <p className="text-xs text-yellow-200 mt-2">{day.count} iş</p>}
                </button>
              ))}
            </div>

            <div className="mt-5">
              <h3 className="font-bold mb-3">Seçili gün: {formatDate(selectedDay)}</h3>
              {selectedDayTickets.length === 0 ? (
                <p className="text-zinc-500 text-sm">Bu gün için rezervasyon yok.</p>
              ) : (
                <div className="space-y-3">
                  {selectedDayTickets.map((ticket) => (
                    <TicketMiniCard key={ticket.ticket_id} ticket={ticket} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] elegant-card p-4 md:p-6">
          <h2 className="text-xl md:text-2xl font-black mb-4">Rezervasyonlar</h2>
          {filteredTickets.length === 0 ? (
            <div className="rounded-3xl elegant-card-soft p-5 text-zinc-400">Seçili filtreye uygun rezervasyon yok.</div>
          ) : (
            <div className="space-y-4">
              {filteredTickets.map((ticket) => {
                const paid = ticketPaid(ticket);
                const remaining = Number(ticket.price || 0) - paid;
                return (
                  <div key={ticket.ticket_id} className="rounded-3xl elegant-card-soft p-4 md:p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-lg">{ticket.customer_name}</h3>
                          <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-zinc-300">{ticket.ticket_no}</span>
                          <span className="rounded-full bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-xs text-yellow-200">{statusLabel(ticket.status)}</span>
                        </div>
                        <p className="text-zinc-500 text-sm mt-2">{formatDate(ticket.tattoo_date)} {ticket.appointment_time ? `• ${ticket.appointment_time.slice(0, 5)}` : ''}</p>
                        <p className="text-zinc-500 text-sm mt-1">Tel: {ticket.customer_phone || '-'}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <select value={ticket.status} onChange={(event) => handleStatusChange(ticket.ticket_id, event.target.value as TicketStatus)} disabled={saving} className="rounded-2xl elegant-input px-4 py-3 text-white">
                          <option value="bekliyor">Bekliyor</option>
                          <option value="yapildi">Yapıldı</option>
                          <option value="iptal">İptal</option>
                        </select>
                        <Link href={`/biletler/${ticket.ticket_id}/print`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200">Print</Link>
                        <button type="button" onClick={() => handleDeleteTicket(ticket)} disabled={saving} className="rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm font-semibold text-red-200 disabled:opacity-50">Sil</button>
                      </div>
                    </div>

                    {imagePreviewUrls[ticket.ticket_id] && (
                      <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-black/20">
                        <img
                          src={imagePreviewUrls[ticket.ticket_id]}
                          alt={`${ticket.customer_name} dövme görseli`}
                          className="max-h-72 w-full object-contain p-3"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      <InfoCard title="Toplam" value={formatPrice(ticket.price)} />
                      <InfoCard title="Alınan" value={formatPrice(paid)} />
                      <InfoCard title="Kalan" value={formatPrice(remaining)} />
                      <InfoCard title="Ödeme" value={`${formatPrice(ticketPaid(ticket, 'nakit'))} / ${formatPrice(ticketPaid(ticket, 'kart'))}`} subValue="Nakit / Kart" />
                    </div>

                    <div className="mt-4 rounded-3xl elegant-card p-4">
                      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                        <div className="flex-1">
                          <label className="block text-sm text-zinc-400 mb-2">Yeni Ödeme Tutarı</label>
                          <input
                            type="number"
                            value={extraPayments[ticket.ticket_id]?.amount || ""}
                            onChange={(event) => updateExtraPayment(ticket.ticket_id, "amount", event.target.value)}
                            className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
                            placeholder="Ödeme tutarı"
                          />
                        </div>

                        <div className="flex-1">
                          <label className="block text-sm text-zinc-400 mb-2">Ödeme Tarihi</label>
                          <input
                            type="date"
                            value={extraPayments[ticket.ticket_id]?.paid_date || todayISO()}
                            onChange={(event) => updateExtraPayment(ticket.ticket_id, "paid_date", event.target.value)}
                            className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
                          />
                        </div>

                        <div className="flex-1">
                          <label className="block text-sm text-zinc-400 mb-2">Ödeme Tipi</label>
                          <select
                            value={extraPayments[ticket.ticket_id]?.method || "nakit"}
                            onChange={(event) => updateExtraPayment(ticket.ticket_id, "method", event.target.value as PaymentMethod)}
                            className="w-full rounded-2xl elegant-input px-4 py-3 text-white"
                          >
                            <option value="nakit">Nakit</option>
                            <option value="kart">Kart</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddPayment(ticket)}
                          disabled={saving}
                          className="rounded-2xl elegant-button-gold px-5 py-3 text-sm font-black disabled:opacity-50"
                        >
                          Ödeme Ekle
                        </button>
                      </div>

                      <div className="mt-4">
                        <p className="text-sm font-bold text-zinc-300 mb-2">Ödeme Geçmişi</p>
                        {(ticket.payments || []).length === 0 ? (
                          <p className="text-sm text-zinc-500">Henüz ödeme alınmadı.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {(ticket.payments || []).map((payment) => (
                              <span
                                key={payment.id}
                                className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-zinc-300"
                              >
                                {formatDate(payment.odeme_tarihi)} • {formatPrice(payment.odeme_tutari)} • {payment.odeme_yontemi === "kart" ? "Kart" : "Nakit"}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl elegant-card p-4 md:p-5">
      <p className="text-zinc-400 text-xs md:text-sm">{title}</p>
      <p className="text-lg md:text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}

function InfoCard({ title, value, subValue }: { title: string; value: string; subValue?: string }) {
  return (
    <div className="rounded-2xl elegant-card p-3">
      <p className="text-zinc-500 text-xs">{title}</p>
      <p className="font-bold mt-1 text-sm md:text-base">{value}</p>
      {subValue && <p className="text-zinc-500 text-xs mt-1">{subValue}</p>}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
      />
    </div>
  );
}

function TicketMiniCard({ ticket }: { ticket: SoloTicket }) {
  return (
    <div className="rounded-2xl elegant-card-soft p-3">
      <p className="font-bold">{ticket.customer_name}</p>
      <p className="text-xs text-zinc-500 mt-1">{ticket.appointment_time ? ticket.appointment_time.slice(0, 5) : 'Saat yok'} • {statusLabel(ticket.status)}</p>
    </div>
  );
}
