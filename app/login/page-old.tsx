"use client";

import { FormEvent, useEffect, useState } from "react";
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

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [checkingSession, setCheckingSession] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function checkExistingSession() {
      const supabase = createClient();

      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session?.user) {
        setCheckingSession(false);
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
        setCheckingSession(false);
        return;
      }

      if (!profileData.is_active) {
        await supabase.auth.signOut();
        setErrorMessage("Bu kullanıcı pasif durumda. Admin ile görüşmelisin.");
        setCheckingSession(false);
        return;
      }

      router.push(getPanelPath(profileData.role));
    }

    checkExistingSession();
  }, [router]);

  function getPanelPath(role: UserRole) {
    if (role === "admin") return "/admin-panel";
    if (role === "tasarimci") return "/tasarimci-panel";
    if (role === "dovmeci") return "/dovmeci-panel";

    return "/";
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoggingIn(true);
    setErrorMessage("");

    const supabase = createClient();

    const cleanEmail = email.trim().toLowerCase();

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

    if (loginError || !loginData.user) {
      setErrorMessage("Giriş yapılamadı. E-posta veya şifre hatalı olabilir.");
      setLoggingIn(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, is_active")
      .eq("id", loginData.user.id)
      .single<Profile>();

    if (profileError || !profileData) {
      await supabase.auth.signOut();
      setErrorMessage("Kullanıcı profili bulunamadı.");
      setLoggingIn(false);
      return;
    }

    if (!profileData.is_active) {
      await supabase.auth.signOut();
      setErrorMessage("Bu kullanıcı pasif durumda. Admin ile görüşmelisin.");
      setLoggingIn(false);
      return;
    }

    router.push(getPanelPath(profileData.role));
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen elegant-page text-white flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md rounded-[2rem] elegant-card p-6 md:p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-yellow-500/30 bg-yellow-500/10 shadow-[0_0_55px_rgba(212,175,55,0.15)]">
            <span className="text-lg font-black elegant-gold">TT</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-black mt-6">
            Tattoo Ticket Panel
          </h1>

          <p className="text-zinc-400 mt-3 text-sm md:text-base">
            Oturum kontrol ediliyor. Giriş yaptıysan paneline yönlendirileceksin.
          </p>

          <div className="mt-8 h-2 w-full rounded-full bg-white/5 overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-700 animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen elegant-page text-white flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
          <section className="hidden lg:flex rounded-[2rem] elegant-card p-8 xl:p-10 flex-col justify-between overflow-hidden relative">
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-yellow-500/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/5 blur-3xl" />

            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-yellow-500/30 bg-yellow-500/10 shadow-[0_0_55px_rgba(212,175,55,0.15)]">
                <span className="text-lg font-black elegant-gold">TT</span>
              </div>

              <h1 className="text-5xl font-black mt-8 leading-tight">
                Studio işlerini tek panelde yönet.
              </h1>

              <p className="text-zinc-400 mt-5 text-lg leading-relaxed">
                Tasarımcı, dövmeci ve admin rollerine göre ayrılmış güvenli
                bilet, randevu, ödeme, garanti ve refresh takip sistemi.
              </p>
            </div>

            <div className="relative grid grid-cols-3 gap-3 mt-10">
              <div className="rounded-3xl elegant-card-soft p-5">
                <p className="text-xs text-zinc-500">Rol</p>
                <p className="font-bold mt-2">Admin</p>
              </div>

              <div className="rounded-3xl elegant-card-soft p-5">
                <p className="text-xs text-zinc-500">Panel</p>
                <p className="font-bold mt-2">Tasarımcı</p>
              </div>

              <div className="rounded-3xl elegant-card-soft p-5">
                <p className="text-xs text-zinc-500">Takip</p>
                <p className="font-bold mt-2">Dövmeci</p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] elegant-card p-6 md:p-8 xl:p-10">
            <div className="lg:hidden mb-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-yellow-500/30 bg-yellow-500/10 shadow-[0_0_55px_rgba(212,175,55,0.15)]">
                <span className="text-lg font-black elegant-gold">TT</span>
              </div>

              <h1 className="text-3xl font-black mt-5">Tattoo Ticket Panel</h1>

              <p className="text-zinc-400 mt-2 text-sm">
                Stüdyo bilet ve randevu yönetimi.
              </p>
            </div>

            <div className="mb-8">
              <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
                Güvenli giriş
              </p>

              <h2 className="text-4xl font-black mt-5">Giriş Yap</h2>

              <p className="text-zinc-400 mt-3 text-sm md:text-base">
                Admin, tasarımcı ve dövmeci kullanıcıları aynı ekrandan giriş
                yapar. Sistem seni rolüne göre otomatik yönlendirir.
              </p>
            </div>

            {errorMessage && (
              <div className="rounded-3xl bg-red-500/10 border border-red-500/30 p-4 mb-5">
                <p className="text-red-200 text-sm">{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  E-posta
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setErrorMessage("");
                  }}
                  required
                  autoComplete="email"
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                  placeholder="ornek@tattoo.com"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Şifre
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setErrorMessage("");
                  }}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
                  placeholder="Şifreni gir"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full rounded-2xl elegant-button-gold px-5 py-4 font-black transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loggingIn ? "Giriş yapılıyor..." : "Panele Giriş Yap"}
              </button>
            </form>

            <div className="rounded-3xl elegant-card-soft p-4 mt-6">
              <p className="text-zinc-500 text-sm">
                Giriş yaptıktan sonra yetkine göre admin, tasarımcı veya dövmeci
                paneline otomatik yönlendirileceksin.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}