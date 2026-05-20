// ═══════════════════════════════════════════════════════════════
// Wrapper Nominatim (OpenStreetMap) — gratuit, no key
// Conditions d'usage : User-Agent obligatoire + max 1 req/sec.
// On debounce côté client (300-500ms) ; pas de polling agressif.
// ═══════════════════════════════════════════════════════════════

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const UA = "GoCiviq/1.0 (contact@gociviq.fr)";

export interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
  address?: {
    house_number?: string;
    road?: string;
    village?: string;
    town?: string;
    city?: string;
    postcode?: string;
    state?: string;
    country?: string;
  };
}

/**
 * Recherche d'adresse libre. Biaisée vers la France ; le contexte
 * (commune, code postal) doit être ajouté par l'appelant pour de
 * meilleurs résultats.
 */
export async function searchAddress(
  query: string,
  options: { context?: string; limit?: number } = {}
): Promise<NominatimResult[]> {
  if (!query.trim()) return [];
  const fullQuery = options.context ? `${query}, ${options.context}` : query;

  const params = new URLSearchParams({
    q: fullQuery,
    format: "json",
    limit: String(options.limit ?? 5),
    countrycodes: "fr",
    addressdetails: "1",
  });

  try {
    const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      headers: { "User-Agent": UA, "Accept-Language": "fr" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as NominatimResult[];
  } catch {
    return [];
  }
}

/**
 * Reverse geocoding : coordonnées → adresse.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<NominatimResult | null> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lng.toString(),
    format: "json",
    "accept-language": "fr",
    addressdetails: "1",
  });

  try {
    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
      headers: { "User-Agent": UA, "Accept-Language": "fr" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as NominatimResult;
  } catch {
    return null;
  }
}

/** Formate une adresse Nominatim en chaîne courte « 12 rue X, Châteauneuf ». */
export function formatShortAddress(r: NominatimResult): string {
  const a = r.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const city = a.village || a.town || a.city || "";
  return [street, city].filter(Boolean).join(", ") || r.display_name;
}
