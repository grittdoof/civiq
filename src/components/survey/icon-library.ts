/**
 * Bibliothèque d'icônes Lucide curées pour les étapes de sondage.
 *
 * Source de vérité partagée entre :
 *  - le SurveyRenderer (rendu public des intros de section)
 *  - le SurveyBuilder (IconPicker du backoffice)
 *
 * Pour ajouter une icône : l'importer depuis lucide-react,
 * puis l'ajouter au tableau ICON_LIBRARY avec un label FR et des tags
 * pour la recherche.
 */

import {
  // Famille
  Home,
  Users,
  User,
  UserPlus,
  Baby,
  Heart,
  HeartHandshake,
  HandHeart,
  // Éducation
  BookOpen,
  Book,
  GraduationCap,
  School,
  Library,
  Pencil,
  // Repas
  UtensilsCrossed,
  Utensils,
  Coffee,
  Apple,
  Sandwich,
  // Temps
  Clock,
  CalendarDays,
  Calendar,
  CalendarCheck,
  Timer,
  // Soleil / saison
  Sun,
  Moon,
  // Vacances / loisirs
  TreePalm,
  Tent,
  Mountain,
  Music,
  Camera,
  Gamepad2,
  Trophy,
  PartyPopper,
  Palette,
  // Santé
  Stethoscope,
  HeartPulse,
  Pill,
  Hospital,
  // Transport
  Bus,
  Bike,
  Car,
  Train,
  Plane,
  Footprints,
  MapPin,
  Map,
  Compass,
  // Travail / commerce
  Briefcase,
  Building2,
  Building,
  Store,
  Factory,
  // Engagement / civique
  Handshake,
  Vote,
  Megaphone,
  // Environnement
  Trees,
  Leaf,
  Flower,
  Globe,
  Recycle,
  Sprout,
  // Communication
  MessageSquare,
  MessageCircle,
  Mail,
  Phone,
  // Idées / projets
  Lightbulb,
  Sparkles,
  Star,
  Target,
  Flag,
  Rocket,
  // Activité / sport
  Activity,
  // Sécurité
  Shield,
  Lock,
  // Documents
  ClipboardList,
  ClipboardCheck,
  FileText,
  Bookmark,
  type LucideIcon,
} from "lucide-react";

export interface IconEntry {
  name: string;
  label: string;
  tags: string[];
  component: LucideIcon;
}

