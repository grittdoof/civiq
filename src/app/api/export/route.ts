import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/export?survey_id=xxx&format=csv
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const surveyId = searchParams.get("survey_id");
  const format = searchParams.get("format") || "csv";

  if (!surveyId) {
    return NextResponse.json({ error: "survey_id requis" }, { status: 400 });
  }

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Fetch survey + responses
  const { data: survey } = await supabase
    .from("surveys")
    .select("title, schema")
    .eq("id", surveyId)
    .single();

  const { data: responses, error } = await supabase
    .from("responses")
    .select("*")
    .eq("survey_id", surveyId)
    .order("submitted_at", { ascending: true });

  if (error || !responses) {
    return NextResponse.json({ error: "Erreur récupération" }, { status: 500 });
  }

  if (format === "json") {
    return NextResponse.json({
      survey: survey?.title,
      total: responses.length,
      responses,
    });
  }

  // CSV export
  // Collect all unique data keys
  const allKeys = new Set<string>();
  responses.forEach((r) => {
    if (r.data && typeof r.data === "object") {
      Object.keys(r.data as object).forEach((k) => allKeys.add(k));
    }
  });

  const metaCols = ["submitted_at", "respondent_name", "respondent_email", "respondent_phone", "duration_seconds"];
  const dataCols = Array.from(allKeys).filter((k) => !k.startsWith("_"));
  const headers = [...metaCols, ...dataCols];

  const escapeCSV = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = Array.isArray(val) ? val.join("; ") : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = responses.map((r) => {
    const data = r.data as Record<string, unknown>;
    return headers
      .map((h) => {
        if (metaCols.includes(h)) return escapeCSV(r[h as keyof typeof r]);
        return escapeCSV(data[h]);
      })
      .join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const bom = "\uFEFF"; // UTF-8 BOM for Excel

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${survey?.title || "export"}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
