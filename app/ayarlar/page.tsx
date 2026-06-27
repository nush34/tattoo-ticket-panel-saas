"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StudioPrintSettings from "../../components/StudioPrintSettings";
import StudioPermissionSettings from "../../components/StudioPermissionSettings";
import { createClient } from "../../lib/supabase/client";
import {
  CurrentStudio,
  getCurrentStudio,
  getPanelPathByStudio,
} from "../../lib/saas/studio";

export default function AyarlarPage() {
  const router = useRouter();
  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPage() {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session?.user) {
        router.push("/login");
        return;
      }

      const currentStudio = await getCurrentStudio();

      if (!currentStudio) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      if (currentStudio.role !== "owner" && currentStudio.role !== "admin") {
        router.push(getPanelPathByStudio(currentStudio));
        return;
      }

      setStudio(currentStudio);
      setLoading(false);
    }

    loadPage();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen elegant-page text-white flex items-center justify-center p-4 md:p-6">
        <div className="rounded-[2rem] elegant-card p-6 md:p-8">
          <h1 className="text-2xl font-bold">Ayarlar yükleniyor...</h1>
          <p className="text-zinc-400 mt-2 text-sm md:text-base">
            Hesap ayarları hazırlanıyor.
          </p>
        </div>
      </main>
    );
  }

  const isIndividual = studio?.account_type === "individual";

  return (
    <main className="min-h-screen elegant-page text-white p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 md:mb-8">
          <p className="inline-flex rounded-full elegant-badge-gold px-3 py-1 text-xs font-semibold">
            {isIndividual ? "Solo ayarları" : "Stüdyo ayarları"}
          </p>

          <h1 className="text-3xl md:text-4xl font-black mt-4">Ayarlar</h1>

          <p className="text-zinc-400 mt-2 text-sm md:text-base max-w-3xl">
            {isIndividual
              ? "Solo panel kimliğini, navbar logosunu ve çıktı/baskı bilgilerini bu bölümden yönet."
              : "Stüdyo adını, navbar logosunu, çıktı/baskı ayarlarını ve panel görünürlük yetkilerini bu bölümden yönet."}
          </p>

          {studio && (
            <p className="text-zinc-500 mt-2 text-xs md:text-sm">
              Aktif hesap: {studio.studio_name}
            </p>
          )}
        </div>

        <StudioPrintSettings />

        {!isIndividual && <StudioPermissionSettings />}
      </div>
    </main>
  );
}
