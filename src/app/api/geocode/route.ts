import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// GET /api/geocode?q=<adresse>       — recherche (autocomplétion)
// GET /api/geocode?lat=..&lng=..     — géocodage inverse
//
// Proxy vers Nominatim (OpenStreetMap) : convertit l'adresse d'un
// événement en coordonnées et, inversement, un point posé sur la
// carte en adresse lisible.
//
// Passe par le serveur pour porter un User-Agent conforme à la
// politique d'usage de Nominatim et éviter le CORS. Réservé aux
// utilisateurs authentifiés (usage back-office uniquement).
// ═══════════════════════════════════════════════════════════════

const UA = "GoCiviq/1.0 (contact@gociviq.fr)";

interface NominatimAddress {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  postcode?: string;
}

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: NominatimAddress;
}

/** « 12 rue de la Mairie, 06740 Châteauneuf » — sans le pays ni la région. */
function shortLabel(p: NominatimPlace): string {
  const a = p.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const city = a.village || a.town || a.city || a.municipality || "";
  const parts = [
    // Nominatim renvoie le nom du POI (« Salle des fêtes ») dans `name`
    p.name && p.name !== street ? p.name : null,
    street || null,
    [a.postcode, city].filter(Boolean).join(" ") || null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : p.display_name;
}

function toResult(p: NominatimPlace) {
  return {
    label: shortLabel(p),
    detail: p.display_name,
    lat: Number(p.lat),
    lng: Number(p.lon),
  };
}

async function callNominatim(url: URL) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "fr" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const lat = sp.get("lat");
  const lng = sp.get("lng");

  // ─── Géocodage inverse : un point sur la carte → une adresse ───
  if (lat && lng) {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "18");
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lng);

    try {
      const raw = (await callNominatim(url)) as NominatimPlace;
      if (!raw?.lat) return NextResponse.json({ results: [] });
      return NextResponse.json({ results: [toResult(raw)] });
    } catch {
      return NextResponse.json({ error: "Service de géocodage indisponible" }, { status: 502 });
    }
  }

  // ─── Recherche : autocomplétion sur la saisie ───
  const q = sp.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json({ results: [] });
  }

  // Le contexte (commune, code postal) remonte fortement la pertinence :
  // « salle des fêtes » seul ne donne rien d'exploitable.
  const context = sp.get("context")?.trim();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", "fr");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("q", context ? `${q}, ${context}` : q);

  try {
    let raw = (await callNominatim(url)) as NominatimPlace[];

    // Rien avec le contexte : on retente la saisie seule plutôt que de
    // renvoyer une liste vide à l'utilisateur.
    if (context && (!raw || raw.length === 0)) {
      url.searchParams.set("q", q);
      raw = (await callNominatim(url)) as NominatimPlace[];
    }

    return NextResponse.json({ results: (raw ?? []).map(toResult) });
  } catch {
    return NextResponse.json({ error: "Service de géocodage indisponible" }, { status: 502 });
  }
}
