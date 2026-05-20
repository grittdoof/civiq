import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase-server";
import { notifyUrgentUnassigned } from "@/lib/tickets/push";

// ═══════════════════════════════════════════════════════════════
// POST /api/tickets/email-inbound
//
// Webhook destiné à un service de réception email (Cloudflare
// Email Workers, Postmark inbound, SendGrid Inbound Parse…).
//
// Sécurité : signature HMAC-SHA256 dans le header `x-signature`,
// vérifiée contre EMAIL_INBOUND_SECRET (défini en env var).
//
// Payload attendu :
//   {
//     "to":      "tickets@gociviq.fr" | "tickets+slug@…",
//     "from":    "habitant@example.fr",
//     "fromName":"Marie Dupont",            // optionnel
//     "subject": "Lampadaire HS rue …",
//     "body":    "Bonjour, le lampadaire est éteint depuis…",
//     "communeSlug": "chateauneuf",         // ou tag dans `to`
//     "attachments": [                       // optionnel V1 : ignoré
//       { "filename": "photo.jpg", "url": "https://…", "contentType": "image/jpeg" }
//     ]
//   }
//
// Création :
//   - canal = "email"
//   - statut = "nouveau"
//   - priorite = "normale"
//   - categorie = "autre" (V1 : pas de tri auto)
//   - demandeur_email/nom remplis
// ═══════════════════════════════════════════════════════════════

interface InboundPayload {
  to?: string;
  from: string;
  fromName?: string;
  subject: string;
  body?: string;
  communeSlug?: string;
  attachments?: { filename: string; url: string; contentType?: string }[];
}

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // timing-safe comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.EMAIL_INBOUND_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook désactivé (EMAIL_INBOUND_SECRET manquant)" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");
  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  let payload: InboundPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (!payload.from || !payload.subject) {
    return NextResponse.json({ error: "from + subject requis" }, { status: 400 });
  }

  // Résolution de la commune cible :
  //   1. champ explicite communeSlug
  //   2. tag dans to (ex: tickets+chateauneuf@gociviq.fr)
  //   3. fallback : refus (on n'imagine pas créer un ticket sans cible)
  let slug = payload.communeSlug;
  if (!slug && payload.to) {
    const m = payload.to.match(/\+([^@]+)@/);
    if (m) slug = m[1];
  }
  if (!slug) {
    return NextResponse.json({ error: "Commune cible non identifiée (slug)" }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: commune } = await service
    .from("communes")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!commune) {
    return NextResponse.json({ error: `Commune introuvable : ${slug}` }, { status: 404 });
  }

  // Création du ticket
  const titre = payload.subject.length > 200
    ? payload.subject.slice(0, 197) + "…"
    : payload.subject;

  const { data: created, error } = await service
    .from("tickets")
    .insert({
      commune_id: commune.id,
      canal: "email",
      titre,
      description: payload.body?.trim() || null,
      categorie: "autre",
      priorite: "normale",
      statut: "nouveau",
      demandeur_nom: payload.fromName?.trim() || null,
      demandeur_email: payload.from,
    })
    .select("id, numero")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message || "Insertion échouée" }, { status: 500 });
  }

  // Notif aux agents techniques de la commune
  notifyUrgentUnassigned({
    ticketId: created.id,
    ticketNumero: created.numero,
    titre,
    communeId: commune.id,
  }).catch((e) => console.error("[email-inbound] notify:", e));

  // V1 : les pièces jointes sont ignorées. Pour V2 :
  //   pour chaque attachment image → fetch + upload Supabase Storage
  //   + insert dans ticket_photos type=signalement
  if (payload.attachments && payload.attachments.length > 0) {
    console.log(`[email-inbound] ${payload.attachments.length} pièces jointes ignorées (V1)`);
  }

  return NextResponse.json({
    success: true,
    ticket_id: created.id,
    ticket_numero: created.numero,
  });
}

// GET : healthcheck du webhook
export async function GET() {
  const configured = !!process.env.EMAIL_INBOUND_SECRET;
  return NextResponse.json({
    endpoint: "/api/tickets/email-inbound",
    configured,
    docs: "https://github.com/grittdoof/civiq/blob/main/docs/EMAIL_INBOUND.md",
  });
}
