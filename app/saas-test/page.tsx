"use client";

import { useEffect, useState } from "react";
import {
  CurrentStudio,
  StudioStaffMember,
  getCurrentStudio,
  getPanelPathByRole,
  getStudioStaff,
} from "../../lib/saas/studio";

export default function SaasTestPage() {
  const [studio, setStudio] = useState<CurrentStudio | null>(null);
  const [staff, setStaff] = useState<StudioStaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStudio() {
      const currentStudio = await getCurrentStudio();

      setStudio(currentStudio);

      if (currentStudio?.studio_id) {
        const staffList = await getStudioStaff(currentStudio.studio_id);
        setStaff(staffList);
      }

      setLoading(false);
    }

    loadStudio();
  }, []);

  if (loading) {
    return (
      <main style={{ padding: 40 }}>
        <h1>SaaS Test</h1>
        <p>Stüdyo bilgisi yükleniyor...</p>
      </main>
    );
  }

  if (!studio) {
    return (
      <main style={{ padding: 40 }}>
        <h1>SaaS Test</h1>
        <p>Giriş yapılmış kullanıcıya bağlı aktif stüdyo bulunamadı.</p>
        <p>Önce /login ekranından owner, tasarımcı veya dövmeci hesabıyla giriş yap.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 40, fontFamily: "Arial" }}>
      <h1>SaaS Test Başarılı</h1>

      <div style={{ marginTop: 20 }}>
        <p>
          <strong>Stüdyo ID:</strong> {studio.studio_id}
        </p>
        <p>
          <strong>Stüdyo Adı:</strong> {studio.studio_name}
        </p>
        <p>
          <strong>Slug:</strong> {studio.studio_slug}
        </p>
        <p>
          <strong>Plan:</strong> {studio.plan_name}
        </p>
        <p>
          <strong>Kullanıcı:</strong> {studio.full_name}
        </p>
        <p>
          <strong>Rol:</strong> {studio.role}
        </p>
        <p>
          <strong>Gideceği Panel:</strong> {getPanelPathByRole(studio.role)}
        </p>
      </div>

      <hr style={{ margin: "30px 0" }} />

      <h2>Stüdyo Ekibi</h2>

      {staff.length === 0 ? (
        <p>Ekibe ait kullanıcı bulunamadı.</p>
      ) : (
        <ul>
          {staff.map((member) => (
            <li key={member.member_id}>
              {member.full_name} — {member.role}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}