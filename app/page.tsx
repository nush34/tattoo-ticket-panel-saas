"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UserRole = "admin" | "tasarimci" | "dovmeci";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function redirectUser() {
      const supabase = createClient();

      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session?.user) {
        router.push("/login");
        return;
      }

      const userId = sessionData.session.user.id;

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active")
        .eq("id", userId)
        .single<Profile>();

      if (profileError || !profileData) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      if (!profileData.is_active) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      if (profileData.role === "admin") {
        router.push("/admin-panel");
        return;
      }

      if (profileData.role === "tasarimci") {
        router.push("/tasarimci-panel");
        return;
      }

      if (profileData.role === "dovmeci") {
        router.push("/dovmeci-panel");
        return;
      }

      router.push("/login");
    }

    redirectUser();
  }, [router]);

  return (
    <main className="min-h-screen elegant-page text-white flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] elegant-card p-6 md:p-8 text-center overflow-hidden relative">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-yellow-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/5 blur-3xl" />

          <div className="relative">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-yellow-500/30 bg-yellow-500/10 shadow-[0_0_55px_rgba(212,175,55,0.15)]">
              <span className="text-lg font-black elegant-gold">TT</span>
            </div>

            <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold mt-6">
              Sistem kontrol ediliyor
            </p>

            <h1 className="text-3xl md:text-4xl font-black mt-5">
              Tattoo Ticket Panel
            </h1>

            <p className="text-zinc-400 mt-3 text-sm md:text-base leading-relaxed">
              Oturumun kontrol ediliyor. Giriş durumuna ve kullanıcı rolüne göre
              doğru panele yönlendiriliyorsun.
            </p>

            <div className="mt-8 h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-700 animate-pulse" />
            </div>

            <div className="grid grid-cols-3 gap-3 mt-8">
              <div className="rounded-2xl elegant-card-soft p-3">
                <p className="text-[11px] text-zinc-500">Rol</p>
                <p className="font-bold text-sm mt-1">Admin</p>
              </div>

              <div className="rounded-2xl elegant-card-soft p-3">
                <p className="text-[11px] text-zinc-500">Panel</p>
                <p className="font-bold text-sm mt-1">Tasarımcı</p>
              </div>

              <div className="rounded-2xl elegant-card-soft p-3">
                <p className="text-[11px] text-zinc-500">Takip</p>
                <p className="font-bold text-sm mt-1">Dövmeci</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}