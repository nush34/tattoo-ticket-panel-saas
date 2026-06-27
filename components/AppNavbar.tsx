"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import {
  CurrentStudio,
  getCurrentStudio,
  getPanelPathByStudio,
} from "../lib/saas/studio";

type NavbarSettings = {
  logo_url: string | null;
};

export default function AppNavbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadNavbar() {
      setLoading(true);

      const hiddenPage = pathname === "/login" || pathname.startsWith("/login/");

      if (hiddenPage) {
        if (!isMounted) return;
        setStudio(null);
        setLogoUrl(null);
        setLoading(false);
        return;
      }

      const supabase = createClient();

      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session?.user) {
        if (!isMounted) return;
        setStudio(null);
        setLogoUrl(null);
        setLoading(false);
        return;
      }

      const currentStudio = await getCurrentStudio();

      if (!currentStudio) {
        if (!isMounted) return;
        setStudio(null);
        setLogoUrl(null);
        setLoading(false);
        return;
      }

      const { data: settingsData } = await supabase
        .from("studio_settings")
        .select("logo_url")
        .eq("studio_id", currentStudio.studio_id)
        .maybeSingle<NavbarSettings>();

      if (!isMounted) return;

      setStudio(currentStudio);
      setLogoUrl(settingsData?.logo_url || null);
      setLoading(false);
    }

    loadNavbar();

    window.addEventListener("studio-settings-updated", loadNavbar);

    return () => {
      isMounted = false;
      window.removeEventListener("studio-settings-updated", loadNavbar);
    };
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function isActive(path: string) {
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  const hiddenPage = pathname === "/login" || pathname.startsWith("/login/");

  if (hiddenPage || loading || !studio) return null;

  const isSolo = studio.account_type === "individual";
  const isAdmin = studio.role === "owner" || studio.role === "admin";
  const isDesigner = studio.role === "designer";
  const isArtist = studio.role === "artist";

  const mainPanelPath = getPanelPathByStudio(studio);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/90 backdrop-blur print:hidden">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex min-h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={mainPanelPath}
              className="flex h-12 min-w-36 items-center justify-center overflow-hidden rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 font-black text-yellow-100"
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={studio.studio_name}
                  className="max-h-9 max-w-32 object-contain"
                />
              ) : (
                <span>Tattoo Panel</span>
              )}
            </Link>

            <div className="hidden md:block min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {studio.studio_name}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {studio.full_name} / {isSolo ? "Bireysel" : roleLabel(studio.role)}
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2 overflow-x-auto">
            {isSolo ? (
              <>
                <NavLink href="/solo-panel" active={isActive("/solo-panel")}>Solo Panel</NavLink>
                <NavLink href="/ayarlar" active={isActive("/ayarlar")}>Ayarlar</NavLink>
              </>
            ) : (
              <>
                {isAdmin && (
                  <NavLink href="/admin-panel" active={isActive("/admin-panel")}>Admin</NavLink>
                )}
                {isDesigner && (
                  <NavLink href="/tasarimci-panel" active={isActive("/tasarimci-panel")}>Tasarımcı</NavLink>
                )}
                {isArtist && (
                  <NavLink href="/dovmeci-panel" active={isActive("/dovmeci-panel")}>Dövmeci</NavLink>
                )}
                {(isAdmin || isDesigner) && (
                  <>
                    <NavLink href="/biletler" active={isActive("/biletler")}>Biletler</NavLink>
                    <NavLink href="/yeni-bilet" active={isActive("/yeni-bilet")}>Yeni Bilet</NavLink>
                    <NavLink href="/takvim" active={isActive("/takvim")}>Takvim</NavLink>
                    <NavLink href="/ayarlar" active={isActive("/ayarlar")}>Ayarlar</NavLink>
                  </>
                )}
                {isAdmin && (
                  <NavLink href="/raporlar" active={isActive("/raporlar")}>Raporlar</NavLink>
                )}
              </>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="whitespace-nowrap rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20"
            >
              Çıkış
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "whitespace-nowrap rounded-2xl border border-yellow-500/40 bg-yellow-500/15 px-4 py-2 text-sm font-bold text-yellow-100"
          : "whitespace-nowrap rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/10 hover:text-white"
      }
    >
      {children}
    </Link>
  );
}

function roleLabel(role: CurrentStudio["role"]) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "designer") return "Tasarımcı";
  if (role === "artist") return "Dövmeci";
  return role;
}
