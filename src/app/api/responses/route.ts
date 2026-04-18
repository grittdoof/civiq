import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { createHash } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { survey_id, data, respondent_name, respondent_email, respondent_phone, duration_seconds } = body;

    if (!survey_id || !data) {
      return NextResponse.json(
        { error: "survey_id et data sont requis" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Vérifier que le sondage existe et est publié
    const { data: survey, error: surveyError } = await supabase
      .from("surveys")
      .select("id, commune_id, status, ends_at, max_responses")
      .eq("id", survey_id)
      .single();

    if (!survey || surveyError) {
      return NextResponse.json(
        { error: "Sondage introuvable" },
        { status: 404 }
      );
    }

    if (survey.status !== "published") {
      return NextResponse.json(
        { error: "Ce sondage n'accepte plus de réponses" },
        { status: 403 }
      );
    }

    // Vérifier la date de fin
    if (survey.ends_at && new Date(survey.ends_at) < new Date()) {
      return NextResponse.json(
        { error: "Ce sondage est terminé" },
        { status: 403 }
      );
    }

    // Vérifier le nombre max de réponses
    if (survey.max_responses) {
      const { count } = await supabase
        .from("responses")
        .select("*", { count: "exact", head: true })
        .eq("survey_id", survey_id);

      if (count && count >= survey.max_responses) {
        return NextResponse.json(
          { error: "Nombre maximum de réponses atteint" },
          { status: 403 }
        );
      }
    }

    // Anti-doublon basique : hash de l'IP + User-Agent
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const ua = request.headers.get("user-agent") || "unknown";
    const ipHash = createHash("sha256")
      .update(`${ip}-${ua}-${survey_id}`)
      .digest("hex")
      .slice(0, 16);

    // Insérer la réponse
    const { data: response, error: insertError } = await supabase
      .from("responses")
      .insert({
        survey_id,
        commune_id: survey.commune_id,
        data,
        respondent_name: respondent_name || null,
        respondent_email: respondent_email || null,
        respondent_phone: respondent_phone || null,
        ip_hash: ipHash,
        user_agent: ua.slice(0, 255),
        duration_seconds: duration_seconds || null,
      })
      .select("id, submitted_at")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      response_id: response.id,
      submitted_at: response.submitted_at,
    });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json(
      { error: "Erreur interne" },
      { status: 500 }
    );
  }
}
