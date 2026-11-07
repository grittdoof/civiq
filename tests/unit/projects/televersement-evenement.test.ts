import { describe, expect, it, vi } from "vitest";
import { ordrePourDate } from "@/lib/projects/etapes";
import { extensionDe, verifierDepot } from "@/lib/storage/depot-direct";
import { lireReponse } from "@/lib/storage/televerser";

const e = (ordre: number | null, date: string | null) => ({
  statut: "a_faire" as const, date_previsionnelle: date, fait: false, echeance: null, ordre,
});

describe("ordrePourDate (rétroplanning)", () => {
  const list = [e(10, "2026-11-01T00:00:00.000Z"), e(20, "2026-11-10T00:00:00.000Z"), e(30, "2026-11-20T00:00:00.000Z")];
  it("range la nouvelle étape avant la première prévue plus tard", () => {
    expect(ordrePourDate(list, "2026-11-05T00:00:00.000Z")).toBe(15);
    expect(ordrePourDate(list, "2026-10-01T00:00:00.000Z")).toBe(5);
  });
  it("en fin de liste sans date, si elle est la plus tardive, ou sans place libre", () => {
    expect(ordrePourDate(list, null)).toBeUndefined();
    expect(ordrePourDate(list, "2026-12-01T00:00:00.000Z")).toBeUndefined();
    expect(ordrePourDate([e(10, "2026-11-01T00:00:00.000Z"), e(11, "2026-11-10T00:00:00.000Z")], "2026-11-05T00:00:00.000Z")).toBeUndefined();
  });
});

describe("dépôt direct", () => {
  const service = (taille: number | null) => {
    const remove = vi.fn().mockResolvedValue({});
    return {
      remove,
      client: {
        storage: {
          from: () => ({
            info: vi.fn().mockResolvedValue(taille === null ? { data: null, error: { message: "absent" } } : { data: { size: taille }, error: null }),
            remove,
          }),
        },
      } as never,
    };
  };

  it("refuse un chemin hors du préfixe attendu", async () => {
    const { client } = service(10);
    for (const path of ["autre/p/x.pdf", "c/p/../q/x.pdf", "c/p/sous/x.pdf", 42]) {
      const r = await verifierDepot(client, "b", path, "c/p/");
      expect(r.ok).toBe(false);
    }
  });
  it("accepte un fichier présent sous le préfixe", async () => {
    const r = await verifierDepot(service(8_000_000).client, "b", "c/p/a.pdf", "c/p/");
    expect(r).toEqual({ ok: true, path: "c/p/a.pdf", taille: 8_000_000 });
  });
  it("refuse un fichier absent, retire un fichier trop lourd", async () => {
    expect((await verifierDepot(service(null).client, "b", "c/p/a.pdf", "c/p/")).ok).toBe(false);
    const s = service(30 * 1024 * 1024);
    expect((await verifierDepot(s.client, "b", "c/p/a.pdf", "c/p/")).ok).toBe(false);
    expect(s.remove).toHaveBeenCalledWith(["c/p/a.pdf"]);
  });
  it("lit l'extension", () => {
    expect(extensionDe("Devis Final.PDF")).toBe("pdf");
    expect(extensionDe("sans-extension")).toBe("");
  });
  it("transforme la réponse texte de l'hébergeur en message clair", async () => {
    const r = await lireReponse(new Response("Request Entity Too Large", { status: 413 }));
    expect(r.error).toBe("Fichier trop volumineux.");
    const ok = await lireReponse<{ document: { id: string } }>(new Response(JSON.stringify({ document: { id: "1" } })));
    expect(ok.document.id).toBe("1");
  });
});
