// Chemins des photos de signalement (bucket privé `tickets-photos`).
//
// Le navigateur dépose la photo sous `<commune_id>/<uuid>.jpg`
// (TicketPhotoUpload) ; les policies Storage (migration 056) n'autorisent
// que le préfixe de la commune de l'utilisateur. Le serveur, qui écrit
// `ticket_photos` en service role, revérifie que chaque chemin reçu
// appartient bien à la commune du signalement : sans ce contrôle, un
// chemin forgé ferait signer par le serveur une photo d'une autre commune.

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const NOM_PHOTO = new RegExp(`^${UUID}\\.(jpg|jpeg|png|webp|heic)$`, "i");

/** Vrai si `chemin` est une photo déposée sous le dossier de `communeId`. */
export function cheminPhotoValide(chemin: unknown, communeId: string | null | undefined): boolean {
  if (typeof chemin !== "string" || !communeId) return false;
  const morceaux = chemin.split("/");
  if (morceaux.length !== 2) return false;
  const [dossier, nom] = morceaux;
  return dossier.toLowerCase() === communeId.toLowerCase() && NOM_PHOTO.test(nom);
}

/** Lève une erreur si un chemin n'appartient pas à la commune du signalement. */
export function verifierCheminsPhotos(chemins: string[] | undefined, communeId: string | null | undefined): string[] {
  const liste = chemins ?? [];
  for (const chemin of liste) {
    if (!cheminPhotoValide(chemin, communeId)) {
      throw new Error("Photo invalide : elle n'appartient pas à la commune du signalement");
    }
  }
  return liste;
}
