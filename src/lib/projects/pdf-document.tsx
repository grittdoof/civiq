/* eslint-disable jsx-a11y/alt-text */
import path from "node:path";
import {
  Document, Page, View, Text, StyleSheet, Font,
} from "@react-pdf/renderer";
import { PdfHeader, PdfFooter } from "./pdf-header";
import {
  PROJECT_PHASE_LABELS,
  STAKEHOLDER_ROLE_LABELS,
  STAKEHOLDER_TYPE_LABELS,
  FINANCING_STATUS_LABELS,
  type FinancingStatus,
  type ProjectPhase,
  type StakeholderRole,
  type StakeholderType,
} from "./types";

// ═══════════════════════════════════════════════════════════════
// Export PDF d'une fiche projet (1 projet) — modèle synthétique
// à destination d'un comité, d'un élu ou d'un financeur.
// ═══════════════════════════════════════════════════════════════

if (typeof window === "undefined") {
  const fontsDir = path.join(process.cwd(), "public", "fonts");
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(fontsDir, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(fontsDir, "Inter-Bold.ttf"), fontWeight: 700 },
    ],
  });
}
Font.registerHyphenationCallback((word) => [word]);

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
function fmtEur(n: number): string { return EUR.format(n); }
function fmtPct(n: number): string { return (n / 100).toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 1 }); }

