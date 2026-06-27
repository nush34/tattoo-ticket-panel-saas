"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function UyelikSatinAlPage() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-4 inline-flex rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-300">
              Üyelik Satın Alma
            </div>

            <h1 className="text-4xl font-black">Panel üyeliğini yenile</h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300">
              Stüdyo panelini tekrar aktif hale getirmek için uygun paketi seç.
              Ödeme entegrasyonu tamamlanana kadar üyelik yenileme işlemleri
              manuel olarak onaylanacaktır.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-red-500/10 hover:text-red-200"
          >
            Çıkış Yap
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-4 text-sm font-bold text-neutral-400">
              Starter
            </div>

            <div className="text-3xl font-black">2.500 ₺</div>
            <div className="mt-1 text-sm text-neutral-400">Aylık</div>

            <ul className="mt-6 space-y-2 text-sm text-neutral-300">
              <li>• Stüdyo paneli</li>
              <li>• Çoklu kullanıcı</li>
              <li>• Bilet ve ödeme takibi</li>
              <li>• Takvim</li>
              <li>• Raporlar</li>
            </ul>

            <a
              href="mailto:destek@tattoopanel.com?subject=Starter üyelik satın alma"
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-yellow-300"
            >
              Starter Satın Al
            </a>
          </div>

          <div className="rounded-3xl border border-yellow-400/30 bg-yellow-400/[0.08] p-6 shadow-2xl">
            <div className="mb-4 inline-flex rounded-full bg-yellow-400/15 px-3 py-1 text-sm font-bold text-yellow-300">
              Önerilen
            </div>

            <div className="text-sm font-bold text-neutral-400">
              Professional
            </div>

            <div className="mt-4 text-3xl font-black">3.500 ₺</div>
            <div className="mt-1 text-sm text-neutral-400">Aylık</div>

            <ul className="mt-6 space-y-2 text-sm text-neutral-300">
              <li>• Starter içindeki her şey</li>
              <li>• Daha yüksek kullanıcı limiti</li>
              <li>• Gelişmiş rapor takibi</li>
              <li>• Öncelikli destek</li>
              <li>• Stüdyo büyüme paketi</li>
            </ul>

            <a
              href="mailto:destek@tattoopanel.com?subject=Professional üyelik satın alma"
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-yellow-300"
            >
              Professional Satın Al
            </a>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-4 text-sm font-bold text-neutral-400">
              Custom
            </div>

            <div className="text-3xl font-black">Özel</div>
            <div className="mt-1 text-sm text-neutral-400">İhtiyaca göre</div>

            <ul className="mt-6 space-y-2 text-sm text-neutral-300">
              <li>• Büyük ekipler</li>
              <li>• Özel kullanıcı limiti</li>
              <li>• Özel destek</li>
              <li>• Kurulum desteği</li>
              <li>• Özel fiyatlandırma</li>
            </ul>

            <a
              href="mailto:destek@tattoopanel.com?subject=Custom üyelik paketi"
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
            >
              Teklif Al
            </a>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-black">Ödeme sonrası ne olacak?</h2>

          <p className="mt-3 text-sm leading-6 text-neutral-300">
            Ödeme onaylandıktan sonra hesabın Super Admin panelinden aktif hale
            getirilir. Hesap aktif edildiğinde giriş yaptığında otomatik olarak
            kendi paneline yönlendirilirsin.
          </p>

          <Link
            href="/abonelik"
            className="mt-5 inline-flex rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-neutral-300 transition hover:bg-white/10 hover:text-white"
          >
            Abonelik Durumuna Dön
          </Link>
        </div>
      </div>
    </main>
  );
}