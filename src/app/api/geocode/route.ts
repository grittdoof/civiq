import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// GET /api/geocode?q=<adresse>
//
// Proxy de géocodage vers Nominatim (OpenStreetMap) : convertit une
// adresse saisie au back-office en coordonnées, pour afficher le
// lieu d'un événement sur la carte du sondage.
//
// Passe par le serveur pour porter un User-Agent conforme à la
// politique d'usage de Nominatim et éviter le CORS. Réservé aux
// utilisateurs authentifiés (usage back-office uniquement).
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json({ error: "Adresse trop courte" }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "fr");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("q", q);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "GoCiviq/1.0 (https://www.gociviq.fr)",
        "Accept-Language": "fr",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Service de géocodage indisponible" }, { status: 502 });
    }

    const raw = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    return NextResponse.json({
      results: raw.map((r) => ({
        label: r.display_name,
        lat: Number(r.lat),
        lng: Number(r.lon),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Service de géocodage indisponible" }, { status: 502 });
  }
}
