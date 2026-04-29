import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import * as XLSX from "xlsx";

// GET /api/export?survey_id=xxx&format=csv|xlsx|json
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

  // Build a label map from schema (field id → human label)
  const fieldLabels: Record<string, string> = {};
  const fieldOptions: Record<string, Record<string, string>> = {};
  type SchemaField = { id: string; label?: string; options?: { value: string; label: string }[] };
  type SchemaStep = { fields?: SchemaField[] };
  const steps = ((survey?.schema as { steps?: SchemaStep[] })?.steps) || [];
  for (const step of steps) {
    for (const f of step.fields || []) {
      fieldLabels[f.id] = f.label || f.id;
      if (Array.isArray(f.options)) {
        fieldOptions[f.id] = {};
        for (const o of f.options) fieldOptions[f.id][o.value] = o.label;
      }
    }
  }

  function humanize(fieldId: string, val: unknown): string {
    if (val === null || val === undefined) return "";
    const opts = fieldOptions[fieldId];
    if (Array.isArray(val)) {
      return val.map((v) => opts?.[String(v)] || String(v)).join("; ");
    }
    return opts?.[String(val)] || String(val);
  }

  // Collect all unique data keys
  const allKeys = new Set<string>();
  responses.forEach((r) => {
    if (r.data && typeof r.data === "object") {
      Object.keys(r.data as object).forEach((k) => allKeys.add(k));
    }
  });

  const metaCols = ["submitted_at", "respondent_name", "respondent_email", "respondent_phone", "duration_seconds"];
  const metaLabels: Record<string, string> = {
    submitted_at: "Date de soumission",
    respondent_name: "Nom",
    respondent_email: "Email",
    respondent_phone: "Téléphone",
    duration_seconds: "Durée (sec)",
  };
  const dataCols = Array.from(allKeys).filter((k) => !k.startsWith("_"));
  const headers = [...metaCols, ...dataCols];
  const headerLabels = headers.map((h) => metaLabels[h] || fieldLabels[h] || h);

  // ─── XLSX export ───
  if (format === "xlsx") {
    const aoa: unknown[][] = [headerLabels];
    responses.forEach((r) => {
      const data = (r.data as Record<string, unknown>) || {};
      const row = headers.map((h) => {
        if (metaCols.includes(h)) {
          const v = r[h as keyof typeof r];
          if (h === "submitted_at" && v) return new Date(v as string);
          return v ?? "";
        }
        return humanize(h, data[h]);
      });
      aoa.push(row);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Auto width estimate
    ws["!cols"] = headerLabels.map((label, i) => {
      const maxData = aoa.slice(1).reduce((m, row) => {
        const v = row[i];
        const len = v instanceof Date ? 10 : String(v ?? "").length;
        return Math.max(m, len);
      }, label.length);
      return { wch: Math.min(60, Math.max(10, maxData + 2)) };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Réponses");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${(survey?.title || "export").replace(/[^a-zA-Z0-9-_]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  }

  const escapeCSV = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = Array.isArray(val) ? val.join("; ") : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = responses.map((r) => {
    const data = (r.data as Record<string, unknown>) || {};
    return headers
      .map((h) => {
        if (metaCols.includes(h)) return escapeCSV(r[h as keyof typeof r]);
        return escapeCSV(humanize(h, data[h]));
      })
      .join(",");
  });

  const csv = [headerLabels.join(","), ...rows].join("\n");
  const bom = "\uFEFF"; // UTF-8 BOM for Excel

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${survey?.title || "export"}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
