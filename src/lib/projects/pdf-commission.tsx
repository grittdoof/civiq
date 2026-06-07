/* eslint-disable jsx-a11y/alt-text */
import path from "node:path";
import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";

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

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 10, padding: 32, color: "#1f2937" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, borderBottom: 1, borderColor: "#e5e7eb", paddingBottom: 8 },
  communeName: { fontSize: 12, fontWeight: 700 },
  title: { fontSize: 16, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  para: { lineHeight: 1.4, marginBottom: 4 },
  trHead: { flexDirection: "row", backgroundColor: "#f3f4f6", padding: 4 },
  tr: { flexDirection: "row", borderBottom: 0.5, borderColor: "#e5e7eb", padding: 4, minHeight: 28, alignItems: "center" },
  th: { fontSize: 9, fontWeight: 700 },
  td: { fontSize: 9 },
  sigBox: { borderWidth: 0.5, borderColor: "#d1d5db", height: 28, marginTop: 2 },
  footer: { position: "absolute", bottom: 32, left: 32, right: 32, fontSize: 8, color: "#6b7280", borderTop: 0.5, borderColor: "#e5e7eb", paddingTop: 6, textAlign: "right" },
});

export interface AttendancePdfData {
  communeName: string;
  commissionName: string;
  dateSeance: string;
  lieu: string | null;
  ordreDuJour: string | null;
  secretaireNom: string | null;
  members: Array<{
    full_name: string;
    role: string;
    present: boolean | null;
    signature_data: string | null;
    signe_le: string | null;
  }>;
  generatedAt: string;
}

export function AttendancePDF(props: AttendancePdfData) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.communeName}>{props.communeName}</Text>
          <Text style={{ fontSize: 9, color: "#6b7280" }}>Édité le {props.generatedAt}</Text>
        </View>

        <Text style={s.title}>Feuille d&apos;émargement</Text>
        <Text style={s.subtitle}>
          Commission : <Text style={{ fontWeight: 700 }}>{props.commissionName}</Text>{"\n"}
          Date : {props.dateSeance}{props.lieu ? `   ·   Lieu : ${props.lieu}` : ""}{"\n"}
          {props.secretaireNom && `Secrétaire de séance : ${props.secretaireNom}`}
        </Text>

        {props.ordreDuJour && (
          <>
            <Text style={s.sectionTitle}>Ordre du jour</Text>
            <Text style={s.para}>{props.ordreDuJour}</Text>
          </>
        )}

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
            <Text style={[s.td, { flex: 1 }]}>{m.role === "president" ? "Président" : "Membre"}</Text>
            <Text style={[s.td, { flex: 1 }]}>
              {m.present === true ? "Présent" : m.present === false ? "Absent" : "—"}
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

        <Text style={s.footer}>
          {props.communeName} — Feuille d&apos;émargement valant pour preuve de présence
        </Text>
      </Page>
    </Document>
  );
}
