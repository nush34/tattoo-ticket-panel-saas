"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { getCurrentStudio, type CurrentStudio } from "../../lib/saas/studio";

type StudioSettings = {
  id?: string;
  studio_id: string;
  studio_name: string | null;
  logo_url: string | null;
  phone: string | null;
  instagram: string | null;
  address: string | null;
  print_footer_text: string | null;
  watermark_enabled: boolean | null;
  artist_can_see_completed_price: boolean | null;
  designer_can_see_total_revenue: boolean | null;
  theme_color: string | null;
};

function isValidHexColor(value: string) {
  return /^#([0-9A-F]{3}){1,2}$/i.test(value);
}

function addCacheBuster(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
}

async function resolveLogoPreview(
  supabase: ReturnType<typeof createClient>,
  rawLogoUrl: string | null
) {
  if (!rawLogoUrl) return null;

  const cleanValue = rawLogoUrl.trim();

  if (!cleanValue) return null;

  if (cleanValue.startsWith("http://") || cleanValue.startsWith("https://")) {
    return addCacheBuster(cleanValue);
  }

  const storagePath = cleanValue
    .replace(/^studio-assets\//, "")
    .replace(/^\/+/, "");

  const { data, error } = await supabase.storage
    .from("studio-assets")
    .createSignedUrl(storagePath, 60 * 60);

  if (error) {
    console.error("Logo preview signed url error:", error.message);
    return null;
  }

  return data?.signedUrl ? addCacheBuster(data.signedUrl) : null;
}

export default function AyarlarPage() {
  const router = useRouter();

  const [currentStudio, setCurrentStudio] = useState<CurrentStudio | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const [studioName, setStudioName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [address, setAddress] = useState("");
  const [printFooterText, setPrintFooterText] = useState("");
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);

  const [artistCanSeeCompletedPrice, setArtistCanSeeCompletedPrice] =
    useState(false);
  const [designerCanSeeTotalRevenue, setDesignerCanSeeTotalRevenue] =
    useState(false);

  const [themeColor, setThemeColor] = useState("#facc15");

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isIndividual = currentStudio?.account_type === "individual";

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const studio = await getCurrentStudio();

    if (!studio) {
      router.replace("/login");
      return;
    }

    if (
      studio.account_type !== "individual" &&
      (studio.studio_status === "suspended" ||
        studio.studio_status === "cancelled")
    ) {
      router.replace("/abonelik");
      return;
    }

    setCurrentStudio(studio);

    const { data, error } = await supabase
      .from("studio_settings")
      .select(
        `
        id,
        studio_id,
        studio_name,
        logo_url,
        phone,
        instagram,
        address,
        print_footer_text,
        watermark_enabled,
        artist_can_see_completed_price,
        designer_can_see_total_revenue,
        theme_color
      `
      )
      .eq("studio_id", studio.studio_id)
      .maybeSingle();

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const loadedSettings = data as StudioSettings | null;

    setSettingsId(loadedSettings?.id || null);

    setStudioName(loadedSettings?.studio_name || studio.studio_name || "");
    setPhone(loadedSettings?.phone || "");
    setInstagram(loadedSettings?.instagram || "");
    setAddress(loadedSettings?.address || "");
    setPrintFooterText(loadedSettings?.print_footer_text || "");
    setWatermarkEnabled(loadedSettings?.watermark_enabled ?? true);

    setArtistCanSeeCompletedPrice(
      loadedSettings?.artist_can_see_completed_price ?? false
    );

    setDesignerCanSeeTotalRevenue(
      loadedSettings?.designer_can_see_total_revenue ?? false
    );

    const loadedThemeColor = isValidHexColor(
      loadedSettings?.theme_color || ""
    )
      ? loadedSettings!.theme_color!
      : "#facc15";

    setThemeColor(loadedThemeColor);

    const loadedLogoUrl = loadedSettings?.logo_url || null;
    setLogoUrl(loadedLogoUrl);

    const previewUrl = await resolveLogoPreview(supabase, loadedLogoUrl);
    setLogoPreviewUrl(previewUrl);

    setLoading(false);
  }

  function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;

    setLogoFile(file);

    if (file) {
      const localPreviewUrl = URL.createObjectURL(file);
      setLogoPreviewUrl(localPreviewUrl);
    }
  }

  async function uploadLogoIfNeeded() {
    if (!currentStudio) return logoUrl;

    if (!logoFile) return logoUrl;

    const supabase = createClient();

    const fileExt = logoFile.name.split(".").pop() || "png";
    const safeExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";

    const filePath = `${currentStudio.studio_id}/logo/logo-${Date.now()}.${safeExt}`;

    const { error: uploadError } = await supabase.storage
      .from("studio-assets")
      .upload(filePath, logoFile, {
        upsert: true,
        contentType: logoFile.type || "image/png",
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    return filePath;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentStudio) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (!isValidHexColor(themeColor)) {
        setErrorMessage("Tema rengi geçerli bir HEX renk kodu olmalı. Örn: #facc15");
        setSaving(false);
        return;
      }

      const supabase = createClient();

      const nextLogoUrl = await uploadLogoIfNeeded();

      const payload = {
        studio_id: currentStudio.studio_id,
        studio_name: studioName.trim(),
        logo_url: nextLogoUrl,
        phone: phone.trim(),
        instagram: instagram.trim(),
        address: address.trim(),
        print_footer_text: printFooterText.trim(),
        watermark_enabled: watermarkEnabled,
        artist_can_see_completed_price: isIndividual
          ? false
          : artistCanSeeCompletedPrice,
        designer_can_see_total_revenue: isIndividual
          ? false
          : designerCanSeeTotalRevenue,
        theme_color: themeColor,
      };

      let saveError = null;

      if (settingsId) {
        const { error } = await supabase
          .from("studio_settings")
          .update(payload)
          .eq("id", settingsId);

        saveError = error;
      } else {
        const { error } = await supabase.from("studio_settings").insert(payload);

        saveError = error;
      }

      if (saveError) {
        setErrorMessage(saveError.message);
        setSaving(false);
        return;
      }

      setLogoUrl(nextLogoUrl);
      setLogoFile(null);

      const previewUrl = await resolveLogoPreview(supabase, nextLogoUrl);
      setLogoPreviewUrl(previewUrl);

      setSuccessMessage("Ayarlar kaydedildi.");
      window.dispatchEvent(new Event("studio-settings-updated"));

      setSaving(false);
    } catch (error: any) {
      setErrorMessage(error?.message || "Ayarlar kaydedilemedi.");
      setSaving(false);
    }
  }

  async function handleRemoveLogo() {
    setLogoFile(null);
    setLogoUrl(null);
    setLogoPreviewUrl(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            Ayarlar yükleniyor...
          </div>
        </div>
      </main>
    );
  }

  if (!currentStudio) {
    return null;
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <div
            className="mb-4 inline-flex rounded-full border px-4 py-2 text-sm font-bold"
            style={{
              borderColor: `${themeColor}55`,
              backgroundColor: `${themeColor}18`,
              color: themeColor,
            }}
          >
            Panel Ayarları
          </div>

          <h1 className="text-4xl font-black">Ayarlar</h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300">
            Panel adı, logo, iletişim bilgileri, baskı ayarları ve tema rengini
            buradan düzenleyebilirsin.
          </p>
        </div>

        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        <form onSubmit={handleSave} className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-black">Kimlik ve görünüm</h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-200">
                  {isIndividual ? "Panel / Sanatçı Adı" : "Stüdyo Adı"}
                </label>

                <input
                  value={studioName}
                  onChange={(event) => setStudioName(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
                  placeholder="Örn: Tolgattoo"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-200">
                  Panel Tema Rengi
                </label>

                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(event) => setThemeColor(event.target.value)}
                    className="h-12 w-16 cursor-pointer rounded-xl border border-white/10 bg-neutral-900"
                  />

                  <input
                    value={themeColor}
                    onChange={(event) => setThemeColor(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
                    placeholder="#facc15"
                  />
                </div>

                <p className="mt-2 text-xs text-neutral-500">
                  Bu renk navbar logo kutusunda ve aktif menü renginde kullanılır.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-[180px_1fr]">
              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-200">
                  Logo Önizleme
                </label>

                <div
                  className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-3xl text-xl font-black text-neutral-950"
                  style={{ backgroundColor: themeColor }}
                >
                  {logoPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoPreviewUrl}
                      alt="Logo önizleme"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    "TP"
                  )}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-200">
                  Logo Yükle
                </label>

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-bold file:text-neutral-950"
                />

                <p className="mt-2 text-xs leading-5 text-neutral-500">
                  Logo navbar’da, baskı çıktısında ve panel kimliğinde kullanılır.
                  Kare veya yatay sade logo daha iyi görünür.
                </p>

                {(logoPreviewUrl || logoUrl) && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="mt-4 rounded-2xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/10"
                  >
                    Logoyu Kaldır
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-black">İletişim bilgileri</h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-200">
                  Telefon
                </label>

                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
                  placeholder="Örn: 05xx xxx xx xx"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-200">
                  Instagram
                </label>

                <input
                  value={instagram}
                  onChange={(event) => setInstagram(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
                  placeholder="Örn: @tolgattoo"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-neutral-200">
                  Adres
                </label>

                <textarea
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
                  placeholder="Adres bilgisi"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-black">Baskı ayarları</h2>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-200">
                  Baskı Alt Yazısı
                </label>

                <textarea
                  value={printFooterText}
                  onChange={(event) => setPrintFooterText(event.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
                  placeholder="Baskı çıktısında en altta görünecek not"
                />
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4">
                <div>
                  <div className="text-sm font-bold text-white">
                    Baskıda watermark logo görünsün
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    Açık olduğunda çıktı sayfasının ortasında düşük opaklıkta
                    logo görünür.
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={watermarkEnabled}
                  onChange={(event) => setWatermarkEnabled(event.target.checked)}
                  className="h-5 w-5"
                />
              </label>
            </div>
          </section>

          {!isIndividual ? (
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-black">Yetki ayarları</h2>

              <div className="mt-6 space-y-4">
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4">
                  <div>
                    <div className="text-sm font-bold text-white">
                      Dövmeci, tamamlanan işin fiyatını görebilsin
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      Açık olduğunda dövmeci panelinde sadece “Yapıldı” olan
                      işlerin fiyatı görünür.
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={artistCanSeeCompletedPrice}
                    onChange={(event) =>
                      setArtistCanSeeCompletedPrice(event.target.checked)
                    }
                    className="h-5 w-5"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4">
                  <div>
                    <div className="text-sm font-bold text-white">
                      Tasarımcı genel stüdyo cirosunu görebilsin
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      Kapalı olduğunda tasarımcı sadece kendi satış cirosunu
                      görür.
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={designerCanSeeTotalRevenue}
                    onChange={(event) =>
                      setDesignerCanSeeTotalRevenue(event.target.checked)
                    }
                    className="h-5 w-5"
                  />
                </label>
              </div>
            </section>
          ) : null}

          <div className="sticky bottom-4 z-20 rounded-3xl border border-white/10 bg-neutral-950/90 p-4 backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-neutral-400">
                Değişiklikleri kaydettiğinde navbar ve baskı ayarları güncellenir.
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl px-6 py-3 text-sm font-black text-neutral-950 transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: themeColor }}
              >
                {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}