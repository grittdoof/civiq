"use client";

import { useState, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import LearnMore from "./LearnMore";
import type { CommuneParametres } from "@/lib/projects/commune-parametres";

// ═══════════════════════════════════════════════════════════════
// Paramètres projets de la commune — 3 blocs (brief §2.1).
// Volontairement minimal : un secrétaire de mairie doit pouvoir le
// remplir sans aide. Tout est facultatif : un champ vide désactive
// simplement l'alerte correspondante, sans message « non configuré ».
// ═══════════════════════════════════════════════════════════════

interface Props {
  initial: CommuneParametres;
  canEdit: boolean;
}

type FormState = {
  seuil_delegation_maire_ht: string;
  delegation_deliberation_num: string;
  delegation_deliberation_date: string;
  regles_internes_actives: boolean;
  nb_devis_exige: string;
  seuil_devis_exige_ht: string;
  taux_fctva: string;
  code_insee: string;
};

function toForm(p: CommuneParametres): FormState {
  return {
    seuil_delegation_maire_ht: p.seuil_delegation_maire_ht === null ? "" : String(p.seuil_delegation_maire_ht),
    delegation_deliberation_num: p.delegation_deliberation_num ?? "",
    delegation_deliberation_date: p.delegation_deliberation_date ?? "",
    regles_internes_actives: p.regles_internes_actives,
    nb_devis_exige: String(p.nb_devis_exige),
    seuil_devis_exige_ht: String(p.seuil_devis_exige_ht),
    taux_fctva: String(p.taux_fctva),
    code_insee: p.code_insee ?? "",
  };
}

export default function CommuneParametresForm({ initial, canEdit }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus("idle");
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setMessage(null);
    try {
      const res = await fetch("/api/commune-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // Guide interne éteint : on ne soumet pas ses champs.
          ...(form.regles_internes_actives ? {} : { nb_devis_exige: undefined, seuil_devis_exige_ht: undefined }),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors((json.fields as Record<string, string>) ?? {});
        setMessage(json.error ?? "L'enregistrement a échoué.");
        setStatus("error");
        return;
      }
      setErrors({});
      if (json.settings) setForm(toForm(json.settings as CommuneParametres));
      setStatus("saved");
    } catch {
      setMessage("Connexion impossible. Vos saisies sont conservées : réessayez.");
      setStatus("error");
    }
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <p id={`${key}-error`} className="civiq-field-error-msg" role="alert">{errors[key]}</p>
    ) : null;
  const describedBy = (key: string, hint?: string) =>
    [hint, errors[key] ? `${key}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={onSubmit} className="pj-params" noValidate>
      <fieldset disabled={!canEdit} className="pj-params-fieldset">
        {/* ─── Bloc A — Délégation du conseil au maire ─── */}
        <section className="civiq-card pj-params-card" aria-labelledby="bloc-a-title">
          <h2 id="bloc-a-title" className="pj-params-title">Délégation du conseil au maire</h2>
          <p className="pj-params-intro">
            En début de mandat, le conseil municipal fixe le montant jusqu&apos;auquel le maire peut signer un
            marché sans repasser devant le conseil. Vous trouverez ce montant dans la délibération de délégation,
            au paragraphe consacré aux marchés publics.
          </p>
          <p className="pj-params-note">
            <em>Vous ne savez pas ? Laissez vide : GoCiviq n&apos;affichera simplement pas cette alerte.</em>
          </p>

          <div className="pj-params-grid">
            <div className="civiq-field">
              <label htmlFor="seuil_delegation_maire_ht" className="civiq-field-label">
                Montant maximum hors taxes (HT)
              </label>
              <p id="seuil-hint" className="civiq-field-hint">
                Le montant avant TVA, en euros. Exemple : 40 000.
              </p>
              <input
                id="seuil_delegation_maire_ht"
                className="civiq-input"
                inputMode="decimal"
                value={form.seuil_delegation_maire_ht}
                onChange={(e) => set("seuil_delegation_maire_ht", e.target.value)}
                aria-invalid={!!errors.seuil_delegation_maire_ht}
                aria-describedby={describedBy("seuil_delegation_maire_ht", "seuil-hint")}
              />
              {fieldError("seuil_delegation_maire_ht")}
            </div>
            <div className="civiq-field">
              <label htmlFor="delegation_deliberation_num" className="civiq-field-label">
                Numéro de la délibération
              </label>
              <input
                id="delegation_deliberation_num"
                className="civiq-input"
                value={form.delegation_deliberation_num}
                onChange={(e) => set("delegation_deliberation_num", e.target.value)}
                aria-invalid={!!errors.delegation_deliberation_num}
                aria-describedby={describedBy("delegation_deliberation_num")}
              />
              {fieldError("delegation_deliberation_num")}
            </div>
            <div className="civiq-field">
              <label htmlFor="delegation_deliberation_date" className="civiq-field-label">
                Date de la délibération
              </label>
              <input
                id="delegation_deliberation_date"
                type="date"
                className="civiq-input"
                value={form.delegation_deliberation_date}
                onChange={(e) => set("delegation_deliberation_date", e.target.value)}
                aria-invalid={!!errors.delegation_deliberation_date}
                aria-describedby={describedBy("delegation_deliberation_date")}
              />
              {fieldError("delegation_deliberation_date")}
            </div>
          </div>

          <LearnMore>
            <p>
              Ce montant n&apos;est pas un seuil de publicité. Les seuils au-delà desquels un marché doit être
              publié et mis en concurrence sont fixés par décret, pour toutes les communes : GoCiviq les connaît
              déjà et les applique automatiquement.
            </p>
            <p>
              Ce que le conseil délibère ici, c&apos;est la délégation au maire prévue par l&apos;article
              L.2122-22 4° du code général des collectivités territoriales : au-delà de ce montant, une
              délibération du conseil est nécessaire avant de signer.
            </p>
          </LearnMore>
        </section>

        {/* ─── Bloc B — Guide interne des achats ─── */}
        <section className="civiq-card pj-params-card" aria-labelledby="bloc-b-title">
          <h2 id="bloc-b-title" className="pj-params-title">Votre commune a-t-elle délibéré un guide des achats ?</h2>
          <p className="pj-params-intro">
            Certaines communes se fixent des règles plus strictes que la loi, par exemple demander
            systématiquement trois devis au-delà d&apos;un certain montant. Si c&apos;est votre cas,
            indiquez-le ici. Sinon, laissez désactivé.
          </p>

          <label className="pj-params-switch">
            <input
              type="checkbox"
              checked={form.regles_internes_actives}
              onChange={(e) => set("regles_internes_actives", e.target.checked)}
            />
            <span>Oui, notre commune applique un guide interne des achats</span>
          </label>

          {form.regles_internes_actives && (
            <div className="pj-params-grid">
              <div className="civiq-field">
                <label htmlFor="nb_devis_exige" className="civiq-field-label">Nombre de devis demandés</label>
                <input
                  id="nb_devis_exige"
                  className="civiq-input"
                  inputMode="numeric"
                  value={form.nb_devis_exige}
                  onChange={(e) => set("nb_devis_exige", e.target.value)}
                  aria-invalid={!!errors.nb_devis_exige}
                  aria-describedby={describedBy("nb_devis_exige")}
                />
                {fieldError("nb_devis_exige")}
              </div>
              <div className="civiq-field">
                <label htmlFor="seuil_devis_exige_ht" className="civiq-field-label">
                  À partir de (montant hors taxes, HT)
                </label>
                <p id="seuil-devis-hint" className="civiq-field-hint">Le montant avant TVA, en euros.</p>
                <input
                  id="seuil_devis_exige_ht"
                  className="civiq-input"
                  inputMode="decimal"
                  value={form.seuil_devis_exige_ht}
                  onChange={(e) => set("seuil_devis_exige_ht", e.target.value)}
                  aria-invalid={!!errors.seuil_devis_exige_ht}
                  aria-describedby={describedBy("seuil_devis_exige_ht", "seuil-devis-hint")}
                />
                {fieldError("seuil_devis_exige_ht")}
              </div>
              <p className="pj-params-note pj-params-note-wide">
                <strong>Recommandé</strong>, jamais bloquant : GoCiviq vous rappellera cette règle quand un projet
                n&apos;a pas encore le nombre de devis prévu.
              </p>
            </div>
          )}
        </section>

        {/* ─── Bloc C — Divers ─── */}
        <section className="civiq-card pj-params-card" aria-labelledby="bloc-c-title">
          <h2 id="bloc-c-title" className="pj-params-title">Informations de la commune</h2>
          <div className="pj-params-grid">
            <div className="civiq-field">
              <label htmlFor="code_insee" className="civiq-field-label">Code INSEE de la commune</label>
              <p id="insee-hint" className="civiq-field-hint">
                À ne pas confondre avec le code postal. Il sert à retrouver les aides auxquelles votre commune peut
                prétendre. Vous le trouverez sur le site de l&apos;INSEE ou sur vos courriers de la préfecture.
              </p>
              <input
                id="code_insee"
                className="civiq-input"
                value={form.code_insee}
                maxLength={5}
                onChange={(e) => set("code_insee", e.target.value)}
                aria-invalid={!!errors.code_insee}
                aria-describedby={describedBy("code_insee", "insee-hint")}
              />
              {fieldError("code_insee")}
            </div>
            <div className="civiq-field">
              <label htmlFor="taux_fctva" className="civiq-field-label">
                Taux de récupération de la TVA (FCTVA), en %
              </label>
              <p id="fctva-hint" className="civiq-field-hint">
                L&apos;État rembourse à la commune une partie de la TVA payée sur ses investissements. Le taux en
                vigueur est de 16,404 % : ne le modifiez que s&apos;il change.
              </p>
              <input
                id="taux_fctva"
                className="civiq-input"
                inputMode="decimal"
                value={form.taux_fctva}
                onChange={(e) => set("taux_fctva", e.target.value)}
                aria-invalid={!!errors.taux_fctva}
                aria-describedby={describedBy("taux_fctva", "fctva-hint")}
              />
              {fieldError("taux_fctva")}
            </div>
          </div>
        </section>
      </fieldset>

      {canEdit ? (
        <div className="pj-params-actions">
          <button type="submit" className="civiq-btn civiq-btn-default" disabled={status === "saving"}>
            {status === "saving" ? <Loader2 size={16} className="civiq-spin" aria-hidden="true" /> : null}
            Enregistrer
          </button>
          <p className="pj-params-status" role="status" aria-live="polite">
            {status === "saved" && (<><Check size={14} aria-hidden="true" /> Paramètres enregistrés</>)}
            {status === "error" && message}
          </p>
        </div>
      ) : (
        <p className="pj-params-note">
          Seul un administrateur de la commune peut modifier ces paramètres.
        </p>
      )}
    </form>
  );
}
