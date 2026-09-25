"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { calculerPlan, type LigneBudget, type PlanFinancement as Plan, type Subvention } from "@/lib/projects/financement";
import { formatEuros } from "@/lib/projects/cost-calc";
import FieldHelp from "./FieldHelp";
import LearnMore from "./LearnMore";

// ═══════════════════════════════════════════════════════════════
// Plan de financement (brief §2.8) — investissement uniquement.
// Recalcul instantané à la saisie (calculerPlan, miroir de la fonction
// SQL) ; après enregistrement, la valeur serveur (project_financement)
// fait foi. Deux contrôles permanents : part communale ≥ 20 %, aides
// publiques ≤ 80 %.
// ═══════════════════════════════════════════════════════════════

interface Props {
  projectId: string;
  serverPlan: Plan | null;
  lignes: LigneBudget[];
  subventions: Subvention[];
  initial: {
    emprunt_prevu: number | null;
    autofinancement_invest: number | null;
    autofinancement_fonct: number | null;
    autofinancement_assume: boolean;
    autofinancement_assume_par_nom: string | null;
    autofinancement_assume_le: string | null;
  };
  tauxFctva: number;
  canEdit: boolean;
}

const pct = (n: number | null) => `${(n ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

const num = (s: string) => {
  const n = Number(s.replace(/[\s  €]/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export default function PlanFinancement({ projectId, serverPlan, lignes, subventions, initial, tauxFctva, canEdit }: Props) {
  const router = useRouter();
  const [emprunt, setEmprunt] = useState(initial.emprunt_prevu?.toString() ?? "");
  const [afi, setAfi] = useState(initial.autofinancement_invest?.toString() ?? "");
  const [aff, setAff] = useState(initial.autofinancement_fonct?.toString() ?? "");
  const [assume, setAssume] = useState(initial.autofinancement_assume);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const live = useMemo(
    () => calculerPlan({
      type: "investissement", lignes, subventions,
      emprunt: num(emprunt), autofinancement_invest: num(afi), autofinancement_fonct: num(aff), taux_fctva: tauxFctva,
    }),
    [lignes, subventions, emprunt, afi, aff, tauxFctva],
  );
  const plan = dirty || !serverPlan ? live : serverPlan;

  async function save(fields: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "L'enregistrement a échoué."); return; }
    setDirty(false);
    router.refresh();
  }

  const input = (id: string, label: string, value: string, setter: (v: string) => void, key: string, hint?: string) => (
    <div className="civiq-field">
      <label htmlFor={id} className="civiq-field-label">{label}</label>
      {hint && <p id={`${id}-hint`} className="civiq-field-hint">{hint}</p>}
      <input id={id} className="civiq-input" inputMode="decimal" value={value} disabled={!canEdit}
        onChange={(e) => { setter(e.target.value); setDirty(true); }}
        onBlur={() => void save({ [key]: value === "" ? null : value })}
        aria-describedby={hint ? `${id}-hint` : undefined} />
    </div>
  );

  const controle = (ok: boolean | null, okText: string, koText: string) =>
    ok === null ? (
      <p className="pj-controle pj-controle-neutre">Saisissez d&apos;abord le coût du projet dans le budget.</p>
    ) : ok ? (
      <p className="pj-controle pj-controle-ok"><CheckCircle2 size={16} aria-hidden="true" /> <strong>Respecté</strong> — {okText}</p>
    ) : (
      <p className="pj-controle pj-controle-ko"><XCircle size={16} aria-hidden="true" /> <strong>Non respecté</strong> — {koText}</p>
    );

  return (
    <section className="pj-plan" aria-labelledby="plan-titre">
      <h2 id="plan-titre" className="pj-section-title">Plan de financement</h2>
      {error && <p className="pj-modal-error" role="alert">{error}</p>}

      <div className="pj-plan-controles">
        <div className="pj-plan-controle">
          <h3 className="pj-plan-controle-titre">Part payée par la commune : au moins 20 %</h3>
          {controle(
            plan.controle_part_commune_ok,
            `la commune finance ${pct(plan.part_commune_pct)} du coût hors taxes.`,
            `la commune ne finance que ${pct(plan.part_commune_pct)} du coût. Il manque ${formatEuros(plan.part_commune_manquante ?? 0)} de part communale.`,
          )}
        </div>
        <div className="pj-plan-controle">
          <h3 className="pj-plan-controle-titre">Aides publiques : au plus 80 %</h3>
          {controle(
            plan.controle_aides_ok,
            `les aides couvrent ${pct(plan.aides_pct)} du coût hors taxes.`,
            `les aides couvrent ${pct(plan.aides_pct)} du coût : ${formatEuros(plan.aides_depassement ?? 0)} de trop. Le financeur réduira son aide.`,
          )}
        </div>
      </div>
      <LearnMore>
        <p>
          La commune doit financer au moins 20 % du projet sur ses fonds propres, et le cumul des aides publiques ne peut pas dépasser
          80 % de son coût (article L.1111-10 du code général des collectivités territoriales). Les aides comptées ici sont celles
          accordées, ou demandées tant que la décision n&apos;est pas connue.
        </p>
      </LearnMore>

      <table className="pj-table pj-plan-table">
        <caption className="pj-sr-only">Plan de financement du projet</caption>
        <tbody>
          <tr><th scope="row">Coût total hors taxes (HT)</th><td>{formatEuros(plan.cout_total_ht)}</td></tr>
          <tr><th scope="row">Coût total toutes taxes comprises (TTC)</th><td>{formatEuros(plan.cout_total_ttc)}</td></tr>
          <tr><th scope="row">Subventions demandées</th><td>{formatEuros(plan.subventions_sollicitees)}</td></tr>
          <tr><th scope="row">Subventions accordées</th><td>{formatEuros(plan.subventions_accordees)}</td></tr>
          <tr><th scope="row">Emprunt à prévoir</th><td>{formatEuros(plan.emprunt)}</td></tr>
          <tr>
            <th scope="row">Récupération de la TVA (FCTVA)<span className="pj-table-sub"> — {String(plan.taux_fctva).replace(".", ",")} % du TTC</span></th>
            <td>{formatEuros(plan.fctva)}</td>
          </tr>
          <tr><th scope="row">Part payée par la commune — investissement</th><td>{formatEuros(plan.autofinancement_invest)}</td></tr>
          <tr><th scope="row">Part payée par la commune — fonctionnement</th><td>{formatEuros(plan.autofinancement_fonct)}</td></tr>
          <tr className={plan.reste_a_financer > 0 ? "pj-plan-reste-ko" : "pj-plan-reste-ok"}>
            <th scope="row">Reste à financer</th>
            <td>{formatEuros(plan.reste_a_financer)}{plan.reste_a_financer > 0 ? " — à trouver" : plan.reste_a_financer < 0 ? " — plan excédentaire" : " — plan équilibré"}</td>
          </tr>
        </tbody>
      </table>
      <FieldHelp id="plan-fctva">
        <p>
          L&apos;État rembourse à la commune une partie de la TVA payée sur ses investissements (FCTVA), en général un à deux ans
          après la dépense : c&apos;est une recette, mais elle arrive tard.
        </p>
      </FieldHelp>

      <div className="pj-params-grid">
        {input("pf-emprunt", "Emprunt à prévoir", emprunt, setEmprunt, "emprunt_prevu")}
        {input("pf-afi", "Part de la commune — investissement", afi, setAfi, "autofinancement_invest", "Les fonds propres de la commune inscrits en section d'investissement.")}
        {input("pf-aff", "Part de la commune — fonctionnement", aff, setAff, "autofinancement_fonct", "Le virement de la section de fonctionnement vers l'investissement.")}
      </div>

      <div className="pj-plan-assume">
        <label className="pj-wiz-check">
          <input type="checkbox" checked={assume} disabled={!canEdit}
            onChange={(e) => { setAssume(e.target.checked); void save({ autofinancement_assume: e.target.checked }); }} />
          Projet autofinancé : la commune renonce volontairement à toute subvention
        </label>
        {initial.autofinancement_assume && initial.autofinancement_assume_le && (
          <p className="civiq-field-hint">
            Coché par {initial.autofinancement_assume_par_nom ?? "un membre de la commune"} le{" "}
            {new Date(initial.autofinancement_assume_le).toLocaleDateString("fr-FR")}.
          </p>
        )}
        <FieldHelp id="plan-autofinance">
          <p>Cochez-le seulement si aucune demande d&apos;aide n&apos;est prévue : c&apos;est ce qui autorise le démarrage des travaux sans accusé de réception d&apos;un financeur.</p>
        </FieldHelp>
      </div>
    </section>
  );
}
