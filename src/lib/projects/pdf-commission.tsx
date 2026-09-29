/* eslint-disable jsx-a11y/alt-text */
import path from "node:path";
import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { PdfHeader, PdfFooter } from "./pdf-header";
import { parseRichText, type RichRun } from "./rich-text";

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

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 10, padding: 32, paddingBottom: 72, color: "#1f2937" },
  title: { fontSize: 16, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  // Pas de lineHeight : dans react-pdf (police Inter), toute valeur double
  // l'interligne dès que le texte passe à la ligne.
  para: { marginBottom: 4 },
  richH2: { fontSize: 12, fontWeight: 700, marginTop: 8, marginBottom: 4, color: "#042f64" },
  richH3: { fontSize: 11, fontWeight: 700, marginTop: 6, marginBottom: 3 },
  richLi: { flexDirection: "row", marginBottom: 1, paddingLeft: 12 },
  richBullet: { width: 14 },
  richLiText: { flex: 1 },
  trHead: { flexDirection: "row", backgroundColor: "#f3f4f6", padding: 4 },
  tr: { flexDirection: "row", borderBottom: 0.5, borderColor: "#e5e7eb", padding: 4, minHeight: 28, alignItems: "center" },
  th: { fontSize: 9, fontWeight: 700 },
  td: { fontSize: 9 },
  sigBox: { borderWidth: 0.5, borderColor: "#d1d5db", height: 28, marginTop: 2 },
  footer: { position: "absolute", bottom: 32, left: 32, right: 32, fontSize: 8, color: "#6b7280", borderTop: 0.5, borderColor: "#e5e7eb", paddingTop: 6, textAlign: "right" },
});

// ─── Texte riche (HTML assaini → blocs react-pdf) ───
// Italique : vraie police Inter italique embarquée (la police standard
// Helvetica-Oblique disparaissait à l'affichage de certains PDF).
function runStyle(r: RichRun) {
  return {
    ...(r.italic ? { fontStyle: "italic" as const } : {}),
    ...(r.bold ? { fontWeight: 700 } : {}),
    ...(r.underline ? { textDecoration: "underline" as const } : {}),
  };
}

function Runs({ runs }: { runs: RichRun[] }) {
  return (
    <>
      {runs.map((r, i) => (
        <Text key={i} style={runStyle(r)}>{r.text}</Text>
      ))}
    </>
  );
}

export function RichTextPdf({ value }: { value: string | null | undefined }) {
  const blocks = parseRichText(value);
  if (blocks.length === 0) return <Text style={s.para}>—</Text>;
  return (
    <View>
      {blocks.map((b, i) => {
        if (b.type === "h2") {
          return <Text key={i} style={s.richH2}><Runs runs={b.runs} /></Text>;
        }
        if (b.type === "h3") {
          return <Text key={i} style={s.richH3}><Runs runs={b.runs} /></Text>;
        }
        if (b.type === "li") {
          return (
            <View key={i} style={s.richLi} wrap={false}>
              {b.marker && <Text style={s.richBullet}>{b.marker}</Text>}
              <Text style={s.richLiText}><Runs runs={b.runs} /></Text>
            </View>
          );
        }
        return <Text key={i} style={s.para}><Runs runs={b.runs} /></Text>;
      })}
    </View>
  );
}

export interface MinutesPdfData {
  communeName: string;
  communeLogoUrl: string | null;
  commissionName: string;
  dateSeance: string;
  lieu: string | null;
  ordreDuJour: string | null;
  secretaireNom: string | null;
  presents: string[];
  /** Excusés (ont prévenu de leur absence) — migration 046. */
  excuses?: string[];
  absents: string[];
  /** Membres sans présence saisie : ils figurent quand même. */
  nonRenseignes?: string[];
  compteRendu: string;
  decisions: Array<{ libelle: string; type: string; responsable: string | null; echeance: string | null }>;
  generatedAt: string;
  validatedAt: string | null;
}

