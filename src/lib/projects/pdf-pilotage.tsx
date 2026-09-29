/* eslint-disable jsx-a11y/alt-text */
import path from "node:path";
import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { PdfHeader, PdfFooter, pdfSafeImageUrl } from "./pdf-header";
import { eur, pct, VARIANTE_LABEL, type FicheData } from "./fiche";
import type { ReportingProjet } from "./pilotage";

// ═══════════════════════════════════════════════════════════════
// PDF du lot F : fiche projet A4 (§2.13) et reporting (§2.12).
// Flat design, palette du design system (marine, azur, prune).
// Logo de la commune en tête, petit logo GoCiviq en pied (pdf-header).
// ═══════════════════════════════════════════════════════════════

if (typeof window === "undefined") {
  const fontsDir = path.join(process.cwd(), "public", "fonts");
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(fontsDir, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(fontsDir, "Inter-Bold.ttf"), fontWeight: 700 },
      // Italique : Inter (OFL, @fontsource/inter, sous-ensemble latin — voir public/fonts/OFL-Inter.txt).
      { src: path.join(fontsDir, "Inter-Italic.woff"), fontWeight: 400, fontStyle: "italic" },
      { src: path.join(fontsDir, "Inter-BoldItalic.woff"), fontWeight: 700, fontStyle: "italic" },
    ],
  });
}
Font.registerHyphenationCallback((word) => [word]);

const MARINE = "#042F64";
const AZUR = "#2F6FDB";
const TYPE_COLOR = { investissement: MARINE, evenementiel: "#B0306A", suivi_simple: "#4a5068" } as const;
const MUTED = "#6b7080";
const BORDER = "#e5e7eb";
const DANGER = "#E00114";

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 9, padding: 32, paddingBottom: 70, color: "#1f2937" },
  bandeau: { fontSize: 8, fontWeight: 700, color: DANGER, borderWidth: 1, borderColor: DANGER, padding: 4, marginBottom: 8, textAlign: "center" },
  head: { flexDirection: "row", gap: 12, marginBottom: 10 },
  photo: { width: 120, height: 80, objectFit: "cover", borderRadius: 4 },
  headMain: { flex: 1 },
  typeTag: { alignSelf: "flex-start", fontSize: 7.5, fontWeight: 700, color: "#fff", paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, marginBottom: 4 },
  title: { fontSize: 16, fontWeight: 700, color: MARINE, marginBottom: 4 },
  facts: { fontSize: 8.5, color: MUTED },
  desc: { fontSize: 9, marginBottom: 8 },
  gaugeWrap: { marginBottom: 10 },
  gaugeLabel: { fontSize: 8, fontWeight: 700, marginBottom: 3 },
  gaugeTrack: { height: 6, backgroundColor: "#eef1f6", borderRadius: 3 },
  gaugeFill: { height: 6, backgroundColor: AZUR, borderRadius: 3 },
  section: { fontSize: 10.5, fontWeight: 700, color: MARINE, marginTop: 8, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingVertical: 3 },
  th: { fontSize: 7.5, fontWeight: 700, color: MUTED },
  cell: { fontSize: 8.5 },
  late: { color: DANGER, fontWeight: 700 },
  comment: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  kpis: { flexDirection: "row", gap: 6, marginBottom: 4 },
  kpi: { flex: 1, borderWidth: 0.5, borderColor: BORDER, borderRadius: 4, padding: 5 },
  kpiLabel: { fontSize: 7, color: MUTED },
  kpiValue: { fontSize: 10, fontWeight: 700 },
  ok: { color: "#1f7a4a" },
  ko: { color: DANGER },
  note: { fontSize: 7.5, color: MUTED, marginTop: 6 },
  // Reporting
  rTitle: { fontSize: 15, fontWeight: 700, color: MARINE, marginBottom: 2 },
  rSub: { fontSize: 8.5, color: MUTED, marginBottom: 10 },
  l1: { flexDirection: "row", marginTop: 8 },
  l2: { flexDirection: "row", marginLeft: 16, marginTop: 3 },
  l3: { flexDirection: "row", marginLeft: 32, marginTop: 2 },
  bulletBox: { width: 12, paddingTop: 4 },
  b1: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: MARINE },
  b2: { width: 5, height: 5, borderRadius: 2.5, borderWidth: 1, borderColor: "#374151" },
  b3: { width: 4, height: 4, backgroundColor: "#374151" },
  jalon: { width: 5, height: 5, backgroundColor: MARINE, transform: "rotate(45deg)", marginRight: 4, marginTop: 3 },
  l1Text: { flex: 1, fontSize: 10, fontWeight: 700 },
  l2Text: { flex: 1, fontSize: 9 },
  l3Text: { flex: 1, fontSize: 8.5, color: "#374151" },
});

interface Enveloppe {
  communeName: string;
  communeLogoUrl: string | null;
  editedOn: string;
}

