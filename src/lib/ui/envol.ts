// ═══════════════════════════════════════════════════════════════
// Petite animation « envol » : une copie de l'élément source glisse
// jusqu'à sa destination puis disparaît. Aucune dépendance (Web
// Animations API) ; rien si l'utilisateur a demandé moins d'animations.
// ═══════════════════════════════════════════════════════════════

export const EVT_SUBVENTION_AJOUTEE = "civiq:subvention-ajoutee";

export function animationsReduites(): boolean {
  return typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export async function envolerVers(source: HTMLElement | null, cible: HTMLElement | null, duree = 520): Promise<void> {
  if (!source || !cible || animationsReduites() || typeof source.animate !== "function") return;
  const de = source.getBoundingClientRect();
  const r = cible.getBoundingClientRect();
  // Destination hors écran : l'envol s'arrête au bord visible le plus proche.
  const marge = 8;
  const top = Math.min(Math.max(r.top, marge), window.innerHeight - marge - Math.min(r.height, 40));
  const vers = { left: r.left, top, width: r.width };
  const copie = source.cloneNode(true) as HTMLElement;
  copie.setAttribute("aria-hidden", "true");
  copie.removeAttribute("id");
  Object.assign(copie.style, {
    position: "fixed", left: `${de.left}px`, top: `${de.top}px`, width: `${de.width}px`, height: `${de.height}px`,
    margin: "0", zIndex: "1000", pointerEvents: "none", transformOrigin: "top left", boxSizing: "border-box",
  });
  document.body.appendChild(copie);
  const echelle = Math.max(0.35, Math.min(1, vers.width / Math.max(de.width, 1)));
  const anim = copie.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1, boxShadow: "0 12px 32px rgb(4 47 100 / 0.18)" },
      { transform: `translate(${vers.left - de.left}px, ${vers.top - de.top}px) scale(${echelle})`, opacity: 0.2, boxShadow: "0 2px 6px rgb(4 47 100 / 0.08)" },
    ],
    { duration: duree, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
  );
  // Garde-fou : un onglet non affiché ne fait pas progresser l'animation.
  await Promise.race([anim.finished.catch(() => undefined), new Promise((r) => setTimeout(r, duree + 150))]);
  copie.remove();
}
