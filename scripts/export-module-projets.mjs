#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Export complet du module Projets & Commissions (audit §1.7, S-1 à S-3).
//
//   • chaque table → JSON + CSV (UTF-8 BOM, lisible dans Excel)
//   • fichiers Storage (documents, photos, logos) → copie locale
//   • manifest.json : nombre de lignes par table + SHA-256 de chaque fichier
//
// Les pièces jointes sont des archives publiques (Code du patrimoine) :
// cet export est la copie de sûreté à conserver avant toute refonte.
//
// Usage :
//   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//     node scripts/export-module-projets.mjs [dossier]
// Par défaut : ./backups/<date>/  (dossier ignoré par git).
// ⚠ Contient des données personnelles : stocker hors du dépôt, sur un
//   support chiffré, et supprimer les copies de travail.
// ═══════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  process.exit(1);
}

const TABLES = [
  "projects", "milestones", "project_documents", "financings", "project_quotes",
  "project_budget_lines", "project_deliberations", "project_authorizations",
  "project_communications", "project_stakeholders", "project_subscribers",
  "project_phase_log", "project_lifecycle_costs", "contacts", "stakeholders_legacy",
  "stakeholders", "milestone_contacts", "commissions", "commission_members",
  "commission_projects", "commission_sessions", "session_attendance", "session_decisions",
  "session_documents", "session_convocations", "session_minutes_sends",
  "commune_settings", "types_projet", "communes",
];
const BUCKETS = ["project-documents", "project-photos", "commune-logos"];
const PAGE = 1000;

const supabase = createClient(url, key, { auth: { persistSession: false } });
const outDir = path.resolve(process.argv[2] ?? path.join("backups", new Date().toISOString().slice(0, 10)));
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE - 1);
    if (error) return { error };
    rows.push(...data);
    if (data.length < PAGE) return { rows };
  }
}

async function listFiles(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`${bucket}/${prefix} : ${error.message}`);
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      // Les dossiers n'ont pas d'id dans l'API Storage.
      if (item.id === null) files.push(...(await listFiles(bucket, full)));
      else files.push(full);
    }
    if (data.length < PAGE) return files;
  }
}

const manifest = { exported_at: new Date().toISOString(), source: url, tables: {}, files: [] };

await mkdir(path.join(outDir, "tables"), { recursive: true });
for (const table of TABLES) {
  const res = await fetchAll(table);
  if (res.error) {
    // Table absente selon l'état des migrations (ex. contacts avant 039).
    manifest.tables[table] = { skipped: res.error.message };
    console.warn(`· ${table} ignorée : ${res.error.message}`);
    continue;
  }
  const json = JSON.stringify(res.rows, null, 2);
  const csv = "﻿" + Papa.unparse(res.rows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v !== null && typeof v === "object" ? JSON.stringify(v) : v])),
  ));
  await writeFile(path.join(outDir, "tables", `${table}.json`), json);
  await writeFile(path.join(outDir, "tables", `${table}.csv`), csv);
  manifest.tables[table] = { rows: res.rows.length, sha256_json: sha256(json) };
  console.log(`✓ ${table} (${res.rows.length})`);
}

for (const bucket of BUCKETS) {
  const files = await listFiles(bucket);
  for (const file of files) {
    const { data, error } = await supabase.storage.from(bucket).download(file);
    if (error) {
      manifest.files.push({ bucket, path: file, error: error.message });
      console.warn(`✗ ${bucket}/${file} : ${error.message}`);
      continue;
    }
    const buf = Buffer.from(await data.arrayBuffer());
    const dest = path.join(outDir, "storage", bucket, file);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    manifest.files.push({ bucket, path: file, bytes: buf.length, sha256: sha256(buf) });
  }
  console.log(`✓ bucket ${bucket} (${files.length} fichiers)`);
}

await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
const failed = manifest.files.filter((f) => f.error).length;
console.log(`\nExport terminé → ${outDir}${failed ? ` (⚠ ${failed} fichier(s) en échec, voir manifest.json)` : ""}`);
process.exit(failed ? 2 : 0);