function Col({ w, children, style }: { w: number | string; children: React.ReactNode; style?: object }) {
  return <View style={{ width: w as number, paddingRight: 4, ...(style ?? {}) }}>{children}</View>;
}

export function FichePDF({ fiche, ...env }: Enveloppe & { fiche: FicheData }) {
  const docType = `Fiche projet — ${VARIANTE_LABEL[fiche.variante]}`;
  const b = fiche.budget;
  const photo = pdfSafeImageUrl(fiche.photoUrl);
  return (
    <Document title={`${fiche.titre} — fiche projet`} author={env.communeName} language="fr">
      <Page size="A4" style={s.page}>
        <PdfHeader communeName={env.communeName} communeLogoUrl={env.communeLogoUrl} documentType={docType} editedOn={env.editedOn} />
        {fiche.confidentiel && <Text style={s.bandeau}>PROJET CONFIDENTIEL — diffusion réservée au bureau municipal</Text>}

        <View style={s.head}>
          {photo && <Image src={photo} style={s.photo} />}
          <View style={s.headMain}>
            <Text style={{ ...s.typeTag, backgroundColor: TYPE_COLOR[fiche.type] }}>{fiche.typeLabel.toUpperCase()}</Text>
            <Text style={s.title}>{fiche.titre}</Text>
            <Text style={s.facts}>
              Commission : {fiche.commission ?? "—"}   ·   Élu référent : {fiche.referent ?? "à désigner"}
            </Text>
            {fiche.evenement?.date && (
              <Text style={s.facts}>Date : {fiche.evenement.date}{fiche.evenement.lieu ? `   ·   Lieu : ${fiche.evenement.lieu}` : ""}</Text>
            )}
          </View>
        </View>

        {fiche.description && <Text style={s.desc}>{fiche.description}</Text>}

        <View style={s.gaugeWrap}>
          <Text style={s.gaugeLabel}>Avancement : {fiche.avancement === null ? "non renseigné" : pct(Math.round(fiche.avancement))}</Text>
          <View style={s.gaugeTrack}>
            <View style={{ ...s.gaugeFill, width: `${Math.max(0, Math.min(100, fiche.avancement ?? 0))}%` }} />
          </View>
        </View>

        <Text style={s.section}>{fiche.etapesTitre}</Text>
        {fiche.etapes.length === 0 ? (
          <Text style={s.cell}>Aucune étape saisie.</Text>
        ) : (
          <>
            <View style={s.row}>
              <Col w="46%"><Text style={s.th}>Étape</Text></Col>
              <Col w="30%"><Text style={s.th}>Date</Text></Col>
              <Col w="24%"><Text style={s.th}>Statut</Text></Col>
            </View>
            {fiche.etapes.map((e, i) => (
              <View key={i} style={s.row} wrap={false}>
                <Col w="46%">
                  <View style={{ flexDirection: "row" }}>
                    {e.jalon && <View style={s.jalon} />}
                    <Text style={{ ...s.cell, flex: 1 }}>{e.libelle}</Text>
                  </View>
                  {e.commentaire && <Text style={s.comment}>{e.noteInterne ? "Note interne : " : ""}{e.commentaire}</Text>}
                </Col>
                <Col w="30%"><Text style={s.cell}>{e.date ?? "—"}</Text></Col>
                <Col w="24%"><Text style={e.enRetard ? { ...s.cell, ...s.late } : s.cell}>{e.enRetard ? "En retard" : e.statut}</Text></Col>
              </View>
            ))}
          </>
        )}

        {b?.kind === "investissement" && (
          <>
            <Text style={s.section}>Budget et plan de financement (hors taxes)</Text>
            <View style={s.kpis}>
              <View style={s.kpi}><Text style={s.kpiLabel}>Prévu</Text><Text style={s.kpiValue}>{eur(b.prevuHt)}</Text></View>
              <View style={s.kpi}><Text style={s.kpiLabel}>Engagé</Text><Text style={s.kpiValue}>{eur(b.engageHt)}</Text></View>
              <View style={s.kpi}><Text style={s.kpiLabel}>Payé</Text><Text style={s.kpiValue}>{eur(b.mandateHt)}</Text></View>
            </View>
            <View style={s.kpis}>
              <View style={s.kpi}><Text style={s.kpiLabel}>Aides publiques retenues</Text><Text style={s.kpiValue}>{eur(b.plan.aides_retenues)}</Text></View>
              <View style={s.kpi}><Text style={s.kpiLabel}>FCTVA estimé</Text><Text style={s.kpiValue}>{eur(b.plan.fctva)}</Text></View>
              <View style={s.kpi}><Text style={s.kpiLabel}>Emprunt</Text><Text style={s.kpiValue}>{eur(b.plan.emprunt)}</Text></View>
            </View>
            <View style={s.kpis}>
              <View style={s.kpi}>
                <Text style={s.kpiLabel}>Part communale (20 % minimum)</Text>
                <Text style={{ ...s.kpiValue, ...(b.plan.controle_part_commune_ok === false ? s.ko : s.ok) }}>
                  {pct(b.plan.part_commune_pct)}{b.plan.controle_part_commune_ok === false ? " — insuffisante" : ""}
                </Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiLabel}>Aides publiques (80 % maximum)</Text>
                <Text style={{ ...s.kpiValue, ...(b.plan.controle_aides_ok === false ? s.ko : s.ok) }}>
                  {pct(b.plan.aides_pct)}{b.plan.controle_aides_ok === false ? " — plafond dépassé" : ""}
                </Text>
              </View>
            </View>
          </>
        )}

        {b?.kind === "fonctionnement" && (
          <>
            <Text style={s.section}>Budget de fonctionnement (TTC)</Text>
            <View style={s.kpis}>
              <View style={s.kpi}><Text style={s.kpiLabel}>Dépenses</Text><Text style={s.kpiValue}>{eur(b.depensesTtc)}</Text></View>
              <View style={s.kpi}><Text style={s.kpiLabel}>Recettes</Text><Text style={s.kpiValue}>{eur(b.recettesTtc)}</Text></View>
              <View style={s.kpi}><Text style={s.kpiLabel}>Solde</Text><Text style={{ ...s.kpiValue, ...(b.soldeTtc < 0 ? s.ko : s.ok) }}>{eur(b.soldeTtc)}</Text></View>
            </View>
          </>
        )}

        {fiche.subventions.length > 0 && (
          <>
            <Text style={s.section}>Subventions</Text>
            <View style={s.row}>
              <Col w="46%"><Text style={s.th}>Financeur</Text></Col>
              <Col w="22%"><Text style={s.th}>Statut</Text></Col>
              <Col w="16%"><Text style={s.th}>Demandé</Text></Col>
              <Col w="16%"><Text style={s.th}>Obtenu</Text></Col>
            </View>
            {fiche.subventions.map((x, i) => (
              <View key={i} style={s.row} wrap={false}>
                <Col w="46%"><Text style={s.cell}>{x.financeur}</Text></Col>
                <Col w="22%"><Text style={s.cell}>{x.statut}</Text></Col>
                <Col w="16%"><Text style={s.cell}>{eur(x.demande)}</Text></Col>
                <Col w="16%"><Text style={s.cell}>{eur(x.obtenu)}</Text></Col>
              </View>
            ))}
          </>
        )}

        {fiche.deliberations.length > 0 && (
          <>
            <Text style={s.section}>Délibérations</Text>
            {fiche.deliberations.map((d, i) => (
              <Text key={i} style={s.cell}>
                N° {d.numero ?? "—"}{d.date ? ` du ${d.date}` : ""}{d.objet ? ` — ${d.objet}` : ""}
              </Text>
            ))}
          </>
        )}

        {fiche.documents.length > 0 && (
          <>
            <Text style={s.section}>Pièces du dossier</Text>
            <Text style={s.cell}>
              {fiche.documents.map((d) => `${d.nom}${d.noteInterne ? " (interne)" : ""}`).join("  ·  ")}
            </Text>
          </>
        )}

        <Text style={s.note}>
          {fiche.variante === "communicable"
            ? "Version communicable : les notes et pièces internes sont exclues."
            : "Version complète à usage interne : contient des notes internes, ne pas diffuser en l'état."}
        </Text>
        <PdfFooter communeName={env.communeName} documentType={docType} />
      </Page>
    </Document>
  );
}

