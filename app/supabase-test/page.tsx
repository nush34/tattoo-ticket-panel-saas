"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SupabaseTestPage() {
  const [status, setStatus] = useState("Kontrol ediliyor...");

  useEffect(() => {
    async function testConnection() {
      const supabase = createClient();

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setStatus(`Bağlantı hatası: ${error.message}`);
        return;
      }

      if (data.session) {
        setStatus("Supabase bağlantısı çalışıyor. Aktif oturum var.");
      } else {
        setStatus("Supabase bağlantısı çalışıyor. Henüz giriş yapılmamış.");
      }
    }

    testConnection();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-3xl bg-zinc-900 border border-zinc-800 p-8">
        <a href="/" className="text-sm text-zinc-400 hover:text-white">
          ← Ana sayfaya dön
        </a>

        <h1 className="text-3xl font-bold mt-4">Supabase Test</h1>

        <p className="text-zinc-300 mt-4">{status}</p>
      </div>
    </main>
  );
}