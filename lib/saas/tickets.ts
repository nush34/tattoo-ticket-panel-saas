import { createClient } from "../supabase/client";

export type SaasTicketStatus = "bekliyor" | "yapildi" | "iptal";

export type SaasTicket = {
  ticket_id: string;
  studio_id: string;
  customer_name: string;
  customer_phone: string | null;
  tattoo_date: string;
  status: SaasTicketStatus;
  designer_member_id: string | null;
  designer_name: string | null;
  artist_member_id: string | null;
  artist_name: string | null;
  price: number;
  total_paid: number;
  remaining_amount: number;
  source: "kapi_musterisi" | "sosyal_medya" | "diger";
  has_guarantee: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateSaasTicketInput = {
  studioId: string;
  customerName: string;
  customerPhone: string;
  tattooDate: string;
  designerMemberId: string | null;
  artistMemberId: string | null;
  price: number;
  source: "kapi_musterisi" | "sosyal_medya" | "diger";
  hasGuarantee: boolean;
  initialPaymentAmount: number;
  initialPaymentMethod: "nakit" | "kart" | null;
};

export async function getStudioTickets(
  studioId: string
): Promise<SaasTicket[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_studio_tickets", {
    target_studio_id: studioId,
  });

  if (error) {
    console.error("get_studio_tickets error:", error.message);
    return [];
  }

  return (data || []) as SaasTicket[];
}

export async function createStudioTicket(
  input: CreateSaasTicketInput
): Promise<{ ticketId: string | null; error: string | null }> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("create_studio_ticket", {
    target_studio_id: input.studioId,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_tattoo_date: input.tattooDate,
    p_designer_member_id: input.designerMemberId,
    p_artist_member_id: input.artistMemberId,
    p_price: input.price,
    p_source: input.source,
    p_has_guarantee: input.hasGuarantee,
    p_initial_payment_amount: input.initialPaymentAmount,
    p_initial_payment_method: input.initialPaymentMethod,
  });

  if (error) {
    console.error("create_studio_ticket error:", error.message);
    return {
      ticketId: null,
      error: error.message,
    };
  }

  return {
    ticketId: data as string,
    error: null,
  };
}