import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/adminClient";

type AccountType = "studio" | "individual";

function createSlug(value: string) {
  return value
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

function isValidAccountType(value: string): value is AccountType {
  return value === "studio" || value === "individual";
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Oturum doğrulanamadı." },
        { status: 401 }
      );
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: "Super admin kullanıcısı doğrulanamadı." },
        { status: 401 }
      );
    }

    const { data: superAdminData, error: superAdminError } =
      await supabaseAdmin
        .from("super_admins")
        .select("id, is_active")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .maybeSingle();

    if (superAdminError) {
      return NextResponse.json(
        { error: superAdminError.message },
        { status: 500 }
      );
    }

    if (!superAdminData) {
      return NextResponse.json(
        { error: "Bu işlem için super admin yetkisi gerekli." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const accountTypeRaw = String(body.accountType || body.account_type || "studio");
    const accountType: AccountType = isValidAccountType(accountTypeRaw)
      ? accountTypeRaw
      : "studio";

    const studioName = String(
      body.studioName || body.studio_name || ""
    ).trim();

    const ownerFullName = String(
      body.ownerFullName || body.ownerName || body.owner_full_name || ""
    ).trim();

    const ownerEmail = String(
      body.ownerEmail || body.owner_email || body.email || ""
    )
      .trim()
      .toLowerCase();

    const ownerPassword = String(
      body.ownerPassword || body.owner_password || body.password || ""
    );

    const requestedUserLimit = Number(body.userLimit || body.user_limit || 3);

    const userLimit =
      accountType === "individual"
        ? 1
        : requestedUserLimit > 0
          ? requestedUserLimit
          : 3;

    if (!studioName) {
      return NextResponse.json(
        { error: "Hesap / stüdyo adı zorunlu." },
        { status: 400 }
      );
    }

    if (!ownerFullName) {
      return NextResponse.json(
        { error: "Owner adı zorunlu." },
        { status: 400 }
      );
    }

    if (!ownerEmail) {
      return NextResponse.json(
        { error: "Owner e-posta zorunlu." },
        { status: 400 }
      );
    }

    if (!ownerPassword || ownerPassword.length < 6) {
      return NextResponse.json(
        { error: "Owner şifresi en az 6 karakter olmalı." },
        { status: 400 }
      );
    }

    const baseSlug = createSlug(studioName);
    const studioSlug = `${baseSlug}-${Date.now()}`;

    const { data: createdUser, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
        user_metadata: {
          full_name: ownerFullName,
          studio_name: studioName,
          account_type: accountType,
        },
      });

    if (createUserError || !createdUser.user) {
      return NextResponse.json(
        {
          error:
            createUserError?.message || "Owner kullanıcısı oluşturulamadı.",
        },
        { status: 400 }
      );
    }

    const ownerUserId = createdUser.user.id;

    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    const studioInsert: any =
  accountType === "individual"
    ? {
        name: studioName,
        slug: studioSlug,
        status: "active",
        account_type: "individual",
        user_limit: 1,
        plan_name: "Ücretsiz Solo",
        payment_status: "free",
        monthly_price: 0,
        trial_started_at: now.toISOString(),
        trial_ends_at: null,
      }
    : {
        name: studioName,
        slug: studioSlug,
        status: "trial",
        account_type: "studio",
        user_limit: userLimit,
        plan_name: "Studio Trial",
        payment_status: "trial",
        monthly_price: 0,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
      };

    const { data: studioData, error: studioError } = await supabaseAdmin
      .from("studios")
      .insert(studioInsert)
      .select("id, name, slug, status, account_type, user_limit")
      .single();

    if (studioError || !studioData) {
      await supabaseAdmin.auth.admin.deleteUser(ownerUserId);

      return NextResponse.json(
        { error: studioError?.message || "Hesap oluşturulamadı." },
        { status: 400 }
      );
    }

    const { error: memberError } = await supabaseAdmin
      .from("studio_members")
      .insert({
        studio_id: studioData.id,
        user_id: ownerUserId,
        full_name: ownerFullName,
        email: ownerEmail,
        role: "owner",
        is_active: true,
      });

    if (memberError) {
      await supabaseAdmin.from("studios").delete().eq("id", studioData.id);
      await supabaseAdmin.auth.admin.deleteUser(ownerUserId);

      return NextResponse.json(
        { error: memberError.message },
        { status: 400 }
      );
    }

    const { error: settingsError } = await supabaseAdmin
      .from("studio_settings")
      .insert({
        studio_id: studioData.id,
      });

    if (settingsError) {
      await supabaseAdmin
        .from("studio_members")
        .delete()
        .eq("studio_id", studioData.id);

      await supabaseAdmin.from("studios").delete().eq("id", studioData.id);
      await supabaseAdmin.auth.admin.deleteUser(ownerUserId);

      return NextResponse.json(
        { error: settingsError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      studio: studioData,
      owner: {
        user_id: ownerUserId,
        email: ownerEmail,
        full_name: ownerFullName,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Bilinmeyen hata oluştu.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}