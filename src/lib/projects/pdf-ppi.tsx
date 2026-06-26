/* eslint-disable jsx-a11y/alt-text */
import path from "node:path";
import {
  Document, Page, View, Text, StyleSheet, Font,
} from "@react-pdf/renderer";
import { PdfHeader, PdfFooter } from "./pdf-header";
import {
  PROJECT_PHASE_LABELS,
  type ProjectPhase,
} from "./types";

// ═══════════════════════════════════════════════════════════════
// PDF Plan Pluriannuel d'Investissement (PPI)
//
// Synthèse multi-année des opérations communales : montant HT,
// subventions sollicitées/obtenues, reste à charge.
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

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
function fmtEur(n: number): string {
  return EUR.format(n);
}

const s = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 9.5,
    padding: 32,
    paddingBottom: 72,
    color: "#1f2937",
  },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 14 },
  // Bandeau de totaux en haut
  summary: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 10,
  },
  summaryCell: {
    flex: 1,
    padding: 8,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  summaryCellHl: { backgroundColor: "#fef3c7" },
  summaryLabel: {
    fontSize: 7,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: { fontSize: 12, fontWeight: 700, marginTop: 2 },
  // Sections par année
  yearSection: { marginTop: 14, marginBottom: 4 },
  yearHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: 1,
    borderColor: "#1f2937",
    paddingBottom: 4,
    marginBottom: 6,
  },
  yearTitle: { fontSize: 13, fontWeight: 700, color: "#111827" },
  yearTotals: { flexDirection: "row", gap: 14, fontSize: 9 },
  yearTotalLabel: { color: "#6b7280" },
  yearTotalValue: { fontWeight: 700, marginLeft: 4 },
  // Tableau
  table: { marginTop: 2 },
  trHead: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tr: {
    flexDirection: "row",
    borderBottom: 0.5,
    borderColor: "#e5e7eb",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  th: { fontSize: 8.5, fontWeight: 700, color: "#374151" },
  td: { fontSize: 9, color: "#111827" },
  tdMuted: { fontSize: 9, color: "#6b7280" },
  num: { textAlign: "right" },
  // Largeurs colonnes (tableau année)
  colOperation: { flex: 2.6 },
  colPhase: { flex: 1.3 },
  colTiers: { flex: 1 },
  colMontant: { flex: 1, textAlign: "right" },
  colSubvSoll: { flex: 1.1, textAlign: "right" },
  colSubvOb: { flex: 1.1, textAlign: "right" },
  colReste: { flex: 1.1, textAlign: "right" },

  notice: {
    marginTop: 8,
    padding: 6,
    backgroundColor: "#f3f4f6",
    fontSize: 8,
    color: "#6b7280",
    borderRadius: 3,
  },
});

export interface PpiPdfProject {
  id: string;
  titre: string;
  phase: ProjectPhase;
  concerne_tiers: boolean;
  tiers_nom: string | null;
  budget_estime: number;
  financing_total_demande: number;
  financing_total_obtenu: number;
}

export interface PpiPdfData {
  communeName: string;
  communeLogoUrl: string | null;
  generatedAt: string;
  byYear: { year: number; projects: PpiPdfProject[] }[];
  totals: {
    count: number;
    budget: number;
    demande: number;
    obtenu: number;
    reste: number;
  };
}

