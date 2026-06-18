/* eslint-disable jsx-a11y/alt-text */
import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";

// ═══════════════════════════════════════════════════════════════
// En-tête et pied de page mutualisés des PDFs.
//
// En-tête :
//   • Logo de la commune (si commune.logo_url) à gauche
//   • Nom commune + sous-titre (type de document)
//   • Mention « édité avec GoCiviq » à droite
//
// Pied de page (mentions règlementaires) :
//   • Nom de la commune + date d'édition
//   • Mention RGPD (les destinataires peuvent exercer leurs droits)
//   • URL gociviq.fr
//
// Note : pas de logo SVG GoCiviq embarqué (react-pdf ne rend pas
// les SVG nativement) — on utilise un encadré texte stylisé en
// guise de signature.
// ═══════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  logo: { width: 38, height: 38, objectFit: "contain" },
  communeName: { fontSize: 13, fontWeight: 700, color: "#111827" },
  documentType: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  brandBox: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#1a2744",
    borderRadius: 4,
  },
  brandText: { fontSize: 7, color: "#1a2744", fontWeight: 700, letterSpacing: 0.4 },
  brandSub: { fontSize: 7, color: "#6b7280", marginTop: 3 },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
  },
  footerLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#6b7280",
  },
  footerRgpd: {
    fontSize: 6.5,
    color: "#9ca3af",
    marginTop: 3,
    lineHeight: 1.3,
  },
});

export function PdfHeader({
  communeName,
  communeLogoUrl,
  documentType,
  editedOn,
}: {
  communeName: string;
  communeLogoUrl: string | null;
  documentType: string;
  editedOn: string;
}) {
  return (
    <View style={s.header} fixed>
      <View style={s.headerLeft}>
        {communeLogoUrl && (
          <Image src={communeLogoUrl} style={s.logo} />
        )}
        <View>
          <Text style={s.communeName}>{communeName}</Text>
          <Text style={s.documentType}>{documentType}</Text>
        </View>
      </View>
      <View style={s.headerRight}>
        <View style={s.brandBox}>
          <Text style={s.brandText}>GoCiviq</Text>
        </View>
        <Text style={s.brandSub}>Édité le {editedOn}</Text>
      </View>
    </View>
  );
}

export function PdfFooter({
  communeName,
  documentType,
}: {
  communeName: string;
  documentType: string;
}) {
  return (
    <View style={s.footer} fixed>
      <View style={s.footerLine}>
        <Text>{communeName} — {documentType}</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
      </View>
      <Text style={s.footerRgpd}>
        Document à usage administratif. Données personnelles traitées conformément au RGPD ;
        les personnes concernées peuvent exercer leurs droits auprès de la commune. Plateforme GoCiviq —
        gociviq.fr — gestion publique simplifiée pour les collectivités françaises.
      </Text>
    </View>
  );
}
