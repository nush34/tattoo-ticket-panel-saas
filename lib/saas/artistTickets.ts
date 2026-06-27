import { createClient } from "../supabase/client";

export type ArtistTicketStatus = "bekliyor" | "yapildi" | "iptal";

export type ArtistPanelTicket = {
  ticket_id: string;
  studio_id: string;
  tattoo_date: string;
  status: ArtistTicketStatus;
  designer_name: string | null;
  artist_name: string | null;
  visible_price: number | null;
  source: "kapi_musterisi" | "sosyal_medya" | "diger";
  has_guarantee: boolean;
  image_url: string | null;
  refresh_count: number;
  last_refresh_date: string | null;
  created_at: string;
  updated_at: string;
};

export async function getArtistPanelTickets(
  studioId: string
): Promise<ArtistPanelTicket[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_artist_panel_tickets", {
    target_studio_id: studioId,
  });

  if (error) {
    console.error("get_artist_panel_tickets error:", error.message);
    return [];
  }

  return (data || []) as ArtistPanelTicket[];
}

export async function updateArtistTicketStatus(
  ticketId: string,
  status: ArtistTicketStatus
): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error } = await supabase.rpc("artist_update_ticket_status", {
    target_ticket_id: ticketId,
    new_status: status,
  });

  if (error) {
    console.error("artist_update_ticket_status error:", error.message);
    return { error: error.message };
  }

  return { error: null };
}