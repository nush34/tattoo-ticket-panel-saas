"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { getCurrentStudio, type CurrentStudio } from "../lib/saas/studio";

type StudioSettings = {
  studio_name: string | null;
  logo_url: string | null;
};

function addCacheBuster(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
}

async function resolveNavbarLogo(
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
    console.error("Navbar logo signed url error:", error.message);
    return null;
  }

  return data?.signedUrl ? addCacheBuster(data.signedUrl) : null;
}

export default function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [currentStudio, setCurrentStudio] = useState<CurrentStudio | null>(null);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  const hideNavbar =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/abonelik" ||
    pathname === "/uyelik-satin-al" ||
    pathname.startsWith("/kayit");

  useEffect(() => {
    if (hideNavbar) {
      setLoading(false);
      return;
    }

    loadNavbar();

    function handleSettingsUpdated() {
      loadNavbar();
    }

    window.addEventListener("studio-settings-updated", handleSettingsUpdated);

    return () => {
      window.removeEventListener(
        "studio-settings-updated",
        handleSettingsUpdated
      );
    };
  }, [pathname, hideNavbar]);

  async function loadNavbar() {
    setLoading(true);

    const studio = await getCurrentStudio();

    if (!studio) {
      setCurrentStudio(null);
setSettings(null);
setLogoSrc(null);
setLoading(false);
return;
    }

    setCurrentStudio(studio);

    const supabase = createClient();

    const { data } = await supabase
  .from("studio_settings")
  .select("studio_name, logo_url")
  .eq("studio_id", studio.studio_id)
  .maybeSingle();

const nextLogoSrc = await resolveNavbarLogo(supabase, data?.logo_url || null);

setSettings(data || null);
setLogoSrc(nextLogoSrc);
setLoading(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (hideNavbar) {
    return null;
  }

  if (loading) {
    return null;
  }

  if (!currentStudio) {
    return null;
  }

  const isIndividual = currentStudio.account_type === "individual";
  const role = currentStudio.role;

  const studioDisplayName =
    settings?.studio_name || currentStudio.studio_name || "Tattoo Panel";

  const logoUrl = logoSrc;

  const homeHref = isIndividual ? "/solo-panel" : "/admin-panel";

  const linkClass = (href: string) =>
    `rounded-xl px-3 py-2 text-sm font-semibold transition ${
      pathname === href
        ? "bg-yellow-400 text-neutral-950"
        : "text-neutral-200 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <Link href={homeHref} className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-yellow-400 text-sm font-black text-neutral-950">
            {logoUrl ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={logoUrl}
    alt={studioDisplayName}
    className="h-full w-full object-cover"
  />
) : (
  "TP"
)}
          </div>

          <div>
            <div className="text-sm font-black text-white">
              {studioDisplayName}
            </div>
            <div className="text-xs text-neutral-400">
              {isIndividual ? "Bireysel Solo Panel" : "Stüdyo Paneli"}
            </div>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-2">
          {isIndividual ? (
            <>
              <Link href="/solo-panel" className={linkClass("/solo-panel")}>
                Solo Panel
              </Link>

              <Link href="/ayarlar" className={linkClass("/ayarlar")}>
                Ayarlar
              </Link>
            </>
          ) : (
            <>
              {(role === "owner" || role === "admin") && (
                <>
                  <Link href="/admin-panel" className={linkClass("/admin-panel")}>
                    Admin Panel
                  </Link>

                  <Link href="/yeni-bilet" className={linkClass("/yeni-bilet")}>
                    Yeni Bilet
                  </Link>

                  <Link href="/biletler" className={linkClass("/biletler")}>
                    Biletler
                  </Link>

                  <Link href="/takvim" className={linkClass("/takvim")}>
                    Takvim
                  </Link>

                  <Link href="/raporlar" className={linkClass("/raporlar")}>
                    Raporlar
                  </Link>

                  <Link href="/ayarlar" className={linkClass("/ayarlar")}>
                    Ayarlar
                  </Link>
                </>
              )}

              {role === "designer" && (
                <>
                  <Link
                    href="/tasarimci-panel"
                    className={linkClass("/tasarimci-panel")}
                  >
                    Tasarımcı Paneli
                  </Link>

                  <Link href="/yeni-bilet" className={linkClass("/yeni-bilet")}>
                    Yeni Bilet
                  </Link>

                  <Link href="/biletler" className={linkClass("/biletler")}>
                    Biletler
                  </Link>

                  <Link href="/takvim" className={linkClass("/takvim")}>
                    Takvim
                  </Link>
                </>
              )}

              {role === "artist" && (
                <>
                  <Link
                    href="/dovmeci-panel"
                    className={linkClass("/dovmeci-panel")}
                  >
                    Dövmeci Paneli
                  </Link>

                  <Link href="/takvim" className={linkClass("/takvim")}>
                    Takvim
                  </Link>
                </>
              )}
            </>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-red-500/10 hover:text-red-200"
          >
            Çıkış
          </button>
        </nav>
      </div>
    </header>
  );
}