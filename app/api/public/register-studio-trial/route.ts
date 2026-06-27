import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/adminClient";

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const studioName = String(body.studioName || "").trim();
    const ownerFullName = String(body.ownerFullName || "").trim();
    const ownerEmail = cleanEmail(String(body.ownerEmail || ""));
    const ownerPassword = String(body.ownerPassword || "");
    const userLimit = Number(body.userLimit || 3);

    if (!studioName || !ownerFullName || !ownerEmail || !ownerPassword) {
      return NextResponse.json(
        { error: "Lütfen tüm alanları doldurun." },
        { status: 400 }
      );
    }

    if (ownerPassword.length < 6) {
      return NextResponse.json(
        { error: "Şifre en az 6 karakter olmalı." },
        { status: 400 }
      );
    }

    const safeUserLimit = Math.min(Math.max(userLimit, 2), 20);

    const supabase = createAdminClient();

    const { data: existingMembers, error: existingMemberError } = await supabase
      .from("studio_members")
      .select("id")
      .eq("email", ownerEmail)
      .limit(1);

    if (existingMemberError) {
      return NextResponse.json(
        { error: existingMemberError.message },
        { status: 400 }
      );
    }

    if (existingMembers && existingMembers.length > 0) {
      return NextResponse.json(
        {
          error:
            "Bu e-posta daha önce başka bir panel hesabında kullanılmış. Lütfen farklı bir e-posta girin.",
        },
        { status: 400 }
      );
    }

    const baseSlug = slugify(studioName);
    const studioSlug = `${baseSlug || "studio"}-${Date.now()}`;

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
        user_metadata: {
          full_name: ownerFullName,
          account_type: "studio",
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error:
            authError?.message ||
            "Kullanıcı oluşturulamadı. Lütfen farklı bir e-posta deneyin.",
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    const { data: studio, error: studioError } = await supabase
      .from("studios")
      .insert({
        name: studioName,
        slug: studioSlug,
        status: "trial",
        account_type: "studio",
        user_limit: safeUserLimit,
        plan_name: "Studio Trial",
        payment_status: "trial",
        monthly_price: 0,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        subscription_start_date: null,
        subscription_end_date: null,
      })
      .select("id, name, slug")
      .single();

    if (studioError || !studio) {
      await supabase.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        { error: studioError?.message || "Stüdyo hesabı oluşturulamadı." },
        { status: 400 }
      );
    }

    const { error: memberError } = await supabase.from("studio_members").insert({
      studio_id: studio.id,
      user_id: authData.user.id,
      full_name: ownerFullName,
      email: ownerEmail,
      role: "owner",
      is_active: true,
    });

    if (memberError) {
      await supabase.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        { error: memberError.message },
        { status: 400 }
      );
    }

    await supabase.from("studio_settings").insert({
      studio_id: studio.id,
      studio_name: studioName,
      phone: "",
      instagram: "",
      address: "",
      print_footer_text: "",
      watermark_enabled: true,
      artist_can_see_completed_price: false,
      designer_can_see_total_revenue: false,
    });

    return NextResponse.json({
      success: true,
      message: "Stüdyo deneme hesabınız oluşturuldu.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Beklenmeyen bir hata oluştu." },
      { status: 500 }
    );
  }
}