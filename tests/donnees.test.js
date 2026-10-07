// Cohérence du contenu du jeu : chaque référence (sort, monstre, combat, objet, image…) doit exister.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUTIN_ZONES,
  CLASSES,
  COMBATS,
  DOFUS,
  EQUIPEMENTS,
  MONDES,
  MONSTRES,
  RELIQUES,
  SORTS,
  SUCCES,
  ZONES,
} from "../src/data/index.js";

const PUBLIC = join(import.meta.dirname, "..", "public");
const image = (chemin) => existsSync(join(PUBLIC, chemin));
const RARETES = ["commun", "rare", "epique", "legendaire"];
const SLOTS = ["arme", "coiffe", "cape", "anneau"];

describe("contenu du jeu", () => {
  it("classes : sorts connus, portraits et icônes de sorts présents", () => {
    for (const [id, c] of Object.entries(CLASSES)) {
      expect(image(c.img), `portrait ${id}`).toBe(true);
      for (const s of c.sorts) {
        expect(SORTS[s], `${id} → sort ${s}`).toBeDefined();
        expect(image(`/assets/spells/${id}/${s}.png`), `icône ${id}/${s}`).toBe(true);
      }
    }
  });

  it("monstres : sorts connus et images présentes", () => {
    for (const [id, m] of Object.entries(MONSTRES)) {
      expect(m.img && image(m.img), `image ${id}`).toBe(true);
      for (const s of m.sorts ?? []) expect(SORTS[s], `${id} → sort ${s}`).toBeDefined();
    }
  });

  it("combats : monstres connus, positions valides et uniques", () => {
    for (const [id, c] of Object.entries(COMBATS)) {
      const positions = c.ennemis.map((x) => x.position);
      expect(new Set(positions).size, `${id} positions dupliquées`).toBe(positions.length);
      for (const x of c.ennemis) {
        expect(MONSTRES[x.monstre], `${id} → ${x.monstre}`).toBeDefined();
        expect(x.position >= 0 && x.position <= 7, `${id} position ${x.position}`).toBe(true);
      }
    }
  });

  it("zones : chaque zone des mondes a des combats normaux, élites et boss existants", () => {
    for (const monde of MONDES) {
      for (const zoneId of monde.zones) {
        const zone = ZONES.find((z) => z.id === zoneId);
        expect(zone, `zone ${zoneId}`).toBeDefined();
        for (const k of ["normales", "elite", "boss"]) {
          expect(zone.pools?.[k]?.length, `${zoneId}.${k}`).toBeGreaterThan(0);
          for (const c of zone.pools[k]) expect(COMBATS[c], `${zoneId} → ${c}`).toBeDefined();
        }
      }
    }
  });

  it("équipements : slot, raretés, image ; butin des zones existant", () => {
    for (const [id, o] of Object.entries(EQUIPEMENTS)) {
      expect(SLOTS, `slot ${id}`).toContain(o.slot);
      expect(Object.keys(o.tiers ?? {}).length, `paliers ${id}`).toBeGreaterThan(0);
      for (const r of Object.keys(o.tiers)) expect(RARETES, `${id} rareté ${r}`).toContain(r);
      expect(image(`/assets/items/${id}.png`), `image ${id}`).toBe(true);
    }
    for (const [k, b] of Object.entries(BUTIN_ZONES))
      for (const t of ["normales", "elites", "boss"])
        for (const it of b[t] ?? [])
          expect(EQUIPEMENTS[it], `butin ${k}.${t} → ${it}`).toBeDefined();
  });

  it("reliques et Dofus : boss existants et images présentes", () => {
    for (const id of Object.keys(RELIQUES)) {
      expect(MONSTRES[id]?.boss, `relique ${id} sans boss`).toBeTruthy();
      expect(image(`/assets/reliques/${id}.png`), `image relique ${id}`).toBe(true);
    }
    for (const d of Object.values(DOFUS)) expect(image(d.img), `image ${d.id}`).toBe(true);
  });

  it("sorts : jets cohérents, invocations connues", () => {
    for (const [id, s] of Object.entries(SORTS)) {
      if (s.baseMin !== undefined)
        expect(s.baseMin, `${id} baseMin > baseMax`).toBeLessThanOrEqual(s.baseMax);
      for (const m of s.invoqueMonstre?.pool ?? [])
        expect(MONSTRES[m], `${id} → ${m}`).toBeDefined();
    }
  });

  it("succès : identifiants uniques et références valides", () => {
    const ids = new Set();
    for (const succes of Object.values(SUCCES)) {
      for (const q of succes.quetes) {
        expect(ids.has(q.id), `quête dupliquée ${q.id}`).toBe(false);
        ids.add(q.id);
        const c = q.critere;
        if (c.espece) expect(MONSTRES[c.espece], `${q.id} espèce`).toBeDefined();
        if (c.boss) expect(MONSTRES[c.boss], `${q.id} boss`).toBeDefined();
        if (c.combat) expect(COMBATS[c.combat], `${q.id} combat`).toBeDefined();
        if (c.objet) expect(EQUIPEMENTS[c.objet], `${q.id} objet`).toBeDefined();
        if (c.classe) expect(CLASSES[c.classe], `${q.id} classe`).toBeDefined();
        if (c.zone)
          expect(
            ZONES.find((z) => z.id === c.zone),
            `${q.id} zone`,
          ).toBeDefined();
      }
      if (succes.categorie?.dofus)
        expect(DOFUS[succes.categorie.dofus], `dofus ${succes.categorie.dofus}`).toBeDefined();
    }
  });
});
