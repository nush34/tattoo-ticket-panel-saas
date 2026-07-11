"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { getCurrentStudio, type CurrentStudio } from "../lib/saas/studio";

type StudioSettings = {
  studio_name: string | null;
  logo_url: string | null;
};

type ExtraLink = {
  href: string;
  label: string;
  description: string;
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

  if (
    cleanValue.startsWith("http://") ||
    cleanValue.startsWith("https://")
  ) {
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

  return data?.signedUrl
    ? addCacheBuster(data.signedUrl)
    : null;
}

export default function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  const extrasMenuRef = useRef<HTMLDivElement | null>(null);

  const [currentStudio, setCurrentStudio] =
    useState<CurrentStudio | null>(null);

  const [settings, setSettings] =
    useState<StudioSettings | null>(null);

  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  const [hasAdvancedReports, setHasAdvancedReports] =
    useState(false);

  const [hasWhatsAppReminders, setHasWhatsAppReminders] =
    useState(false);

  const [extrasOpen, setExtrasOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const hideNavbar =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/abonelik" ||
    pathname === "/uyelik-satin-al" ||
    pathname.startsWith("/kayit") ||
    pathname.includes("/print");

  useEffect(() => {
    if (hideNavbar) {
      setLoading(false);
      return;
    }

    loadNavbar();

    function handleSettingsUpdated() {
      loadNavbar();
    }

    window.addEventListener(
      "studio-settings-updated",
      handleSettingsUpdated
    );

    return () => {
      window.removeEventListener(
        "studio-settings-updated",
        handleSettingsUpdated
      );
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hideNavbar]);

  useEffect(() => {
    setExtrasOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;

      if (
        extrasMenuRef.current &&
        !extrasMenuRef.current.contains(target)
      ) {
        setExtrasOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  async function loadNavbar() {
    setLoading(true);

    const studio = await getCurrentStudio();

    if (!studio) {
      setCurrentStudio(null);
      setSettings(null);
      setLogoSrc(null);
      setHasAdvancedReports(false);
      setHasWhatsAppReminders(false);
      setLoading(false);
      return;
    }

    setCurrentStudio(studio);

    const supabase = createClient();

    const { data, error } = await supabase
      .from("studio_settings")
      .select("studio_name, logo_url")
      .eq("studio_id", studio.studio_id)
      .maybeSingle();

    if (error) {
      console.error("Navbar settings error:", error.message);

      setSettings(null);
      setLogoSrc(null);
    } else {
      const nextLogoSrc = await resolveNavbarLogo(
        supabase,
        data?.logo_url || null
      );

      setSettings(data || null);
      setLogoSrc(nextLogoSrc);
    }

    const canManageAddons =
      studio.role === "owner" || studio.role === "admin";

    const canUseAdvancedReports =
      studio.account_type === "studio" && canManageAddons;

    if (canUseAdvancedReports) {
      const { data: addonData, error: addonError } =
        await supabase.rpc("has_my_addon", {
          p_addon_code: "advanced_reports",
        });

      if (addonError) {
        console.error(
          "Navbar advanced reports addon error:",
          addonError.message
        );

        setHasAdvancedReports(false);
      } else {
        setHasAdvancedReports(Boolean(addonData));
      }
    } else {
      setHasAdvancedReports(false);
    }

    if (canManageAddons) {
      const {
        data: whatsappAddonData,
        error: whatsappAddonError,
      } = await supabase.rpc("has_my_addon", {
        p_addon_code: "whatsapp_reminders",
      });

      if (whatsappAddonError) {
        console.error(
          "Navbar WhatsApp reminders addon error:",
          whatsappAddonError.message
        );

        setHasWhatsAppReminders(false);
      } else {
        setHasWhatsAppReminders(Boolean(whatsappAddonData));
      }
    } else {
      setHasWhatsAppReminders(false);
    }

    setLoading(false);
  }

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/login");
    router.refresh();
  }

  if (hideNavbar) return null;
  if (loading) return null;
  if (!currentStudio) return null;

  const isIndividual =
    currentStudio.account_type === "individual";

  const role = currentStudio.role;

  const canManageExtras =
    isIndividual || role === "owner" || role === "admin";

  const studioDisplayName =
    settings?.studio_name ||
    currentStudio.studio_name ||
    "Tattoo Panel";

  const homeHref = isIndividual
    ? "/solo-panel"
    : role === "designer"
      ? "/tasarimci-panel"
      : role === "artist"
        ? "/dovmeci-panel"
        : "/admin-panel";

  const activeExtraLinks: ExtraLink[] = [];

  if (hasAdvancedReports) {
    activeExtraLinks.push({
      href: "/gelismis-raporlar",
      label: "Gelişmiş Raporlar",
      description: "Detaylı performans ve finans analizleri",
    });
  }

  if (hasWhatsAppReminders) {
    activeExtraLinks.push({
      href: "/whatsapp-hatirlatma",
      label: "WhatsApp Hatırlatma",
      description: "Randevular için hazır WhatsApp mesajları",
    });
  }

  const isExtrasRouteActive = activeExtraLinks.some(
    (extra) =>
      pathname === extra.href ||
      pathname.startsWith(`${extra.href}/`)
  );

  const linkClass = (href: string) => {
    const isActive =
      pathname === href ||
      (href !== "/" && pathname.startsWith(`${href}/`));

    return `rounded-xl px-3 py-2 text-sm font-semibold transition ${
      isActive
        ? "bg-yellow-400 text-neutral-950"
        : "text-neutral-200 hover:bg-white/10 hover:text-white"
    }`;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <Link
          href={homeHref}
          className="flex items-center gap-3"
        >
          <div className="flex h-12 w-12 items-center justify-center overflow-visible rounded-2xl">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt={studioDisplayName}
                className="h-full w-full object-contain"
                style={{
                  filter:
                    "drop-shadow(0.45px 0 0 white) drop-shadow(-0.45px 0 0 white) drop-shadow(0 0.45px 0 white) drop-shadow(0 -0.45px 0 white)",
                }}
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-sm font-black text-neutral-950">
                TP
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-black text-white">
              {studioDisplayName}
            </div>

            <div className="text-xs text-neutral-400">
              {isIndividual
                ? "Bireysel Solo Panel"
                : "Stüdyo Paneli"}
            </div>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-2">
          {isIndividual ? (
            <Link
              href="/solo-panel"
              className={linkClass("/solo-panel")}
            >
              Solo Panel
            </Link>
          ) : (
            <>
              {(role === "owner" || role === "admin") && (
                <>
                  <Link
                    href="/admin-panel"
                    className={linkClass("/admin-panel")}
                  >
                    Admin Panel
                  </Link>

                  <Link
                    href="/yeni-bilet"
                    className={linkClass("/yeni-bilet")}
                  >
                    Yeni Bilet
                  </Link>

                  <Link
                    href="/biletler"
                    className={linkClass("/biletler")}
                  >
                    Biletler
                  </Link>

                  <Link
                    href="/takvim"
                    className={linkClass("/takvim")}
                  >
                    Takvim
                  </Link>

                  <Link
                    href="/raporlar"
                    className={linkClass("/raporlar")}
                  >
                    Raporlar
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

                  <Link
                    href="/yeni-bilet"
                    className={linkClass("/yeni-bilet")}
                  >
                    Yeni Bilet
                  </Link>

                  <Link
                    href="/biletler"
                    className={linkClass("/biletler")}
                  >
                    Biletler
                  </Link>

                  <Link
                    href="/takvim"
                    className={linkClass("/takvim")}
                  >
                    Takvim
                  </Link>
                </>
              )}

              {role === "artist" && (
                <Link
                  href="/dovmeci-panel"
                  className={linkClass("/dovmeci-panel")}
                >
                  Dövmeci Paneli
                </Link>
              )}
            </>
          )}

          {canManageExtras ? (
            <>
              {activeExtraLinks.length > 0 ? (
                <div
                  ref={extrasMenuRef}
                  className="relative"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExtrasOpen((current) => !current)
                    }
                    aria-expanded={extrasOpen}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      isExtrasRouteActive
                        ? "bg-yellow-400 text-neutral-950"
                        : "text-neutral-200 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    Ekstralar

                    <span
                      className={`text-xs transition-transform ${
                        extrasOpen ? "rotate-180" : ""
                      }`}
                    >
                      ▼
                    </span>
                  </button>

                  {extrasOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 p-2 shadow-2xl shadow-black/50">
                      <div className="border-b border-white/10 px-3 py-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-yellow-300">
                          Aktif Ekstralar
                        </p>

                        <p className="mt-1 text-xs text-neutral-500">
                          Hesabına tanımlanmış özellikler
                        </p>
                      </div>

                      <div className="mt-2 space-y-1">
                        {activeExtraLinks.map((extra) => {
                          const isActive =
                            pathname === extra.href ||
                            pathname.startsWith(
                              `${extra.href}/`
                            );

                          return (
                            <Link
                              key={extra.href}
                              href={extra.href}
                              onClick={() =>
                                setExtrasOpen(false)
                              }
                              className={`block rounded-xl px-3 py-3 transition ${
                                isActive
                                  ? "bg-yellow-400 text-neutral-950"
                                  : "text-white hover:bg-white/10"
                              }`}
                            >
                              <p className="text-sm font-black">
                                {extra.label}
                              </p>

                              <p
                                className={`mt-1 text-xs ${
                                  isActive
                                    ? "text-neutral-800"
                                    : "text-neutral-500"
                                }`}
                              >
                                {extra.description}
                              </p>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Link
                href="/eklentiler"
                className={linkClass("/eklentiler")}
              >
                Eklentiler
              </Link>

              <Link
                href="/ayarlar"
                className={linkClass("/ayarlar")}
              >
                Ayarlar
              </Link>
            </>
          ) : null}

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