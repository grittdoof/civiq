/* eslint-disable jsx-a11y/alt-text */
import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from "@react-pdf/renderer";
import {
  CANAL_LABELS,
  CATEGORIE_LABELS,
  PRIORITE_LABELS,
  STATUT_LABELS,
  GROUP_LABELS,
  groupOf,
  type TicketCategorie,
  type TicketPriorite,
  type TicketStatut,
  type TicketCanal,
} from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// TicketsPDF — rendu PDF synthétique de tous les tickets.
// Utilise @react-pdf/renderer (pure JS, fonctionne en serverless).
// ═══════════════════════════════════════════════════════════════

// Pas de police custom (évite dépendance externe au build).
// Helvetica est la fonte par défaut PDF.
Font.registerHyphenationCallback((word) => [word]); // pas de coupure agressive

export interface PdfTicket {
  id: string;
  numero: number;
  titre: string;
  description: string | null;
  canal: TicketCanal;
  priorite: TicketPriorite;
  statut: TicketStatut;
  categorie: TicketCategorie;
  adresse: string | null;
  created_at: string;
  demandeur_nom: string | null;
  demandeur_telephone: string | null;
  demandeur_email: string | null;
  agentNames: string[];
  photoUrl: string | null;
  comments: Array<{
    id: string;
    contenu: string;
    is_systeme: boolean;
    created_at: string;
  }>;
}

export interface TicketsPDFProps {
  communeName: string;
  filterLabel: string;
  generatedAt: string;
  tickets: PdfTicket[];
}

const PRIO_COLORS: Record<TicketPriorite, { bg: string; fg: string }> = {
  basse:    { bg: "#E5E7EB", fg: "#4B5563" },
  normale:  { bg: "#DBEAFE", fg: "#1E40AF" },
  haute:    { bg: "#FEF3C7", fg: "#92400E" },
  urgente:  { bg: "#FEE2E2", fg: "#991B1B" },
};

const GROUP_COLOR: Record<"ouvert" | "cloture", { bg: string; fg: string }> = {
  ouvert:  { bg: "#DBEAFE", fg: "#1E40AF" },
  cloture: { bg: "#D1FAE5", fg: "#065F46" },
};

const s = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 32,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111111",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2,
    borderBottomColor: "#111111",
    paddingBottom: 10,
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 8,
    color: "#666666",
    letterSpacing: 1.2,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
  },
  metaRight: {
    fontSize: 9,
    color: "#444444",
    textAlign: "right",
  },
  ticket: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 4,
    padding: 10,
    marginBottom: 12,
  },
  ticketHead: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    marginBottom: 8,
    gap: 6,
  },
  numero: {
    fontSize: 9,
    color: "#888888",
    fontFamily: "Courier",
    marginRight: 4,
  },
  titre: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
    flex: 1,
  },
  tagRow: {
    flexDirection: "row",
    gap: 3,
    flexWrap: "wrap",
  },
  tag: {
    fontSize: 8,
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    borderRadius: 99,
    fontFamily: "Helvetica-Bold",
  },
  body: {
    flexDirection: "row",
    gap: 10,
  },
  bodyNoPhoto: {
    flexDirection: "column",
  },
  photo: {
    width: 120,
    height: 90,
    borderRadius: 3,
    objectFit: "cover",
  },
  fields: {
    flex: 1,
    flexDirection: "column",
    gap: 3,
  },
  kvRow: {
    flexDirection: "row",
    fontSize: 9,
    gap: 6,
  },
  kvLabel: {
    width: 80,
    color: "#666666",
    fontFamily: "Helvetica-Bold",
  },
  kvValue: {
    flex: 1,
    color: "#111111",
  },
  journal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },
  journalTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#666666",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  journalRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 2,
    fontSize: 8.5,
  },
  journalDate: {
    width: 64,
    fontFamily: "Courier",
    color: "#666666",
    fontSize: 8,
  },
  journalType: {
    width: 50,
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: "#888888",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  journalContent: {
    flex: 1,
    color: "#222222",
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 32,
    right: 32,
    fontSize: 8,
    color: "#888888",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#DDDDDD",
    paddingTop: 6,
  },
});