export function PpiPDF({ data }: { data: PpiPdfData }) {
  return (
    <Document
      title={`PPI — ${data.communeName}`}
      author={data.communeName}
      creator="GoCiviq"
    >
      <Page size="A4" style={s.page} wrap>
        <PdfHeader
          communeName={data.communeName}
          communeLogoUrl={data.communeLogoUrl}
          documentType="Plan Pluriannuel d'Investissement"
          editedOn={data.generatedAt}
        />

        <Text style={s.title}>Plan Pluriannuel d&apos;Investissement</Text>
        <Text style={s.subtitle}>
          Vision consolidée des investissements communaux par année de
          programmation. Document à usage interne pour les comités, les
          délibérations budgétaires et l&apos;information des financeurs.
        </Text>

        {/* Totaux globaux */}
        <View style={s.summary}>
          <View style={s.summaryCell}>
            <Text style={s.summaryLabel}>Opérations</Text>
            <Text style={s.summaryValue}>{data.totals.count}</Text>
          </View>
          <View style={s.summaryCell}>
            <Text style={s.summaryLabel}>Investissement HT</Text>
            <Text style={s.summaryValue}>{fmtEur(data.totals.budget)}</Text>
          </View>
          <View style={s.summaryCell}>
            <Text style={s.summaryLabel}>Subv. sollicitées</Text>
            <Text style={s.summaryValue}>{fmtEur(data.totals.demande)}</Text>
          </View>
          <View style={s.summaryCell}>
            <Text style={s.summaryLabel}>Subv. obtenues</Text>
            <Text style={s.summaryValue}>{fmtEur(data.totals.obtenu)}</Text>
          </View>
          <View style={[s.summaryCell, s.summaryCellHl]}>
            <Text style={s.summaryLabel}>Reste à charge</Text>
            <Text style={s.summaryValue}>{fmtEur(data.totals.reste)}</Text>
          </View>
        </View>

        {/* Une section par année */}
        {data.byYear.map(({ year, projects }) => {
          const yearTotals = projects.reduce(
            (acc, p) => ({
              budget: acc.budget + Number(p.budget_estime ?? 0),
              demande: acc.demande + Number(p.financing_total_demande ?? 0),
              obtenu: acc.obtenu + Number(p.financing_total_obtenu ?? 0),
            }),
            { budget: 0, demande: 0, obtenu: 0 },
          );
          const reste = yearTotals.budget - yearTotals.obtenu;
          return (
            <View key={year} style={s.yearSection} wrap={false}>
              <View style={s.yearHeader}>
                <Text style={s.yearTitle}>Programmation {year}</Text>
                <View style={s.yearTotals}>
                  <Text>
                    <Text style={s.yearTotalLabel}>Total HT</Text>
                    <Text style={s.yearTotalValue}> {fmtEur(yearTotals.budget)}</Text>
                  </Text>
                  <Text>
                    <Text style={s.yearTotalLabel}>Obtenu</Text>
                    <Text style={s.yearTotalValue}> {fmtEur(yearTotals.obtenu)}</Text>
                  </Text>
                  <Text>
                    <Text style={s.yearTotalLabel}>Reste</Text>
                    <Text style={s.yearTotalValue}> {fmtEur(reste)}</Text>
                  </Text>
                </View>
              </View>

              <View style={s.table}>
                <View style={s.trHead} fixed>
                  <Text style={[s.th, s.colOperation]}>Opération</Text>
                  <Text style={[s.th, s.colPhase]}>Étape</Text>
                  <Text style={[s.th, s.colTiers]}>Tiers</Text>
                  <Text style={[s.th, s.colMontant]}>Montant HT</Text>
                  <Text style={[s.th, s.colSubvSoll]}>Subv. sollicitées</Text>
                  <Text style={[s.th, s.colSubvOb]}>Subv. obtenues</Text>
                  <Text style={[s.th, s.colReste]}>Reste à charge</Text>
                </View>

                {projects.map((p) => {
                  const budget = Number(p.budget_estime ?? 0);
                  const demande = Number(p.financing_total_demande ?? 0);
                  const obtenu = Number(p.financing_total_obtenu ?? 0);
                  const r = budget - obtenu;
                  return (
                    <View key={p.id} style={s.tr}>
                      <Text style={[s.td, s.colOperation]}>{p.titre}</Text>
                      <Text style={[s.td, s.colPhase]}>
                        {PROJECT_PHASE_LABELS[p.phase]}
                      </Text>
                      <Text style={[p.concerne_tiers ? s.td : s.tdMuted, s.colTiers]}>
                        {p.concerne_tiers ? p.tiers_nom ?? "Tiers" : "—"}
                      </Text>
                      <Text style={[s.td, s.colMontant]}>{fmtEur(budget)}</Text>
                      <Text style={[s.td, s.colSubvSoll]}>{fmtEur(demande)}</Text>
                      <Text style={[s.td, s.colSubvOb]}>{fmtEur(obtenu)}</Text>
                      <Text style={[s.td, s.colReste]}>{fmtEur(r)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={s.notice}>
          <Text>
            Note méthodologique : la programmation par année se base sur la
            date de création de chaque opération. Les projets « accompagnement
            sans financement » sont exclus du PPI. Les montants sont
            exprimés en euros HT.
          </Text>
        </View>

        <PdfFooter
          communeName={data.communeName}
          documentType="Plan Pluriannuel d'Investissement"
        />
      </Page>
    </Document>
  );
}
