"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Download, ArrowLeft, Users, Clock, Calendar } from "lucide-react";
import Link from "next/link";
import type { Survey, SurveyResponse, SurveyField, FieldAnalytics } from "@/types/survey";

const COLORS = ["#3b6fa0", "#c9a84c", "#3a7d5c", "#d85a30", "#534ab7", "#1d9e75", "#d4537e", "#888780"];

export default function SurveyResultsPage() {
  const params = useParams();
  const surveyId = params.id as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, [surveyId]);

  async function loadResults() {
    const supabase = createClient();

    const { data: surveyData } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", surveyId)
      .single();

    const { data: responseData } = await supabase
      .from("responses")
      .select("*")
      .eq("survey_id", surveyId)
      .order("submitted_at", { ascending: true });

    if (surveyData) setSurvey(surveyData as Survey);
    if (responseData) setResponses(responseData as SurveyResponse[]);
    setLoading(false);
  }

  // Compute analytics for each field
  const analytics = useMemo<FieldAnalytics[]>(() => {
    if (!survey || !responses.length) return [];

    const results: FieldAnalytics[] = [];

    for (const step of survey.schema.steps) {
      for (const field of step.fields) {
        if (!["radio", "select", "checkbox", "checkbox_grid", "scale"].includes(field.type)) continue;

        const dist: Record<string, number> = {};
        let totalAnswers = 0;

        // Init all options to 0
        if (field.options) {
          field.options.forEach((o) => (dist[o.label] = 0));
        }

        for (const r of responses) {
          const val = (r.data as Record<string, unknown>)[field.id];
          if (val === undefined || val === null) continue;
          totalAnswers++;

          if (Array.isArray(val)) {
            // Checkbox
            for (const v of val) {
              const opt = field.options?.find((o) => o.value === v);
              const label = opt?.label || v;
              dist[label] = (dist[label] || 0) + 1;
            }
          } else {
            const opt = field.options?.find((o) => o.value === String(val));
            const label = opt?.label || String(val);
            dist[label] = (dist[label] || 0) + 1;
          }
        }

        results.push({
          field_id: field.id,
          field_label: field.label,
          type: field.type,
          distribution: dist,
          total_answers: totalAnswers,
        });
      }
    }

    return results;
  }, [survey, responses]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80, color: "#888" }}>
        Chargement des résultats…
      </div>
    );
  }

  if (!survey) {
    return <div style={{ padding: 80, textAlign: "center" }}>Sondage introuvable</div>;
  }

  const avgDuration = responses.length
    ? Math.round(
        responses.reduce((s, r) => s + (r.duration_seconds || 0), 0) / responses.length
      )
    : 0;

  return (
    <div className="results-page">
      <Link href="/admin/dashboard" className="back-link">
        <ArrowLeft size={16} /> Retour au tableau de bord
      </Link>

      <header className="results-header">
        <div>
          <h1>{survey.title}</h1>
          <p>{survey.description}</p>
        </div>
        <a
          href={`/api/export?survey_id=${surveyId}&format=csv`}
          className="export-btn"
        >
          <Download size={16} /> Exporter CSV
        </a>
      </header>

      {/* Summary stats */}
      <div className="results-summary">
        <div className="summary-stat">
          <Users size={20} />
          <div>
            <strong>{responses.length}</strong>
            <span>réponses</span>
          </div>
        </div>
        <div className="summary-stat">
          <Clock size={20} />
          <div>
            <strong>{avgDuration ? `${Math.floor(avgDuration / 60)}m${avgDuration % 60}s` : "—"}</strong>
            <span>durée moyenne</span>
          </div>
        </div>
        <div className="summary-stat">
          <Calendar size={20} />
          <div>
            <strong>
              {responses.length
                ? new Date(responses[responses.length - 1].submitted_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })
                : "—"}
            </strong>
            <span>dernière réponse</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {analytics.map((a) => {
          const data = Object.entries(a.distribution)
            .map(([name, value]) => ({ name, value }))
            .filter((d) => d.value > 0)
            .sort((a, b) => b.value - a.value);

          if (data.length === 0) return null;

          const useBar = data.length > 4;

          return (
            <div key={a.field_id} className="chart-card">
              <h3>{a.field_label}</h3>
              <p className="chart-meta">
                {a.total_answers} réponse{a.total_answers > 1 ? "s" : ""}
              </p>

              {useBar ? (
                <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
                  <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis type="number" fontSize={12} />
                    <YAxis type="category" dataKey="name" width={160} fontSize={12} tick={{ fill: "#666" }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b6fa0" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        `${name} (${(percent * 100).toFixed(0)}%)`
                      }
                      labelLine={false}
                      fontSize={12}
                    >
                      {data.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}

              {/* Raw numbers */}
              <div className="chart-legend">
                {data.map((d, i) => (
                  <div key={d.name} className="legend-row">
                    <span
                      className="legend-dot"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="legend-label">{d.name}</span>
                    <span className="legend-value">
                      {d.value} ({((d.value / a.total_answers) * 100).toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Free-text responses */}
      {survey.schema.steps.flatMap((step) =>
        step.fields
          .filter((f) => f.type === "textarea")
          .map((field) => {
            const textResponses = responses
              .map((r) => (r.data as Record<string, unknown>)[field.id])
              .filter((v) => v && String(v).trim())
              .map(String);

            if (textResponses.length === 0) return null;

            return (
              <div key={field.id} className="text-responses-card">
                <h3>{field.label}</h3>
                <p className="chart-meta">{textResponses.length} commentaire{textResponses.length > 1 ? "s" : ""}</p>
                <div className="text-list">
                  {textResponses.map((t, i) => (
                    <div key={i} className="text-item">
                      <span className="text-num">#{i + 1}</span>
                      <p>{t}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
      )}

      <style>{`
        .results-page {
          max-width: 1000px;
          margin: 0 auto;
          padding: 32px 24px 60px;
          font-family: 'Source Sans 3', -apple-system, sans-serif;
        }
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #888;
          text-decoration: none;
          font-size: 14px;
          margin-bottom: 20px;
        }
        .back-link:hover { color: #3b6fa0; }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }
        .results-header h1 {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 700;
          color: #1a2744;
          margin-bottom: 4px;
        }
        .results-header p { font-size: 14px; color: #888; }
        .export-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 8px;
          background: #fff;
          border: 1px solid #e8e5de;
          color: #1a2744;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: 0.2s;
          white-space: nowrap;
        }
        .export-btn:hover { border-color: #3b6fa0; color: #3b6fa0; }

        .results-summary {
          display: flex;
          gap: 24px;
          margin-bottom: 32px;
          flex-wrap: wrap;
        }
        .summary-stat {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #fff;
          padding: 16px 20px;
          border-radius: 10px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.04);
          color: #3b6fa0;
        }
        .summary-stat strong { display: block; font-size: 20px; font-weight: 700; color: #1a2744; }
        .summary-stat span { font-size: 12px; color: #999; }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }
        .chart-card {
          background: #fff;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.04);
        }
        .chart-card h3 { font-size: 16px; font-weight: 600; color: #1a2744; margin-bottom: 4px; }
        .chart-meta { font-size: 12px; color: #999; margin-bottom: 16px; }

        .chart-legend { margin-top: 16px; }
        .legend-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
          font-size: 13px;
        }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .legend-label { flex: 1; color: #444; }
        .legend-value { font-weight: 600; color: #1a2744; }

        .text-responses-card {
          background: #fff;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.04);
          margin-bottom: 24px;
        }
        .text-responses-card h3 { font-size: 16px; font-weight: 600; color: #1a2744; margin-bottom: 4px; }
        .text-list { margin-top: 12px; }
        .text-item {
          display: flex;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #f2efe8;
        }
        .text-item:last-child { border-bottom: none; }
        .text-num { font-size: 12px; color: #bbb; font-weight: 600; min-width: 28px; }
        .text-item p { font-size: 14px; line-height: 1.5; color: #444; }

        @media (max-width: 768px) {
          .results-header { flex-direction: column; gap: 16px; }
          .charts-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
