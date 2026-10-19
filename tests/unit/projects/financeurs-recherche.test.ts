import { describe, it, expect } from "vitest";
import { filtrerResultats, normaliserAide, normaliserMotsCles } from "@/lib/aides/aides";

const aide = (id: number, extra: Record<string, unknown> = {}) => normaliserAide({ id, name: `Aide ${id}`, slug: `aide-${id}`, url: `/aides/aide-${id}/`, ...extra })!;

describe("recherche de financements par mots-clés", () => {
  it("nettoie les mots-clés et refuse une saisie trop courte", () => {
    expect(normaliserMotsCles("  cour   d'école \n")).toBe("cour d'école");
    expect(normaliserMotsCles("a")).toBeNull();
    expect(normaliserMotsCles(42)).toBeNull();
    expect(normaliserMotsCles("x".repeat(300))?.length).toBe(100);
  });
  it("écarte les aides closes et les doublons, garde l'ordre de pertinence de l'API", () => {
    const r = filtrerResultats([
      aide(1, { submission_deadline: "2026-01-01" }),
      aide(2),
      aide(3, { submission_deadline: "2027-03-31" }),
      aide(2),
    ], "2026-10-19");
    expect(r.map((a) => a.aide_id)).toEqual(["2", "3"]);
  });
  it("rend les liens absolus et limite le nombre de résultats", () => {
    const r = filtrerResultats(Array.from({ length: 40 }, (_, i) => aide(i + 1)), "2026-10-19");
    expect(r).toHaveLength(30);
    expect(r[0].url).toBe("https://aides-territoires.beta.gouv.fr/aides/aide-1/");
  });
});
