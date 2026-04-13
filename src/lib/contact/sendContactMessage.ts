import { supabase } from "@/integrations/supabase/client";

export type ContactMessageMode = "platform" | "tenant";

export interface SendContactMessageInput {
  mode: ContactMessageMode;
  tenantId?: string | null;
  senderName: string;
  senderEmail: string;
  senderPhone?: string | null;
  company?: string | null;
  subject?: string | null;
  message: string;
}

export async function sendContactMessage(input: SendContactMessageInput) {
  const { data, error } = await supabase.functions.invoke("send-contact-message", {
    body: {
      mode: input.mode,
      tenantId: input.tenantId || null,
      senderName: input.senderName,
      senderEmail: input.senderEmail,
      senderPhone: input.senderPhone || null,
      company: input.company || null,
      subject: input.subject || null,
      message: input.message,
      hostname: typeof window !== "undefined" ? window.location.hostname : null,
      pathname: typeof window !== "undefined" ? window.location.pathname : null,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}