export const ICON_LIBRARY: IconEntry[] = [
  // ── Famille / personnes ──
  { name: "Home", label: "Foyer", tags: ["foyer", "maison", "domicile", "famille"], component: Home },
  { name: "Users", label: "Groupe", tags: ["personnes", "famille", "groupe", "équipe"], component: Users },
  { name: "User", label: "Personne", tags: ["personne", "individu"], component: User },
  { name: "UserPlus", label: "Nouvel arrivant", tags: ["inscription", "nouveau"], component: UserPlus },
  { name: "Baby", label: "Bébé", tags: ["bébé", "petit", "crèche", "nourrisson"], component: Baby },
  { name: "Heart", label: "Cœur", tags: ["amour", "favori"], component: Heart },
  { name: "HeartHandshake", label: "Solidarité", tags: ["bénévole", "solidarité", "aide"], component: HeartHandshake },
  { name: "HandHeart", label: "Don", tags: ["don", "soutien", "solidaire"], component: HandHeart },

  // ── Éducation ──
  { name: "BookOpen", label: "Livre ouvert", tags: ["livre", "lecture", "éducation"], component: BookOpen },
  { name: "Book", label: "Livre", tags: ["livre", "bibliothèque"], component: Book },
  { name: "GraduationCap", label: "Diplôme", tags: ["école", "diplôme", "collège", "lycée"], component: GraduationCap },
  { name: "School", label: "École", tags: ["école", "scolaire", "primaire"], component: School },
  { name: "Library", label: "Bibliothèque", tags: ["bibliothèque", "médiathèque"], component: Library },
  { name: "Pencil", label: "Crayon", tags: ["devoir", "écrire"], component: Pencil },

  // ── Repas ──
  { name: "UtensilsCrossed", label: "Couverts croisés", tags: ["cantine", "repas", "restaurant"], component: UtensilsCrossed },
  { name: "Utensils", label: "Couverts", tags: ["repas", "table"], component: Utensils },
  { name: "Coffee", label: "Café", tags: ["café", "pause"], component: Coffee },
  { name: "Apple", label: "Pomme", tags: ["fruit", "alimentation"], component: Apple },
  { name: "Sandwich", label: "Sandwich", tags: ["goûter", "snack"], component: Sandwich },

  // ── Temps ──
  { name: "Clock", label: "Horloge", tags: ["temps", "durée", "horaire"], component: Clock },
  { name: "CalendarDays", label: "Calendrier", tags: ["agenda", "date", "mercredi", "planning"], component: CalendarDays },
  { name: "Calendar", label: "Calendrier simple", tags: ["agenda", "date"], component: Calendar },
  { name: "CalendarCheck", label: "Inscription", tags: ["valider", "inscrire", "confirmé"], component: CalendarCheck },
  { name: "Timer", label: "Chronomètre", tags: ["minuteur", "durée"], component: Timer },

  // ── Saisons / météo ──
  { name: "Sun", label: "Soleil", tags: ["été", "soleil", "extérieur"], component: Sun },
  { name: "Moon", label: "Lune", tags: ["nuit", "soir"], component: Moon },

  // ── Vacances / loisirs ──
  { name: "TreePalm", label: "Palmier", tags: ["vacances", "été", "plage"], component: TreePalm },
  { name: "Tent", label: "Tente", tags: ["camping", "vacances", "centre de loisirs"], component: Tent },
  { name: "Mountain", label: "Montagne", tags: ["nature", "rando"], component: Mountain },
  { name: "Music", label: "Musique", tags: ["concert", "activité"], component: Music },
  { name: "Camera", label: "Photo", tags: ["photo", "souvenir"], component: Camera },
  { name: "Gamepad2", label: "Jeu vidéo", tags: ["jeu", "loisir", "ado"], component: Gamepad2 },
  { name: "Trophy", label: "Trophée", tags: ["sport", "compétition", "récompense"], component: Trophy },
  { name: "PartyPopper", label: "Fête", tags: ["fête", "anniversaire", "événement"], component: PartyPopper },
  { name: "Palette", label: "Palette", tags: ["art", "atelier", "création"], component: Palette },

  // ── Santé ──
  { name: "Stethoscope", label: "Stéthoscope", tags: ["santé", "médecin"], component: Stethoscope },
  { name: "HeartPulse", label: "Pouls", tags: ["santé", "urgence", "cardio"], component: HeartPulse },
  { name: "Pill", label: "Pilule", tags: ["pharmacie", "médicament"], component: Pill },
  { name: "Hospital", label: "Hôpital", tags: ["santé", "hôpital", "soins"], component: Hospital },

  // ── Transport ──
  { name: "Bus", label: "Bus", tags: ["transport", "scolaire", "ligne"], component: Bus },
  { name: "Bike", label: "Vélo", tags: ["vélo", "mobilité", "cycliste"], component: Bike },
  { name: "Car", label: "Voiture", tags: ["voiture", "parking"], component: Car },
  { name: "Train", label: "Train", tags: ["train", "gare"], component: Train },
  { name: "Plane", label: "Avion", tags: ["voyage", "aérien"], component: Plane },
  { name: "Footprints", label: "Marche", tags: ["pieds", "marche", "piéton"], component: Footprints },
  { name: "MapPin", label: "Localisation", tags: ["adresse", "lieu", "quartier"], component: MapPin },
  { name: "Map", label: "Carte", tags: ["carte", "plan"], component: Map },
  { name: "Compass", label: "Boussole", tags: ["orientation", "découverte"], component: Compass },

  // ── Travail / commerce ──
  { name: "Briefcase", label: "Sacoche", tags: ["travail", "emploi", "professionnel"], component: Briefcase },
  { name: "Building2", label: "Immeuble", tags: ["mairie", "commune", "bâtiment"], component: Building2 },
  { name: "Building", label: "Bâtiment", tags: ["bâtiment", "équipement"], component: Building },
  { name: "Store", label: "Commerce", tags: ["commerce", "magasin", "boutique"], component: Store },
  { name: "Factory", label: "Usine", tags: ["industrie", "économie"], component: Factory },

  // ── Engagement / civique ──
  { name: "Handshake", label: "Poignée de main", tags: ["accord", "partenariat", "engagement"], component: Handshake },
  { name: "Vote", label: "Vote", tags: ["élection", "scrutin", "démocratie"], component: Vote },
  { name: "Megaphone", label: "Mégaphone", tags: ["annonce", "communication", "voix"], component: Megaphone },

  // ── Environnement ──
  { name: "Trees", label: "Arbres", tags: ["nature", "parc", "environnement", "forêt"], component: Trees },
  { name: "Leaf", label: "Feuille", tags: ["nature", "écologie"], component: Leaf },
  { name: "Flower", label: "Fleur", tags: ["jardin", "nature", "fleurissement"], component: Flower },
  { name: "Globe", label: "Globe", tags: ["monde", "international"], component: Globe },
  { name: "Recycle", label: "Recyclage", tags: ["déchet", "tri", "écologie"], component: Recycle },
  { name: "Sprout", label: "Pousse", tags: ["jardin", "potager", "croissance"], component: Sprout },

  // ── Communication ──
  { name: "MessageSquare", label: "Bulle carrée", tags: ["message", "commentaire", "retour"], component: MessageSquare },
  { name: "MessageCircle", label: "Bulle ronde", tags: ["chat", "discussion"], component: MessageCircle },
  { name: "Mail", label: "Mail", tags: ["email", "courrier"], component: Mail },
  { name: "Phone", label: "Téléphone", tags: ["appel", "contact"], component: Phone },

  // ── Idées / projets ──
  { name: "Lightbulb", label: "Ampoule", tags: ["idée", "proposition", "innovation"], component: Lightbulb },
  { name: "Sparkles", label: "Étincelles", tags: ["nouveau", "nouveauté"], component: Sparkles },
  { name: "Star", label: "Étoile", tags: ["favori", "qualité"], component: Star },
  { name: "Target", label: "Cible", tags: ["objectif", "but"], component: Target },
  { name: "Flag", label: "Drapeau", tags: ["étape", "objectif"], component: Flag },
  { name: "Rocket", label: "Fusée", tags: ["lancement", "innovation", "projet"], component: Rocket },

  // ── Activité ──
  { name: "Activity", label: "Activité", tags: ["sport", "mouvement"], component: Activity },

  // ── Sécurité ──
  { name: "Shield", label: "Bouclier", tags: ["sécurité", "protection"], component: Shield },
  { name: "Lock", label: "Cadenas", tags: ["sécurité", "rgpd", "privé"], component: Lock },

  // ── Documents ──
  { name: "ClipboardList", label: "Liste", tags: ["sondage", "questionnaire", "liste"], component: ClipboardList },
  { name: "ClipboardCheck", label: "Validé", tags: ["validé", "terminé"], component: ClipboardCheck },
  { name: "FileText", label: "Document", tags: ["document", "pdf", "fichier"], component: FileText },
  { name: "Bookmark", label: "Marque-page", tags: ["favori", "enregistrer"], component: Bookmark },
];

