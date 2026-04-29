import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";

// GET /api/super-admin/analytics — stats d'utilisation de la plateforme
// - activity_by_hour : répartition des réponses par heure (0-23) sur 30 jours
// - recent_signups : nouveaux comptes sur 30 jours, groupés par jour
export async function GET() {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }

  const service = await createServiceClient();

  // Via la fonction SQL (migration 004)
  const { data: hourly, error: hErr } = await service.rpc("platform_activity_by_hour");
  if (hErr) {
    return NextResponse.json({ error: hErr.message }, { status: 500 });
  }

  // Fill gaps : toutes les heures 0..23 même si 0 réponses
  const byHour: Array<{ hour: number; count: number }> = [];
  for (let h = 0; h < 24; h++) {
    const row = (hourly ?? []).find((r: { hour_of_day: number; response_count: number }) => r.hour_of_day === h);
    byHour.push({ hour: h, count: Number(row?.response_count ?? 0) });
  }

  // Recent signups (last 30 days)
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: profiles } = await service
    .from("profiles")
    .select("created_at")
    .gte("created_at", since);

  const signupsByDay: Record<string, number> = {};
  (profiles ?? []).forEach((p) => {
    const day = (p.created_at as string).slice(0, 10);
    signupsByDay[day] = (signupsByDay[day] ?? 0) + 1;
  });

  const signups = Object.entries(signupsByDay)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, count]) => ({ day, count }));

  // ─── Heatmap day-of-week × hour, sur 30 jours ───
  const { data: respRaw } = await service
    .from("responses")
    .select("submitted_at")
    .gte("submitted_at", since);

  // grid[dayOfWeek][hour] = count ; lundi=0 … dimanche=6
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  (respRaw ?? []).forEach((r) => {
    const d = new Date(r.submitted_at as string);
    const jsDay = d.getDay();             // 0=dim, 1=lun…
    const dow = (jsDay + 6) % 7;          // 0=lun … 6=dim
    grid[dow][d.getHours()] += 1;
  });

  // Peak hour
  let peakHour = 0;
  let peakHourCount = 0;
  byHour.forEach(({ hour, count }) => {
    if (count > peakHourCount) {
      peakHourCount = count;
      peakHour = hour;
    }
  });

  // Active days (jours où au moins 1 réponse)
  const activeDays = new Set<string>(
    (respRaw ?? []).map((r) => (r.submitted_at as string).slice(0, 10))
  ).size;

  return NextResponse.json({
    activity_by_hour: byHour,
    activity_grid: grid,
    total_responses_30d: byHour.reduce((s, b) => s + b.count, 0),
    peak_hour: peakHour,
    peak_hour_count: peakHourCount,
    active_days: activeDays,
    signups_by_day: signups,
  });
}
