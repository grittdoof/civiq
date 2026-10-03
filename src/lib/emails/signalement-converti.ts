import { communeEmailShell, esc, paragraph, type EmailCommune } from "./commune-shell";

// ═══════════════════════════════════════════════════════════════
// Email au demandeur d'un signalement converti en projet (lot G).
// Envoyé seulement si l'agent le choisit dans l'assistant.
// Volontairement sans détail du projet (titre, budget, élus) : le
// projet peut devenir confidentiel, et rien ne doit en sortir.
// ═══════════════════════════════════════════════════════════════

export interface SignalementConvertiEmail {
  siteUrl: string;
  commune: EmailCommune;
  demandeurNom: string | null;
  numero: number;
  titre: string;
  dateSignalement: string; // ISO
}

const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

export function buildSignalementConvertiEmail(p: SignalementConvertiEmail): { subject: string; html: string; text: string } {
  const bonjour = p.demandeurNom ? `Bonjour ${p.demandeurNom},` : "Bonjour,";
  const ref = `n° ${p.numero} « ${p.titre} »`;
  const subject = `Votre signalement ${ref} est intégré à un projet de la commune`;
  const corps = [
    `Votre signalement ${ref}, transmis le ${dateFr(p.dateSignalement)}, a été étudié par les services de la mairie de ${p.commune.name}.`,
    "Il ne relève pas d'une simple intervention : il est désormais suivi dans un projet municipal, qui demande davantage de préparation (études, financement, décision des élus). Les délais sont donc plus longs qu'une réparation courante.",
    "Pour toute question, vous pouvez contacter la mairie aux coordonnées ci-dessous.",
  ];
  const rows = `<tr><td style="padding:12px 32px 28px;">
    ${paragraph(esc(bonjour))}
    ${corps.map((c) => paragraph(esc(c))).join("\n")}
  </td></tr>`;
  const html = communeEmailShell({
    siteUrl: p.siteUrl,
    commune: p.commune,
    eyebrow: "Votre signalement",
    title: "Votre demande est prise en compte dans un projet",
    rows,
    footnote: `Message envoyé par la mairie de ${p.commune.name} via GoCiviq.`,
  });
  const text = [bonjour, "", ...corps, "", `Mairie de ${p.commune.name}`,
    p.commune.phone ? `Tél. ${p.commune.phone}` : "", p.commune.contact_email ?? ""].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  return { subject, html, text };
}
