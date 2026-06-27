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

    const fullName = String(body.fullName || "").trim();
    const email = cleanEmail(String(body.email || ""));
    const password = String(body.password || "");
    const artistName = String(body.artistName || "").trim();

    if (!fullName || !email || !password || !artistName) {
      return NextResponse.json(
        { error: "Lütfen tüm alanları doldurun." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Şifre en az 6 karakter olmalı." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: existingMembers, error: existingMemberError } = await supabase
      .from("studio_members")
      .select("id")
      .eq("email", email)
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

    const baseSlug = slugify(artistName);
    const studioSlug = `${baseSlug || "solo"}-${Date.now()}`;

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          account_type: "individual",
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

    const { data: studio, error: studioError } = await supabase
      .from("studios")
      .insert({
        name: artistName,
        slug: studioSlug,
        status: "active",
        account_type: "individual",
        user_limit: 1,
        plan_name: "Ücretsiz Solo",
        payment_status: "free",
        monthly_price: 0,
        trial_started_at: now.toISOString(),
        trial_ends_at: null,
        subscription_start_date: null,
        subscription_end_date: null,
      })
      .select("id, name, slug")
      .single();

    if (studioError || !studio) {
      await supabase.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        { error: studioError?.message || "Solo hesap oluşturulamadı." },
        { status: 400 }
      );
    }

    const { error: memberError } = await supabase.from("studio_members").insert({
      studio_id: studio.id,
      user_id: authData.user.id,
      full_name: fullName,
      email,
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
      studio_name: artistName,
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
      message: "Solo panel hesabınız oluşturuldu.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Beklenmeyen bir hata oluştu." },
      { status: 500 }
    );
  }
}