"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    async function logout() {
      const supabase = createClient();

      await supabase.auth.signOut();

      setTimeout(() => {
        router.push("/login");
      }, 650);
    }

    logout();
  }, [router]);

  return (
    <main className="min-h-screen elegant-page text-white flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] elegant-card p-6 md:p-8 text-center overflow-hidden relative">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-red-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-yellow-500/10 blur-3xl" />

          <div className="relative">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-yellow-500/30 bg-yellow-500/10 shadow-[0_0_55px_rgba(212,175,55,0.15)]">
              <span className="text-lg font-black elegant-gold">TT</span>
            </div>

            <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold mt-6">
              Oturum kapatılıyor
            </p>

            <h1 className="text-3xl md:text-4xl font-black mt-5">
              Güvenli çıkış yapılıyor
            </h1>

            <p className="text-zinc-400 mt-3 text-sm md:text-base leading-relaxed">
              Oturum bilgilerin temizleniyor. Kısa süre içinde giriş ekranına
              yönlendirileceksin.
            </p>

            <div className="mt-8 h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-700 animate-pulse" />
            </div>

            <div className="rounded-3xl elegant-card-soft p-4 mt-8">
              <p className="text-zinc-500 text-sm">
                Panel güvenliği için ortak cihazlarda işin bittikten sonra çıkış
                yapman önerilir.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}