// Lookup direct par nom
export const ICON_BY_NAME: Record<string, LucideIcon> = Object.fromEntries(
  ICON_LIBRARY.map((i) => [i.name, i.component])
);

// Mapping emoji historique → nom d'icône Lucide
// Permet la rétro-compat avec les schemas qui stockent encore des emojis.
export const EMOJI_TO_ICON_NAME: Record<string, string> = {
  "🏠": "Home",
  "🏡": "Home",
  "🏘️": "Home",
  "👥": "Users",
  "👨‍👩‍👧": "Users",
  "🍽️": "UtensilsCrossed",
  "🍴": "UtensilsCrossed",
  "🥗": "UtensilsCrossed",
  "📅": "CalendarDays",
  "🗓️": "CalendarDays",
  "🌴": "TreePalm",
  "🏖️": "TreePalm",
  "☀️": "Sun",
  "🌞": "Sun",
  "🌙": "Moon",
  "📚": "BookOpen",
  "📖": "BookOpen",
  "📝": "ClipboardList",
  "🎓": "GraduationCap",
  "🤝": "Handshake",
  "❤️": "Heart",
  "💬": "MessageSquare",
  "💭": "MessageCircle",
  "🗣️": "Megaphone",
  "💼": "Briefcase",
  "🗳️": "Vote",
  "🏛️": "Building2",
  "📍": "MapPin",
  "🚴": "Bike",
  "🚌": "Bus",
  "🌳": "Trees",
  "🌱": "Sprout",
  "✨": "Sparkles",
  "💡": "Lightbulb",
  "🎯": "Target",
  "🏆": "Trophy",
  "🎨": "Palette",
  "🎵": "Music",
  "📸": "Camera",
  "🎮": "Gamepad2",
  "⛺": "Tent",
  "⛰️": "Mountain",
  "🚆": "Train",
  "✈️": "Plane",
  "🚗": "Car",
};