export function TicketsPDF({ communeName, filterLabel, generatedAt, tickets }: TicketsPDFProps) {
  return (
    <Document title={`Tickets — ${communeName}`} author="GoCiviq">
      <Page size="A4" style={s.page} wrap>
        {/* Header */}
        <View style={s.header} fixed>
          <View>
            <Text style={s.eyebrow}>SYNTHÈSE TICKETS D&apos;INTERVENTION</Text>
            <Text style={s.title}>{communeName}</Text>
          </View>
          <View>
            <Text style={s.metaRight}>{generatedAt}</Text>
            <Text style={s.metaRight}>
              {tickets.length} ticket{tickets.length > 1 ? "s" : ""}
              {filterLabel ? ` · ${filterLabel}` : ""}
            </Text>
          </View>
        </View>

        {tickets.length === 0 ? (
          <Text style={{ textAlign: "center", color: "#666666", marginTop: 40 }}>
            Aucun ticket à afficher.
          </Text>
        ) : (
          tickets.map((t) => <TicketBlock key={t.id} t={t} />)
        )}

        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Document généré le ${generatedAt} · GoCiviq · Page ${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

function TicketBlock({ t }: { t: PdfTicket }) {
  const group = groupOf(t.statut);
  const prio = PRIO_COLORS[t.priorite];
  const grp = GROUP_COLOR[group];
  const created = new Date(t.created_at).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <View style={s.ticket} wrap={false}>
      <View style={s.ticketHead}>
        <Text style={s.numero}>#{t.numero}</Text>
        <Text style={s.titre}>{t.titre}</Text>
        <View style={s.tagRow}>
          <Text style={[s.tag, { backgroundColor: prio.bg, color: prio.fg }]}>
            {PRIORITE_LABELS[t.priorite]}
          </Text>
          <Text style={[s.tag, { backgroundColor: grp.bg, color: grp.fg }]}>
            {GROUP_LABELS[group]} · {STATUT_LABELS[t.statut]}
          </Text>
          <Text style={[s.tag, { backgroundColor: "#F0F0F0", color: "#444444" }]}>
            {CATEGORIE_LABELS[t.categorie]}
          </Text>
        </View>
      </View>

      <View style={t.photoUrl ? s.body : s.bodyNoPhoto}>
        {t.photoUrl && <Image src={t.photoUrl} style={s.photo} />}
        <View style={s.fields}>
          {t.description && <Kv label="Description" value={t.description} />}
          {t.adresse && <Kv label="Adresse" value={t.adresse} />}
          <Kv label="Créé le" value={created} />
          <Kv label="Canal" value={CANAL_LABELS[t.canal]} />
          {(t.demandeur_nom || t.demandeur_telephone || t.demandeur_email) && (
            <Kv
              label="Demandeur"
              value={[t.demandeur_nom, t.demandeur_telephone, t.demandeur_email]
                .filter(Boolean)
                .join(" · ")}
            />
          )}
          <Kv
            label={`Agent${t.agentNames.length > 1 ? "s" : ""} assigné${t.agentNames.length > 1 ? "s" : ""}`}
            value={t.agentNames.length ? t.agentNames.join(", ") : "Non assigné"}
          />
        </View>
      </View>

      {t.comments.length > 0 && (
        <View style={s.journal}>
          <Text style={s.journalTitle}>JOURNAL D&apos;ACTIVITÉ</Text>
          {t.comments.map((c) => (
            <View key={c.id} style={s.journalRow}>
              <Text style={s.journalDate}>
                {new Date(c.created_at).toLocaleString("fr-FR", {
                  day: "2-digit", month: "2-digit",
                  hour: "2-digit", minute: "2-digit",
                })}
              </Text>
              <Text style={s.journalType}>
                {c.is_systeme ? "Système" : "Comment."}
              </Text>
              <Text style={s.journalContent}>{c.contenu}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.kvRow}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={s.kvValue}>{value}</Text>
    </View>
  );
}
