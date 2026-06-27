"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import {
  getCurrentStudio,
  getPanelPathByStudio,
} from "../../lib/saas/studio";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    await supabase.auth.signOut();

    const normalizedEmail = email.trim().toLowerCase();

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    if (loginError || !loginData.user) {
      setErrorMessage(loginError?.message || "Giriş yapılamadı.");
      setLoading(false);
      return;
    }

    const currentStudio = await getCurrentStudio();

    if (currentStudio) {
      router.replace(getPanelPathByStudio(currentStudio));
      return;
    }

    const { data: superAdminRow, error: superAdminError } = await supabase
      .from("super_admins")
      .select("id, user_id, is_active")
      .eq("user_id", loginData.user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (superAdminError) {
      console.error("Super admin kontrol hatası:", superAdminError.message);
    }

    if (superAdminRow) {
      router.replace("/super-admin");
      return;
    }

    await supabase.auth.signOut();

    setErrorMessage("Bu kullanıcı herhangi bir aktif hesaba bağlı değil.");
    setLoading(false);
  }

  return (
    <main className="min-h-screen elegant-page text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[2rem] elegant-card p-6 md:p-8">
        <div className="mb-6">
          <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
            SaaS Tattoo Panel
          </p>

          <h1 className="text-3xl md:text-4xl font-black mt-4">Giriş Yap</h1>

          <p className="text-zinc-400 mt-2 text-sm">
            Super admin, stüdyo hesabı veya bireysel solo hesabınla giriş yap.
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 mb-5">
            <p className="text-red-200 text-sm font-semibold">Hata</p>
            <p className="text-red-100/80 text-sm mt-1">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              placeholder="ornek@mail.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-2xl elegant-input px-4 py-4 text-white"
              placeholder="Şifren"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl elegant-button-gold px-4 py-4 font-black transition disabled:opacity-50"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </main>
  );
}
