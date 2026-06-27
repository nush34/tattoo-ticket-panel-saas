"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { CurrentStudio, getCurrentStudio } from "../lib/saas/studio";

type PermissionSettings = {
  artist_can_view_completed_price: boolean;
  designer_can_view_total_revenue: boolean;
};

export default function StudioPermissionSettings() {
  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [settings, setSettings] = useState<PermissionSettings>({
    artist_can_view_completed_price: true,
    designer_can_view_total_revenue: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    const currentStudio = await getCurrentStudio();

    if (!currentStudio) {
      setLoading(false);
      return;
    }

    if (currentStudio.role !== "owner" && currentStudio.role !== "admin") {
      setLoading(false);
      return;
    }

    setStudio(currentStudio);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_studio_permission_settings", {
      target_studio_id: currentStudio.studio_id,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (row) {
      setSettings({
        artist_can_view_completed_price: Boolean(
          row.artist_can_view_completed_price
        ),
        designer_can_view_total_revenue: Boolean(
          row.designer_can_view_total_revenue
        ),
      });
    }

    setLoading(false);
  }

  async function saveSettings() {
    if (!studio) return;

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    const supabase = createClient();

    const { error } = await supabase.rpc("update_studio_permission_settings", {
      target_studio_id: studio.studio_id,
      p_artist_can_view_completed_price:
        settings.artist_can_view_completed_price,
      p_designer_can_view_total_revenue:
        settings.designer_can_view_total_revenue,
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage("Yetki ayarları kaydedildi.");
    setSaving(false);
  }

  function updateSetting<K extends keyof PermissionSettings>(
    key: K,
    value: PermissionSettings[K]
  ) {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setMessage("");
    setErrorMessage("");
  }

  if (loading) return null;
  if (!studio) return null;

  return (
    <section className="rounded-[2rem] elegant-card p-4 md:p-6 mb-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
            Yetki ayarları
          </p>
          <h2 className="text-xl md:text-2xl font-black mt-4">
            Panel Görünürlük Yetkileri
          </h2>
          <p className="text-zinc-500 text-sm mt-2">
            Dövmeci ve tasarımcı panellerinde hangi finansal bilgilerin
            görüneceğini buradan yönetebilirsin.
          </p>
        </div>

        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          className="rounded-2xl elegant-button-gold px-5 py-4 font-black transition disabled:opacity-50"
        >
          {saving ? "Kaydediliyor..." : "Yetkileri Kaydet"}
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 mt-5">
          <p className="text-red-200 font-semibold">Hata</p>
          <p className="text-red-100/80 text-sm mt-1">{errorMessage}</p>
        </div>
      )}

      {message && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 mt-5">
          <p className="text-emerald-200 font-semibold">{message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
        <PermissionToggleCard
          title="Dövmeci fiyat görsün"
          description="Açık olursa dövmeci, kendi panelinde yalnızca Yapıldı durumundaki işlerin fiyatını ve ciro özetini görür. Kapalı olursa fiyat ve ciro bilgisi gizlenir."
          enabled={settings.artist_can_view_completed_price}
          enabledLabel="Dövmeci fiyatı görür"
          disabledLabel="Dövmeci fiyatı görmez"
          onChange={(value) =>
            updateSetting("artist_can_view_completed_price", value)
          }
        />

        <PermissionToggleCard
          title="Tasarımcı toplam ciro görsün"
          description="Açık olursa tasarımcı panelindeki özetler tüm stüdyo cirosuna göre hesaplanır. Kapalı olursa tasarımcı sadece kendi satış cirosunu görür."
          enabled={settings.designer_can_view_total_revenue}
          enabledLabel="Toplam ciro görünür"
          disabledLabel="Sadece kendi cirosu görünür"
          onChange={(value) =>
            updateSetting("designer_can_view_total_revenue", value)
          }
        />
      </div>
    </section>
  );
}

function PermissionToggleCard({
  title,
  description,
  enabled,
  enabledLabel,
  disabledLabel,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  enabledLabel: string;
  disabledLabel: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-3xl elegant-card-soft p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-black text-lg">{title}</h3>
          <p className="text-zinc-500 text-sm mt-2">{description}</p>
        </div>

        <button
          type="button"
          onClick={() => onChange(!enabled)}
          className={
            enabled
              ? "relative h-8 w-14 rounded-full bg-emerald-500/80 border border-emerald-300/40 transition"
              : "relative h-8 w-14 rounded-full bg-zinc-800 border border-zinc-700 transition"
          }
          aria-label={title}
        >
          <span
            className={
              enabled
                ? "absolute right-1 top-1 h-6 w-6 rounded-full bg-white transition"
                : "absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition"
            }
          />
        </button>
      </div>

      <div
        className={
          enabled
            ? "rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3 mt-4 text-emerald-200 text-sm font-semibold"
            : "rounded-2xl bg-yellow-500/10 border border-yellow-500/30 p-3 mt-4 text-yellow-200 text-sm font-semibold"
        }
      >
        {enabled ? enabledLabel : disabledLabel}
      </div>
    </div>
  );
}
