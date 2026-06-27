import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm text-yellow-300">
          Dövme stüdyoları ve bireysel sanatçılar için rezervasyon paneli
        </div>

        <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
          Dövme randevulerini, ödemeleri ve işleri tek panelden takip et.
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-300 md:text-lg">
          Panelingo ile stüdyolar ekiplerini, bireysel sanatçılar ise
          kendi randevu ve ödeme akışını kolayca yönetebilir.
        </p>

        <div className="mt-10 grid w-full max-w-4xl gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-left shadow-2xl">
            <div className="mb-4 inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-300">
              Ücretsiz
            </div>

            <h2 className="text-2xl font-bold">Solo Panel</h2>

            <p className="mt-3 text-sm leading-6 text-neutral-300">
              Bireysel dövme sanatçıları için sade rezervasyon, ödeme ve iş
              takip paneli.
            </p>

            <ul className="mt-5 space-y-2 text-sm text-neutral-200">
              <li>• 1 kullanıcı</li>
              <li>• Rezervasyon oluşturma</li>
              <li>• Ödeme ve kalan tutar takibi</li>
              <li>• Görsel yükleme</li>
              <li>• Aylık takvim</li>
            </ul>

            <Link
              href="/kayit/solo"
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-neutral-950 transition hover:bg-neutral-200"
            >
              Ücretsiz Solo Panel Aç
            </Link>
          </div>

          <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/[0.08] p-6 text-left shadow-2xl">
            <div className="mb-4 inline-flex rounded-full bg-yellow-400/15 px-3 py-1 text-sm font-semibold text-yellow-300">
              30 Gün Deneme
            </div>

            <h2 className="text-2xl font-bold">Stüdyo Paneli</h2>

            <p className="mt-3 text-sm leading-6 text-neutral-300">
              Tasarımcı, dövmeci ve admin rolleriyle çalışan profesyonel stüdyo
              takip sistemi.
            </p>

            <ul className="mt-5 space-y-2 text-sm text-neutral-200">
              <li>• Çoklu kullanıcı</li>
              <li>• Tasarımcı / dövmeci / admin panelleri</li>
              <li>• Bilet ve ödeme yönetimi</li>
              <li>• Raporlar ve ciro takibi</li>
              <li>• Baskı / rezervasyon çıktısı</li>
            </ul>

            <Link
              href="/kayit/studyo"
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-bold text-neutral-950 transition hover:bg-yellow-300"
            >
              30 Gün Ücretsiz Dene
            </Link>
          </div>
        </div>

        <Link
          href="/login"
          className="mt-8 text-sm font-medium text-neutral-400 underline-offset-4 hover:text-white hover:underline"
        >
          Zaten hesabım var, giriş yap
        </Link>
      </section>
    </main>
  );
}