"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { CurrentStudio, getCurrentStudio } from "../lib/saas/studio";

type StudioSettings = {
  studio_id: string;
  logo_url: string | null;
  watermark_enabled: boolean;
  phone: string | null;
  instagram: string | null;
  address: string | null;
  print_footer_text: string | null;
  updated_at: string | null;
};

type StudioSettingsForm = {
  studio_name: string;
  phone: string;
  instagram: string;
  address: string;
  print_footer_text: string;
  watermark_enabled: boolean;
};

const defaultForm: StudioSettingsForm = {
  studio_name: "",
  phone: "",
  instagram: "",
  address: "",
  print_footer_text: "",
  watermark_enabled: true,
};

const SIGNED_LOGO_EXPIRES_IN = 60 * 60 * 24 * 365 * 10;

export default function StudioPrintSettings() {
  const [modalOpen, setModalOpen] = useState(false);

  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [form, setForm] = useState<StudioSettingsForm>(defaultForm);

  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const currentStudio = await getCurrentStudio();

      if (!currentStudio) {
        setErrorMessage("Aktif stüdyo bulunamadı. Lütfen tekrar giriş yap.");
        setLoading(false);
        return;
      }

      setStudio(currentStudio);

      const supabase = createClient();

      const { data, error } = await supabase
        .from("studio_settings")
        .select(
          "studio_id, logo_url, watermark_enabled, phone, instagram, address, print_footer_text, updated_at"
        )
        .eq("studio_id", currentStudio.studio_id)
        .maybeSingle<StudioSettings>();

      if (error) {
        throw new Error(error.message);
      }

      const loadedSettings: StudioSettings = data || {
        studio_id: currentStudio.studio_id,
        logo_url: null,
        watermark_enabled: defaultForm.watermark_enabled,
        phone: defaultForm.phone,
        instagram: defaultForm.instagram,
        address: defaultForm.address,
        print_footer_text: defaultForm.print_footer_text,
        updated_at: null,
      };

      setSettings(loadedSettings);

      setForm({
        studio_name: currentStudio.studio_name || "",
        phone: loadedSettings.phone || "",
        instagram: loadedSettings.instagram || "",
        address: loadedSettings.address || "",
        print_footer_text: loadedSettings.print_footer_text || "",
        watermark_enabled:
          loadedSettings.watermark_enabled ?? defaultForm.watermark_enabled,
      });

      setLogoFile(null);
      setLoading(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Baskı ayarları yüklenemedi.";

      setErrorMessage(message);
      setLoading(false);
    }
  }

  function updateForm<K extends keyof StudioSettingsForm>(
    key: K,
    value: StudioSettingsForm[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));

    setErrorMessage("");
    setSuccessMessage("");
  }

  async function uploadLogo() {
    if (!logoFile) {
      return settings?.logo_url || null;
    }

    if (!studio) {
      throw new Error("Aktif stüdyo bulunamadı.");
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(logoFile.type)) {
      throw new Error("Logo JPG, PNG veya WEBP formatında olmalı.");
    }

    if (logoFile.size > 10 * 1024 * 1024) {
      throw new Error("Logo dosyası en fazla 10 MB olabilir.");
    }

    const supabase = createClient();

    const fileExt = logoFile.name.split(".").pop()?.toLowerCase() || "png";
    const filePath = `${studio.studio_id}/logos/logo-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("studio-assets")
      .upload(filePath, logoFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage
        .from("studio-assets")
        .createSignedUrl(filePath, SIGNED_LOGO_EXPIRES_IN);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error(
        signedUrlError?.message || "Logo için görüntüleme bağlantısı alınamadı."
      );
    }

    return signedUrlData.signedUrl;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!studio) {
      setErrorMessage("Aktif stüdyo bulunamadı.");
      return;
    }

    if (studio.role !== "owner" && studio.role !== "admin") {
      setErrorMessage("Ayarları sadece owner veya admin değiştirebilir.");
      return;
    }

    if (!form.studio_name.trim()) {
      setErrorMessage("Stüdyo adı boş olamaz.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const supabase = createClient();
      const logoUrl = await uploadLogo();

      const { error } = await supabase.rpc("update_studio_print_settings", {
        target_studio_id: studio.studio_id,
        p_studio_name: form.studio_name.trim(),
        p_logo_url: logoUrl,
        p_phone: form.phone.trim(),
        p_instagram: form.instagram.trim(),
        p_address: form.address.trim(),
        p_print_footer_text: form.print_footer_text.trim(),
        p_watermark_enabled: form.watermark_enabled,
      });

      if (error) {
        throw new Error(error.message);
      }

      setSuccessMessage("Stüdyo ve çıktı ayarları güncellendi.");
      setSaving(false);

      window.dispatchEvent(new Event("studio-settings-updated"));

      await loadSettings();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ayarlar güncellenemedi.";

      setErrorMessage(message);
      setSaving(false);
    }
  }

  return (
    <>
      <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
              Stüdyo ve baskı ayarları
            </p>

            <h2 className="text-xl md:text-2xl font-black mt-4">
              Stüdyo Bilgileri / Çıktı Formu
            </h2>

            <p className="text-zinc-500 text-sm mt-2 max-w-2xl">
              Stüdyo adı, navbar logosu, çıktı logosu, filigran, telefon,
              Instagram, adres ve çıktı alt yazısını yönet.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-2xl elegant-button-gold px-6 py-4 font-black transition"
          >
            Stüdyo Ayarlarını Aç
          </button>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 md:p-6">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2rem] elegant-card p-4 md:p-6 relative">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
              <div>
                <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
                  Stüdyo ayarları
                </p>

                <h2 className="text-2xl md:text-3xl font-black mt-4">
                  Stüdyo ve Çıktı Formu Ayarları
                </h2>

                <p className="text-zinc-500 text-sm mt-2 max-w-2xl">
                  Bu bilgiler yalnızca aktif stüdyo için kaydedilir. Logo,
                  navbar sol alanında ve çıktı formunda otomatik kullanılır.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Kapat
              </button>
            </div>

            {loading ? (
              <div className="rounded-3xl elegant-card-soft p-5 text-zinc-400">
                Ayarlar yükleniyor...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-5 mb-5">
                  <div className="rounded-3xl elegant-card-soft p-4 md:p-5">
                    <p className="font-bold">Mevcut Ayarlar</p>

                    <p className="text-zinc-500 text-sm mt-2">
                      Stüdyo adı: <span className="text-white font-semibold">{form.studio_name || "-"}</span>
                    </p>

                    <p className="text-zinc-500 text-sm mt-1">
                      Filigran: <span className="text-white font-semibold">{form.watermark_enabled ? "Açık" : "Kapalı"}</span>
                    </p>

                    <p className="text-zinc-500 text-sm mt-1">
                      Son güncelleme: {settings?.updated_at ? new Date(settings.updated_at).toLocaleString("tr-TR") : "-"}
                    </p>
                  </div>

                  {settings?.logo_url ? (
                    <div className="rounded-3xl elegant-card-soft p-4">
                      <p className="text-xs text-zinc-500 mb-3">Mevcut logo</p>
                      <img
                        src={settings.logo_url}
                        alt="Stüdyo logosu"
                        className="h-32 w-full object-contain rounded-2xl bg-white/5 border border-white/10"
                      />
                    </div>
                  ) : (
                    <div className="rounded-3xl elegant-card-soft p-4">
                      <p className="text-xs text-zinc-500 mb-3">Mevcut logo</p>
                      <div className="h-32 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 text-sm">
                        Logo yok
                      </div>
                    </div>
                  )}
                </div>

                {errorMessage && (
                  <div className="rounded-3xl bg-red-500/10 border border-red-500/30 p-4 mb-5">
                    <p className="text-red-200 font-semibold">Hata</p>
                    <p className="text-red-100/80 text-sm mt-1">{errorMessage}</p>
                  </div>
                )}

                {successMessage && (
                  <div className="rounded-3xl bg-emerald-500/10 border border-emerald-500/30 p-4 mb-5">
                    <p className="text-emerald-200 font-semibold">Başarılı</p>
                    <p className="text-emerald-100/80 text-sm mt-1">{successMessage}</p>
                  </div>
                )}

                <form onSubmit={handleSave} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">Stüdyo adı</label>
                      <input
                        value={form.studio_name}
                        onChange={(event) => updateForm("studio_name", event.target.value)}
                        className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                        placeholder="Stüdyo adı"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">Logo</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
                        className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                      />
                      <p className="text-xs text-zinc-500 mt-2">JPG, PNG veya WEBP. En fazla 10 MB.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">Telefon</label>
                      <input
                        value={form.phone}
                        onChange={(event) => updateForm("phone", event.target.value)}
                        className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                        placeholder="Telefon"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">Instagram</label>
                      <input
                        value={form.instagram}
                        onChange={(event) => updateForm("instagram", event.target.value)}
                        className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                        placeholder="@studio"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Adres</label>
                    <textarea
                      value={form.address}
                      onChange={(event) => updateForm("address", event.target.value)}
                      className="w-full rounded-2xl elegant-input px-4 py-4 text-white min-h-24"
                      placeholder="Adres"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Çıktı alt yazısı</label>
                    <textarea
                      value={form.print_footer_text}
                      onChange={(event) => updateForm("print_footer_text", event.target.value)}
                      className="w-full rounded-2xl elegant-input px-4 py-4 text-white min-h-24"
                      placeholder="Çıktı formunda görünecek ek not"
                    />
                  </div>

                  <div className="rounded-3xl elegant-card-soft p-4 md:p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold">Filigran / Watermark</p>
                        <p className="text-zinc-500 text-sm mt-1">Açık olursa çıktı formunun orta bölümünde logo filigran olarak görünür.</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => updateForm("watermark_enabled", !form.watermark_enabled)}
                        className={
                          form.watermark_enabled
                            ? "relative h-8 w-14 rounded-full bg-emerald-500/80 border border-emerald-300/40 transition"
                            : "relative h-8 w-14 rounded-full bg-zinc-800 border border-zinc-700 transition"
                        }
                      >
                        <span
                          className={
                            form.watermark_enabled
                              ? "absolute right-1 top-1 h-6 w-6 rounded-full bg-white transition"
                              : "absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition"
                          }
                        />
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-2xl elegant-button-gold px-6 py-4 font-black transition disabled:opacity-50"
                  >
                    {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