const s = StyleSheet.create({
  // Padding bottom plus large pour laisser place au pied de page fixé
  page: { fontFamily: "Inter", fontSize: 10, padding: 32, paddingBottom: 72, color: "#1f2937" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, borderBottom: 1, borderColor: "#e5e7eb", paddingBottom: 10 },
  communeName: { fontSize: 14, fontWeight: 700, color: "#111827" },
  generatedAt: { fontSize: 9, color: "#6b7280" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 14 },
  section: { marginTop: 14, marginBottom: 4 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#111827", borderBottom: 1, borderColor: "#e5e7eb", paddingBottom: 3 },
  sectionTitleHighlight: { backgroundColor: "#fef3c7", padding: 4, marginLeft: -4, marginRight: -4 },
  para: { lineHeight: 1.4, marginBottom: 4 },
  kvRow: { flexDirection: "row", marginBottom: 3 },
  kvLabel: { width: 130, color: "#6b7280" },
  kvValue: { flex: 1, fontWeight: 700 },
  // Tableau
  table: { marginTop: 4 },
  tr: { flexDirection: "row", borderBottom: 0.5, borderColor: "#e5e7eb", paddingVertical: 4 },
  trHead: { flexDirection: "row", backgroundColor: "#f3f4f6", paddingVertical: 4, paddingHorizontal: 4 },
  th: { fontSize: 9, fontWeight: 700, color: "#374151" },
  td: { fontSize: 9, paddingHorizontal: 4 },
  // Coûts highlight
  costGrid: { flexDirection: "row", gap: 8, marginVertical: 6 },
  costCell: { flex: 1, padding: 8, backgroundColor: "#f9fafb", borderRadius: 4 },
  costCellHl: { backgroundColor: "#fef3c7" },
  costLabel: { fontSize: 8, color: "#6b7280", textTransform: "uppercase" },
  costValue: { fontSize: 13, fontWeight: 700, marginTop: 2 },
  costRates: { fontSize: 7, color: "#6b7280", marginTop: 2 },
});

export interface ProjectPdfData {
  communeName: string;
  communeLogoUrl: string | null;
  generatedAt: string;

  titre: string;
  description: string | null;
  objectifs: string | null;
  competence: string;
  phase: ProjectPhase;
  pilote_elu: string | null;
  pilote_agent: string | null;
  sans_subvention: boolean;
  source_ticket_label: string | null;

  budget_estime: number;
  cost_total_nominal: number;
  cost_total_actualise: number;
  taux_inflation: number;
  taux_actualisation: number;

  financings: Array<{ financeur: string; montant_demande: number | null; montant_obtenu: number | null; statut: FinancingStatus }>;
  milestones: Array<{ phase: ProjectPhase; libelle: string; echeance: string | null; fait: boolean }>;
  lifecycle: Array<{ annee: number; cout_fonctionnement: number; cout_entretien: number }>;
  stakeholders: Array<{ nom: string; type: StakeholderType; role: StakeholderRole; phase: ProjectPhase | null }>;

  cout_reel: number | null;
  ecart_value: number | null;
  ecart_pct: number | null;
  explication_ecart: string | null;
  show_bilan: boolean;

  /** Progression de l'avancement des livrables par phase (résumé). */
  phase_progress_summary: Array<{
    phase: ProjectPhase;
    label: string;
    objective: string;
    deliverables: Array<{ label: string; kind: string; done: boolean; note: string | null }>;
    pctDone: number;
    status: "done" | "current" | "future";
  }>;
}

export function ProjectPDF(props: ProjectPdfData) {
  const totalDemande = props.financings.reduce((sum, f) => sum + (f.montant_demande ?? 0), 0);
  const totalObtenu = props.financings.reduce((sum, f) => sum + (f.montant_obtenu ?? 0), 0);
  const restACharge = props.budget_estime - totalObtenu;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <PdfHeader
          communeName={props.communeName}
          communeLogoUrl={props.communeLogoUrl}
          documentType="Fiche projet"
          editedOn={props.generatedAt}
        />
        <PdfFooter communeName={props.communeName} documentType="Fiche projet" />

        {/* 1. Identité */}
        <Text style={s.title}>{props.titre}</Text>
        <Text style={s.subtitle}>
          Étape : {PROJECT_PHASE_LABELS[props.phase]} · Compétence : {props.competence}
          {props.sans_subvention ? " · Autofinancement assumé" : ""}
        </Text>

        <View style={s.section}>
          <View style={s.kvRow}><Text style={s.kvLabel}>Pilote élu</Text><Text style={s.kvValue}>{props.pilote_elu ?? "—"}</Text></View>
          <View style={s.kvRow}><Text style={s.kvLabel}>Pilote agent</Text><Text style={s.kvValue}>{props.pilote_agent ?? "—"}</Text></View>
          {props.source_ticket_label && (
            <View style={s.kvRow}><Text style={s.kvLabel}>Issu du ticket</Text><Text style={s.kvValue}>{props.source_ticket_label}</Text></View>
          )}
        </View>

        {/* 2. Objectifs */}
        {(props.description || props.objectifs) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Objectifs</Text>
            {props.description && <Text style={s.para}>{props.description}</Text>}
            {props.objectifs && <Text style={s.para}>{props.objectifs}</Text>}
          </View>
        )}

        {/* 2.bis Avancement par phase (toujours inclus dans le document
            public — Faisabilité et phases en cours / franchies). */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Avancement par phase</Text>
          {props.phase_progress_summary
            .filter((p) => p.status !== "future" || p.deliverables.some((d) => d.done))
            .map((p, pi) => (
              <View key={pi} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: 700, color: "#111827", flex: 1 }}>
                    {pi + 1}. {p.label}
                    {p.status === "current" ? " (en cours)" : p.status === "done" ? " ✓" : ""}
                  </Text>
                  <Text style={{ fontSize: 9, color: "#6b7280", fontWeight: 700 }}>
                    {p.pctDone}%
                  </Text>
                </View>
                <Text style={{ fontSize: 8.5, color: "#6b7280", marginBottom: 4, lineHeight: 1.3 }}>
                  {p.objective}
                </Text>
                {p.deliverables.map((d, di) => (
                  <Text key={di} style={{ fontSize: 8.5, marginLeft: 8, marginBottom: 1, color: d.done ? "#111827" : "#9ca3af" }}>
                    {d.done ? "☑" : "☐"} {d.label}
                    {d.note ? ` — ${d.note}` : ""}
                  </Text>
                ))}
              </View>
            ))}
        </View>

        {/* 3. Coût d'investissement */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Coût prévisionnel</Text>
          <View style={s.kvRow}><Text style={s.kvLabel}>Investissement</Text><Text style={s.kvValue}>{fmtEur(props.budget_estime)}</Text></View>
        </View>

        {/* 4. Plan de financement */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Plan de financement</Text>
          <View style={s.trHead}>
            <Text style={[s.th, { flex: 3 }]}>Financeur</Text>
            <Text style={[s.th, { flex: 1, textAlign: "right" }]}>Demandé</Text>
            <Text style={[s.th, { flex: 1, textAlign: "right" }]}>Obtenu</Text>
            <Text style={[s.th, { flex: 2 }]}>Statut</Text>
          </View>
          {props.financings.length === 0 ? (
            <View style={s.tr}><Text style={[s.td, { flex: 1 }]}>Aucun financement renseigné.</Text></View>
          ) : (
            props.financings.map((f, i) => (
              <View key={i} style={s.tr}>
                <Text style={[s.td, { flex: 3 }]}>{f.financeur}</Text>
                <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{f.montant_demande ? fmtEur(f.montant_demande) : "—"}</Text>
                <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{f.montant_obtenu ? fmtEur(f.montant_obtenu) : "—"}</Text>
                <Text style={[s.td, { flex: 2 }]}>{FINANCING_STATUS_LABELS[f.statut]}</Text>
              </View>
            ))
          )}
          <View style={[s.tr, { borderBottom: 0, fontWeight: 700 }]}>
            <Text style={[s.td, { flex: 3, fontWeight: 700 }]}>Total</Text>
            <Text style={[s.td, { flex: 1, textAlign: "right", fontWeight: 700 }]}>{fmtEur(totalDemande)}</Text>
            <Text style={[s.td, { flex: 1, textAlign: "right", fontWeight: 700 }]}>{fmtEur(totalObtenu)}</Text>
            <Text style={[s.td, { flex: 2 }]}>Reste à charge : {fmtEur(restACharge)}</Text>
          </View>
        </View>

        {/* 5. Calendrier (jalons) */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Calendrier — jalons</Text>
          {props.milestones.length === 0 ? (
            <Text style={s.para}>Aucun jalon défini.</Text>
          ) : (
            <>
              <View style={s.trHead}>
                <Text style={[s.th, { flex: 3 }]}>Libellé</Text>
                <Text style={[s.th, { flex: 2 }]}>Étape</Text>
                <Text style={[s.th, { flex: 1 }]}>Échéance</Text>
                <Text style={[s.th, { flex: 1 }]}>Statut</Text>
              </View>
              {props.milestones.map((m, i) => (
                <View key={i} style={s.tr}>
                  <Text style={[s.td, { flex: 3 }]}>{m.libelle}</Text>
                  <Text style={[s.td, { flex: 2 }]}>{PROJECT_PHASE_LABELS[m.phase]}</Text>
                  <Text style={[s.td, { flex: 1 }]}>{m.echeance ?? "—"}</Text>
                  <Text style={[s.td, { flex: 1 }]}>{m.fait ? "Fait" : "À faire"}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </Page>

      {/* PAGE 2 : Coûts 10 ans (mise en avant) + parties prenantes + bilan */}
      <Page size="A4" style={s.page}>
        <PdfHeader
          communeName={props.communeName}
          communeLogoUrl={props.communeLogoUrl}
          documentType={`Fiche projet — ${props.titre}`}
          editedOn={props.generatedAt}
        />
        <PdfFooter communeName={props.communeName} documentType="Fiche projet" />

        {/* 6. Coûts 10 ans + synthèse */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, s.sectionTitleHighlight]}>
            Coûts d&apos;exploitation sur 10 ans — élément clé d&apos;arbitrage
          </Text>
          <View style={s.trHead}>
            <Text style={[s.th, { flex: 1 }]}>Année</Text>
            <Text style={[s.th, { flex: 2, textAlign: "right" }]}>Fonctionnement</Text>
            <Text style={[s.th, { flex: 2, textAlign: "right" }]}>Entretien</Text>
            <Text style={[s.th, { flex: 2, textAlign: "right" }]}>Total constant</Text>
          </View>
          {props.lifecycle.length === 0 ? (
            <Text style={s.para}>Aucun coût d&apos;exploitation renseigné.</Text>
          ) : (
            props.lifecycle.map((l, i) => (
              <View key={i} style={s.tr}>
                <Text style={[s.td, { flex: 1 }]}>{l.annee}</Text>
                <Text style={[s.td, { flex: 2, textAlign: "right" }]}>{fmtEur(l.cout_fonctionnement)}</Text>
                <Text style={[s.td, { flex: 2, textAlign: "right" }]}>{fmtEur(l.cout_entretien)}</Text>
                <Text style={[s.td, { flex: 2, textAlign: "right" }]}>{fmtEur(l.cout_fonctionnement + l.cout_entretien)}</Text>
              </View>
            ))
          )}

          <View style={s.costGrid}>
            <View style={s.costCell}>
              <Text style={s.costLabel}>Investissement</Text>
              <Text style={s.costValue}>{fmtEur(props.budget_estime)}</Text>
            </View>
            <View style={s.costCell}>
              <Text style={s.costLabel}>Coût global nominal</Text>
              <Text style={s.costValue}>{fmtEur(props.cost_total_nominal)}</Text>
            </View>
            <View style={[s.costCell, s.costCellHl]}>
              <Text style={s.costLabel}>Coût global actualisé</Text>
              <Text style={s.costValue}>{fmtEur(props.cost_total_actualise)}</Text>
              <Text style={s.costRates}>
                Inflation {props.taux_inflation.toFixed(1)} % · Actualisation {props.taux_actualisation.toFixed(1)} %
              </Text>
            </View>
          </View>
        </View>

        {/* 7. Parties prenantes */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Parties prenantes</Text>
          {props.stakeholders.length === 0 ? (
            <Text style={s.para}>Aucune partie prenante associée.</Text>
          ) : (
            <>
              <View style={s.trHead}>
                <Text style={[s.th, { flex: 3 }]}>Nom</Text>
                <Text style={[s.th, { flex: 2 }]}>Type</Text>
                <Text style={[s.th, { flex: 2 }]}>Rôle</Text>
                <Text style={[s.th, { flex: 2 }]}>Étape</Text>
              </View>
              {props.stakeholders.map((ps, i) => (
                <View key={i} style={s.tr}>
                  <Text style={[s.td, { flex: 3 }]}>{ps.nom}</Text>
                  <Text style={[s.td, { flex: 2 }]}>{STAKEHOLDER_TYPE_LABELS[ps.type]}</Text>
                  <Text style={[s.td, { flex: 2 }]}>{STAKEHOLDER_ROLE_LABELS[ps.role]}</Text>
                  <Text style={[s.td, { flex: 2 }]}>{ps.phase ? PROJECT_PHASE_LABELS[ps.phase] : "Tout"}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* 8. Bilan (si applicable) */}
        {props.show_bilan && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Bilan après réalisation</Text>
            <View style={s.kvRow}>
              <Text style={s.kvLabel}>Coût réel</Text>
              <Text style={s.kvValue}>{props.cout_reel !== null ? fmtEur(props.cout_reel) : "À renseigner"}</Text>
            </View>
            {props.ecart_value !== null && props.ecart_pct !== null && (
              <View style={s.kvRow}>
                <Text style={s.kvLabel}>Écart</Text>
                <Text style={s.kvValue}>
                  {props.ecart_value > 0 ? "+" : ""}{fmtEur(props.ecart_value)} ({fmtPct(props.ecart_pct)})
                </Text>
              </View>
            )}
            {props.explication_ecart && (
              <View style={{ marginTop: 4 }}>
                <Text style={s.kvLabel}>Explication</Text>
                <Text style={s.para}>{props.explication_ecart}</Text>
              </View>
            )}
          </View>
        )}
      </Page>
    </Document>
  );
}
