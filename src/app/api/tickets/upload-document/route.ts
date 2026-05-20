import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/tickets/upload-document
 *
 * Form-data : file (binary) + path (string)
 * Upload un document dans le bucket "tickets" (chemin spécifié).
 * Auth requise. Limite : 10 Mo par fichier.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "txt", "odt", "ods",
]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const path = form.get("path");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
  }
  if (typeof path !== "string" || !path.startsWith("tickets/")) {
    return NextResponse.json({ error: "Chemin invalide" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 10 Mo)" }, { status: 400 });
  }

  const ext = (path.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: "Format non autorisé" }, { status: 400 });
  }

  const service = await createServiceClient();
  const bytes = await file.arrayBuffer();
  const { error } = await service.storage
    .from("tickets")
    .upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ path });
}