export function ReportingPDF({ items, filtres, ...env }: Enveloppe & { items: ReportingProjet[]; filtres: string }) {
  return (
    <Document title="Reporting des projets" author={env.communeName} language="fr">
      <Page size="A4" style={s.page}>
        <PdfHeader communeName={env.communeName} communeLogoUrl={env.communeLogoUrl} documentType="Reporting des projets" editedOn={env.editedOn} />
        <Text style={s.rTitle}>Reporting des projets</Text>
        <Text style={s.rSub}>{filtres}</Text>
        {items.length === 0 && <Text style={s.cell}>Aucune étape n&apos;est marquée « remonter au reporting » pour ces filtres.</Text>}
        {items.map((p) => (
          <View key={p.id} wrap={p.lignes.length > 6}>
            <View style={s.l1}><View style={s.bulletBox}><View style={s.b1} /></View><Text style={s.l1Text}>{p.titre}</Text></View>
            {p.lignes.map((l, i) => (
              <View key={i}>
                <View style={s.l2}><View style={s.bulletBox}><View style={s.b2} /></View><Text style={s.l2Text}>{l.texte}</Text></View>
                {l.sous.map((x, j) => (
                  <View key={j} style={s.l3}><View style={s.bulletBox}><View style={s.b3} /></View><Text style={s.l3Text}>{x}</Text></View>
                ))}
              </View>
            ))}
          </View>
        ))}
        <PdfFooter communeName={env.communeName} documentType="Reporting des projets" />
      </Page>
    </Document>
  );
}
