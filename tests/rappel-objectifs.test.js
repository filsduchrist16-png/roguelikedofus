// Carte : rappel discret de l'Almanax du jour et des quêtes du prochain Dofus (1.9.0).
import { describe, expect, it } from "vitest";
import { htmlRappelObjectifs, estPastilleAlmanax } from "../src/ui/ecrans/carte.js";
import { quetesARappeler } from "../src/ui/prochainDofus.js";
import { dateDuJour } from "../src/jeu/runDuJour.js";
import { ZONES, MONDES } from "../src/data/index.js";

const metaVierge = () => ({ dofus: [], archis: [], quetes: { faites: [], compteurs: {} } });
const zoneDuMonde = (mondeId) =>
  ZONES.find((zone) => MONDES.find((monde) => monde.id === mondeId).zones.includes(zone.id)).nom;

describe(`rappel des objectifs sur la carte`, () => {
  it(`montre la quête de l'Almanax et celles du prochain Dofus`, () => {
    const html = htmlRappelObjectifs(metaVierge(), zoneDuMonde(`t1`));
    expect(html).toContain(`📅`);
    expect(html).toContain(`0/`);
    expect(html).toContain(`🥚`);
  });
  it(`Almanax déjà fait aujourd'hui : plus de rappel 📅`, () => {
    const meta = { ...metaVierge(), almanax: { date: dateDuJour(), progres: 99, fait: true } };
    expect(htmlRappelObjectifs(meta, zoneDuMonde(`t1`))).not.toContain(`📅`);
  });
  it(`le Dofus rappelé est d'abord celui du monde joué, deux quêtes au plus`, () => {
    const rappel = quetesARappeler(metaVierge(), `t1`);
    expect(rappel.quetes.length).toBeGreaterThan(0);
    expect(rappel.quetes.length).toBeLessThanOrEqual(2);
  });
  it(`reconnaît la pastille Almanax des effets en cours`, () => {
    expect(estPastilleAlmanax({ icone: `📅`, nom: `Almanax 1/3` })).toBe(true);
    expect(estPastilleAlmanax({ icone: `🍀`, nom: `Trèfle` })).toBe(false);
  });
});
