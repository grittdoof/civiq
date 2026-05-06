import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Démonstration — Besoins périscolaires | GoCiviq",
  description:
    "Découvrez GoCiviq avec ce sondage de démonstration sur les besoins périscolaires d'une commune fictive.",
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
