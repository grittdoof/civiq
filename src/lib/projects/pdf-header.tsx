/* eslint-disable jsx-a11y/alt-text */
import fs from "node:fs";
import path from "node:path";
import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";

// ═══════════════════════════════════════════════════════════════
// En-tête et pied de page mutualisés des PDFs.
//
// En-tête :
//   • Logo de la commune (si commune.logo_url) à gauche, bien visible
//   • Nom commune + sous-titre (type de document)
//   • Date d'édition à droite
//
// Pied de page (mentions règlementaires) :
//   • Nom de la commune + type de document, pagination
//   • Mention RGPD (les destinataires peuvent exercer leurs droits)
//   • Petit logo GoCiviq, discret (PNG local : react-pdf ne rend pas
//     le SVG ; le fichier est inclus dans les fonctions via
//     outputFileTracingIncludes)
//
// react-pdf ne lit que le PNG et le JPEG : tout autre format de logo
// (SVG, WebP…) est ignoré plutôt que de faire échouer le PDF.
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
  logo: { height: 46, maxWidth: 130, objectFit: "contain" },
  communeName: { fontSize: 13, fontWeight: 700, color: "#111827" },
  documentType: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  brandSub: { fontSize: 7, color: "#6b7280" },

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
  footerBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    marginTop: 3,
  },
  footerRgpd: {
    flex: 1,
    fontSize: 6.5,
    color: "#9ca3af",
    lineHeight: 1.3,
  },
  footerBrand: { width: 44, height: 16, objectFit: "contain", opacity: 0.55 },
});

/** Logo exploitable par react-pdf (PNG / JPEG) ou null. */
export function pdfSafeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const clean = url.split("?")[0].toLowerCase();
  if (clean.startsWith("data:image/png") || clean.startsWith("data:image/jpeg")) return url;
  return /\.(png|jpe?g)$/.test(clean) ? url : null;
}

let gociviqLogoPath: string | null | undefined;
function getGociviqLogo(): string | null {
  if (gociviqLogoPath === undefined) {
    const p = path.join(process.cwd(), "public", "brand", "logo-horizontal.png");
    gociviqLogoPath = fs.existsSync(p) ? p : null;
  }
  return gociviqLogoPath;
}

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
        {pdfSafeImageUrl(communeLogoUrl) && (
          <Image src={pdfSafeImageUrl(communeLogoUrl)!} style={s.logo} />
        )}
        <View>
          <Text style={s.communeName}>{communeName}</Text>
          <Text style={s.documentType}>{documentType}</Text>
        </View>
      </View>
      <View style={s.headerRight}>
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
      <View style={s.footerBottom}>
        <Text style={s.footerRgpd}>
          Document à usage administratif. Données personnelles traitées conformément au RGPD ;
          les personnes concernées peuvent exercer leurs droits auprès de la commune. Plateforme GoCiviq —
          gociviq.fr — gestion publique simplifiée pour les collectivités françaises.
        </Text>
        {getGociviqLogo() && <Image src={getGociviqLogo()!} style={s.footerBrand} />}
      </View>
    </View>
  );
}
