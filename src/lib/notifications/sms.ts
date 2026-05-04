import { createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// Notifications SMS via Twilio
//
// • Strict opt-in : on ne lit que les profils dont
//   notification_preferences.sms_enabled = true ET sms_phone non null.
// • Désactivable globalement par variables d'env (TWILIO_*) absentes
//   → fonction NoOp.
// • Pas de blocage des appels métier en cas d'échec : tout est
//   wrappé en Promise.allSettled + log.
// ═══════════════════════════════════════════════════════════════

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;

export function smsEnabled(): boolean {
  return !!(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM);
}

interface SmsPayload {
  /** Profils destinataires — on filtrera par opt-in */
  profileIds: string[];
  /** Catégorie pour respecter les préférences fines */
  category: "assignment" | "urgent_unassigned" | "comment" | "closure";
  /** Corps SMS (limité à ~160 chars idéalement) */
  body: string;
}

interface SmsResult {
  sent: number;
  skipped: number;
  failed: number;
}

async function sendOneSms(to: string, body: string): Promise<void> {
  if (!smsEnabled()) return;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");
  const params = new URLSearchParams({
    To: to,
    From: TWILIO_FROM!,
    Body: body,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Twilio ${res.status}: ${text.slice(0, 200)}`);
  }
}

export async function sendOptInSms(payload: SmsPayload): Promise<SmsResult> {
  if (!smsEnabled()) return { sent: 0, skipped: payload.profileIds.length, failed: 0 };
  if (payload.profileIds.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  const service = await createServiceClient();
  const { data: prefs } = await service
    .from("notification_preferences")
    .select("profile_id, sms_enabled, sms_phone, notify_assignment, notify_urgent_unassigned, notify_comment, notify_closure")
    .in("profile_id", payload.profileIds)
    .eq("sms_enabled", true);

  // Profils qui ont opt-in pour CETTE catégorie
  const recipients = (prefs ?? []).filter((p) => {
    if (!p.sms_phone) return false;
    switch (payload.category) {
      case "assignment": return p.notify_assignment;
      case "urgent_unassigned": return p.notify_urgent_unassigned;
      case "comment": return p.notify_comment;
      case "closure": return p.notify_closure;
    }
  });

  const skipped = payload.profileIds.length - recipients.length;
  if (recipients.length === 0) return { sent: 0, skipped, failed: 0 };

  const results = await Promise.allSettled(
    recipients.map((r) => sendOneSms(r.sms_phone!, payload.body))
  );

  let sent = 0, failed = 0;
  results.forEach((r) => {
    if (r.status === "fulfilled") sent++;
    else { failed++; console.error("[sms]", r.reason); }
  });

  return { sent, skipped, failed };
}
