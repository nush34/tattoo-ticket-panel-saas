"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SoloRegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/public/register-solo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          artistName,
          email,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.error || "Kayıt oluşturulamadı.");
        setSaving(false);
        return;
      }

      setSuccessMessage("Solo panel hesabınız oluşturuldu. Giriş sayfasına yönlendiriliyorsunuz...");

      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch (error: any) {
      setErrorMessage(error?.message || "Beklenmeyen bir hata oluştu.");
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-xl">
        <Link
          href="/"
          className="mb-6 inline-flex text-sm text-neutral-400 hover:text-white"
        >
          ← Ana sayfaya dön
        </Link>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl md:p-8">
          <div className="mb-5 inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-300">
            Ücretsiz Solo Panel
          </div>

          <h1 className="text-3xl font-bold">Bireysel panelini oluştur</h1>

          <p className="mt-3 text-sm leading-6 text-neutral-300">
            Bireysel dövme sanatçıları için ücretsiz, tek kullanıcılı rezervasyon
            ve ödeme takip paneli.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-200">
                Ad Soyad
              </label>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                placeholder="Örn: Tolga Yunar"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-200">
                Sanatçı / Panel Adı
              </label>
              <input
                value={artistName}
                onChange={(event) => setArtistName(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                placeholder="Örn: Tolga Tattoo"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-200">
                E-posta
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                placeholder="ornek@mail.com"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-200">
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                placeholder="En az 6 karakter"
                minLength={6}
                required
              />
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {successMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-neutral-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Hesap oluşturuluyor..." : "Ücretsiz Solo Panel Aç"}
            </button>
          </form>

          <Link
            href="/login"
            className="mt-6 block text-center text-sm text-neutral-400 hover:text-white"
          >
            Zaten hesabım var, giriş yap
          </Link>
        </div>
      </div>
    </main>
  );
}