export function MinutesPDF(props: MinutesPdfData) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <PdfHeader
          communeName={props.communeName}
          communeLogoUrl={props.communeLogoUrl}
          documentType="Compte rendu de séance"
          editedOn={props.generatedAt}
        />
        <PdfFooter
          communeName={props.communeName}
          documentType={`Compte rendu — ${props.commissionName}`}
        />

        <Text style={s.title}>Compte rendu de séance</Text>
        <Text style={s.subtitle}>
          Commission : <Text style={{ fontWeight: 700 }}>{props.commissionName}</Text>{"\n"}
          Date : {props.dateSeance}{props.lieu ? `   ·   Lieu : ${props.lieu}` : ""}{"\n"}
          {props.secretaireNom && `Secrétaire de séance : ${props.secretaireNom}`}
        </Text>

        <Text style={s.sectionTitle}>Présents ({props.presents.length})</Text>
        <Text style={s.para}>{props.presents.length > 0 ? props.presents.join(", ") : "—"}</Text>

        {(props.excuses ?? []).length > 0 && (
          <>
            <Text style={s.sectionTitle}>Excusés ({props.excuses!.length})</Text>
            <Text style={s.para}>{props.excuses!.join(", ")}</Text>
          </>
        )}

        {props.absents.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Absents ({props.absents.length})</Text>
            <Text style={s.para}>{props.absents.join(", ")}</Text>
          </>
        )}

        {(props.nonRenseignes ?? []).length > 0 && (
          <>
            <Text style={s.sectionTitle}>Présence non renseignée ({props.nonRenseignes!.length})</Text>
            <Text style={s.para}>{props.nonRenseignes!.join(", ")}</Text>
          </>
        )}

        {props.ordreDuJour && (
          <>
            <Text style={s.sectionTitle}>Ordre du jour</Text>
            <RichTextPdf value={props.ordreDuJour} />
          </>
        )}

        <Text style={s.sectionTitle}>Compte rendu</Text>
        <RichTextPdf value={props.compteRendu} />

        {props.decisions.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Relevé de décisions / avis</Text>
            <View style={s.trHead}>
              <Text style={[s.th, { flex: 4 }]}>Libellé</Text>
              <Text style={[s.th, { flex: 2 }]}>Type</Text>
              <Text style={[s.th, { flex: 2 }]}>Responsable</Text>
              <Text style={[s.th, { flex: 2 }]}>Échéance</Text>
            </View>
            {props.decisions.map((d, i) => (
              <View key={i} style={s.tr}>
                <Text style={[s.td, { flex: 4 }]}>{d.libelle}</Text>
                <Text style={[s.td, { flex: 2 }]}>{d.type}</Text>
                <Text style={[s.td, { flex: 2 }]}>{d.responsable ?? "—"}</Text>
                <Text style={[s.td, { flex: 2 }]}>{d.echeance ?? "—"}</Text>
              </View>
            ))}
          </>
        )}

        {props.validatedAt && (
          <Text style={{ fontSize: 8, color: "#6b7280", marginTop: 16 }}>
            Compte rendu validé le {props.validatedAt}
          </Text>
        )}
      </Page>
    </Document>
  );
}

export interface AttendancePdfData {
  communeName: string;
  communeLogoUrl: string | null;
  commissionName: string;
  dateSeance: string;
  lieu: string | null;
  ordreDuJour: string | null;
  secretaireNom: string | null;
  members: Array<{
    full_name: string;
    role: string;
    present: boolean | null;
    /** « Présent », « Excusé », « Absent » ; prioritaire sur `present`. */
    statutLabel?: string | null;
    signature_data: string | null;
    signe_le: string | null;
  }>;
  generatedAt: string;
}

export function AttendancePDF(props: AttendancePdfData) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <PdfHeader
          communeName={props.communeName}
          communeLogoUrl={props.communeLogoUrl}
          documentType="Feuille d'émargement"
          editedOn={props.generatedAt}
        />
        <PdfFooter
          communeName={props.communeName}
          documentType={`Émargement — ${props.commissionName}`}
        />

        <Text style={s.title}>Feuille d&apos;émargement</Text>
        <Text style={s.subtitle}>
          Commission : <Text style={{ fontWeight: 700 }}>{props.commissionName}</Text>{"\n"}
          Date : {props.dateSeance}{props.lieu ? `   ·   Lieu : ${props.lieu}` : ""}{"\n"}
          {props.secretaireNom && `Secrétaire de séance : ${props.secretaireNom}`}
        </Text>

        {/* L'ordre du jour n'est pas repris : la feuille sert à faire signer
            les membres présents (il figure dans la convocation et au compte rendu). */}
        <Text style={s.sectionTitle}>Émargement</Text>
        <View style={s.trHead}>
          <Text style={[s.th, { flex: 3 }]}>Conseiller</Text>
          <Text style={[s.th, { flex: 1 }]}>Rôle</Text>
          <Text style={[s.th, { flex: 1 }]}>Présence</Text>
          <Text style={[s.th, { flex: 3 }]}>Signature</Text>
        </View>
        {props.members.map((m, i) => (
          <View key={i} style={s.tr}>
            <Text style={[s.td, { flex: 3 }]}>{m.full_name}</Text>
            <Text style={[s.td, { flex: 1 }]}>
              {m.role === "president" ? "Président·e"
                : m.role === "vice_president" ? "Vice-président·e"
                : "Membre"}
            </Text>
            <Text style={[s.td, { flex: 1 }]}>
              {m.statutLabel ?? (m.present === true ? "Présent" : m.present === false ? "Absent" : "Non renseigné")}
            </Text>
            <View style={[{ flex: 3 }, s.sigBox]}>
              {m.signature_data && (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={m.signature_data} style={{ width: "100%", height: "100%" }} />
              )}
              {m.signature_data && m.signe_le && (
                <Text style={{ fontSize: 6, color: "#6b7280", marginTop: 1 }}>
                  Signé le {new Date(m.signe_le).toLocaleString("fr-FR")}
                </Text>
              )}
            </View>
          </View>
        ))}

        <Text style={{ fontSize: 8, color: "#6b7280", marginTop: 16 }}>
          Feuille d&apos;émargement valant pour preuve de présence.
        </Text>
      </Page>
    </Document>
  );
}
