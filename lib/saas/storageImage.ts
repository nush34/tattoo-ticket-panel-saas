import { createClient } from "../supabase/client";

function addCacheBuster(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
}

export async function resolveStorageImageUrl(rawImageUrl: string | null) {
  if (!rawImageUrl) return null;

  const cleanValue = rawImageUrl.trim();

  if (!cleanValue) return null;

  if (cleanValue.startsWith("http://") || cleanValue.startsWith("https://")) {
    return addCacheBuster(cleanValue);
  }

  const storagePath = cleanValue
    .replace(/^studio-assets\//, "")
    .replace(/^\/+/, "");

  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from("studio-assets")
    .createSignedUrl(storagePath, 60 * 60);

  if (error) {
    console.error("Ticket image signed url error:", error.message);
    return null;
  }

  return data?.signedUrl ? addCacheBuster(data.signedUrl) : null;
}