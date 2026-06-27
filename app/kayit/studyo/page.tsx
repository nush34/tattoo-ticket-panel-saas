"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function StudioTrialRegisterPage() {
  const router = useRouter();

  const [studioName, setStudioName] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [userLimit, setUserLimit] = useState("5");

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/public/register-studio-trial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studioName,
          ownerFullName,
          ownerEmail,
          ownerPassword,
          userLimit: Number(userLimit),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.error || "Kayıt oluşturulamadı.");
        setSaving(false);
        return;
      }

      setSuccessMessage("Stüdyo deneme hesabınız oluşturuldu. Giriş sayfasına yönlendiriliyorsunuz...");

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

        <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/[0.06] p-6 shadow-2xl md:p-8">
          <div className="mb-5 inline-flex rounded-full bg-yellow-400/15 px-3 py-1 text-sm font-semibold text-yellow-300">
            30 Gün Ücretsiz Deneme
          </div>

          <h1 className="text-3xl font-bold">Stüdyo panelini oluştur</h1>

          <p className="mt-3 text-sm leading-6 text-neutral-300">
            Tasarımcı, dövmeci ve admin rolleriyle çalışan stüdyolar için 30 gün
            ücretsiz deneme hesabı.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-200">
                Stüdyo Adı
              </label>
              <input
                value={studioName}
                onChange={(event) => setStudioName(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-yellow-400"
                placeholder="Örn: Black Line Tattoo"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-200">
                Yetkili Ad Soyad
              </label>
              <input
                value={ownerFullName}
                onChange={(event) => setOwnerFullName(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-yellow-400"
                placeholder="Örn: Tolga Yunar"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-200">
                E-posta
              </label>
              <input
                type="email"
                value={ownerEmail}
                onChange={(event) => setOwnerEmail(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-yellow-400"
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
                value={ownerPassword}
                onChange={(event) => setOwnerPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-yellow-400"
                placeholder="En az 6 karakter"
                minLength={6}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-200">
                Başlangıç Kullanıcı Limiti
              </label>
              <select
                value={userLimit}
                onChange={(event) => setUserLimit(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-yellow-400"
              >
                <option value="3">3 kullanıcı</option>
                <option value="5">5 kullanıcı</option>
                <option value="10">10 kullanıcı</option>
                <option value="15">15 kullanıcı</option>
                <option value="20">20 kullanıcı</option>
              </select>
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
              className="w-full rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-bold text-neutral-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Deneme hesabı oluşturuluyor..." : "30 Gün Ücretsiz Dene"}
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