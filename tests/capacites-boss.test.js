// Capacités spéciales des boss de donjon (1.9.0) : données, chaque sorte dans le moteur, lisibilité.
import { describe, expect, it } from "vitest";
import { CAPACITES_BOSS, COMBATS, MONDES, MONSTRES, ZONES } from "../src/data/index.js";
import {
  declencherCapaciteBoss,
  seuilInterruption,
  tourDeCapacite,
} from "../src/combat/capacites.js";
import { executerCombat } from "../src/combat/moteur.js";
import { choisirActionIA } from "../src/combat/ia.js";
import { enLigneAvant } from "../src/combat/stats.js";
import {
  appliquerPuissanceZone,
  combattantsEquipe,
  creerMonstre,
  monstresDuCombat,
  nouvelleRun,
} from "../src/jeu/run.js";
import { rngGraine } from "../src/jeu/runDuJour.js";
import { badgesContenu } from "../src/ui/capacitesBoss.js";

const TYPES = [`invocation`, `bouclier`, `bourrasque`, `telegraphe`];
const journal = () => {
  const lignes = [];
  return { lignes, log: (msg) => lignes.push(msg) };
};
const ctx = (cs, rng = () => 0.5) => ({
  rng,
  ...journal(),
  playerDamageBonus: 1,
  enemyDamageBonus: 1,
  combatants: cs,
});
function combatBoss(bossId, classes = [`iop`, `cra`, `eniripsa`]) {
  const run = nouvelleRun(classes, 0, `t1`);
  const heros = combattantsEquipe(run);
  const boss = creerMonstre(MONSTRES[bossId], `e0_${bossId}`, 0);
  const cs = [...heros, boss];
  return { cs, heros, boss, contexte: ctx(cs) };
}
const bossDesZones = () =>
  MONDES.flatMap((monde) => monde.zones)
    .map((id) => ZONES.find((zone) => zone.id === id))
    .flatMap((zone) => zone.pools.boss)
    .flatMap((combatId) => COMBATS[combatId].ennemis.map((e) => e.monstre))
    .filter((id) => MONSTRES[id]?.boss);

describe(`capacités de boss : données`, () => {
  it(`chaque boss de donjon des cinq mondes a une capacité connue, nommée et décrite`, () => {
    const boss = [...new Set(bossDesZones())];
    expect(boss.length).toBeGreaterThan(80);
    const parType = {};
    for (const id of boss) {
      const cap = CAPACITES_BOSS[id];
      expect(cap, id).toBeDefined();
      expect(TYPES).toContain(cap.type);
      expect(cap.nom.length, id).toBeGreaterThan(3);
      expect(cap.desc.length, id).toBeGreaterThan(30);
      expect(cap.tous).toBeGreaterThanOrEqual(3);
      expect(cap.debut).toBeGreaterThanOrEqual(2);
      parType[cap.type] = (parType[cap.type] ?? 0) + 1;
      if (cap.type === `telegraphe`) {
        expect(cap.baseMin).toBeLessThanOrEqual(cap.baseMax);
        expect([`equipe`, `avant`, `arriere`]).toContain(cap.cible);
        expect(cap.interruption).toBeGreaterThan(0);
      }
      if (cap.type === `invocation`) {
        expect(cap.pool.length).toBeGreaterThan(0);
        for (const m of cap.pool) expect(MONSTRES[m], `${id} → ${m}`).toBeDefined();
      }
    }
    // les quatre sortes sont représentées
    for (const type of TYPES) expect(parType[type], type).toBeGreaterThan(5);
    // chaque monde a au moins une capacité de chaque sorte… ou presque : au moins trois sortes
    for (const monde of MONDES) {
      const types = new Set(
        monde.zones
          .flatMap((z) => ZONES.find((zone) => zone.id === z).pools.boss)
          .flatMap((c) => COMBATS[c].ennemis.map((e) => CAPACITES_BOSS[e.monstre]?.type))
          .filter(Boolean),
      );
      expect(types.size, monde.id).toBeGreaterThanOrEqual(3);
    }
  });
  it(`un monstre ordinaire n'a pas de capacité, un boss la reçoit à sa création (copie)`, () => {
    const boss = creerMonstre(MONSTRES.kardorim, `e0`, 0);
    expect(boss.capacite.nom).toBe(CAPACITES_BOSS.kardorim.nom);
    boss.capacite.nom = `modifié`;
    expect(CAPACITES_BOSS.kardorim.nom).not.toBe(`modifié`);
    expect(creerMonstre(MONSTRES.chafer_debutant, `e1`, 1).capacite).toBeUndefined();
  });
  it(`rythme : tous les « tous » tours à partir de « debut »`, () => {
    const cap = { tous: 3, debut: 2 };
    expect([1, 2, 3, 4, 5, 6, 7, 8].filter((t) => tourDeCapacite(cap, t))).toEqual([2, 5, 8]);
  });
});

describe(`capacités de boss : moteur`, () => {
  it(`frappe télégraphiée : un tour de concentration (aucun sort, badge ⚠️), puis la frappe`, () => {
    const { cs, heros, boss, contexte } = combatBoss(`kardorim`);
    boss.toursJoues = 2;
    expect(declencherCapaciteBoss(boss, cs, contexte).passeTour).toBe(true);
    expect(boss.capaciteEnCharge).toBeTruthy();
    expect(contexte.lignes.at(-1)).toMatch(/⚠️ .*se concentre.*Retire-lui \d+ PV/);
    const badge = badgesContenu(boss)[0];
    expect(badge.classe).toBe(`alerte`);
    expect(badge.texte).toMatch(/⚠️ .* prochain tour/);
    const pv = heros.map((h) => h.pvActuels);
    boss.toursJoues = 3;
    expect(declencherCapaciteBoss(boss, cs, contexte).passeTour).toBe(false);
    expect(boss.capaciteEnCharge).toBeNull();
    // cible « equipe » : chaque héros prend des dégâts
    heros.forEach((h, k) => expect(h.pvActuels).toBeLessThan(pv[k]));
    expect(badgesContenu(boss)[0].classe).toBe(`capacite`);
  });
  it(`frappe télégraphiée : interrompue si le boss perd assez de PV, ou s'il est assommé`, () => {
    const { cs, heros, boss, contexte } = combatBoss(`kardorim`);
    boss.toursJoues = 2;
    declencherCapaciteBoss(boss, cs, contexte);
    boss.pvActuels -= seuilInterruption(boss);
    const pv = heros.map((h) => h.pvActuels);
    boss.toursJoues = 3;
    declencherCapaciteBoss(boss, cs, contexte);
    expect(contexte.lignes.at(-1)).toMatch(/interrompu/);
    heros.forEach((h, k) => expect(h.pvActuels).toBe(pv[k]));
    // assommé
    boss.toursJoues = 5;
    declencherCapaciteBoss(boss, cs, contexte);
    expect(boss.capaciteEnCharge).toBeTruthy();
    boss.toursJoues = 6;
    declencherCapaciteBoss(boss, cs, contexte, { assomme: true });
    expect(contexte.lignes.at(-1)).toMatch(/assommé/);
    heros.forEach((h, k) => expect(h.pvActuels).toBe(pv[k]));
  });
  it(`frappe sur une ligne : seule cette ligne est touchée (l'autre si elle est vide)`, () => {
    const { cs, heros, boss, contexte } = combatBoss(`kankreblath`);
    expect(boss.capacite.cible).toBe(`avant`);
    const devant = heros.filter(enLigneAvant);
    const derriere = heros.filter((h) => !enLigneAvant(h));
    expect(devant.length && derriere.length).toBeTruthy();
    const pvDerriere = derriere.map((h) => h.pvActuels);
    boss.toursJoues = 2;
    declencherCapaciteBoss(boss, cs, contexte);
    boss.toursJoues = 3;
    declencherCapaciteBoss(boss, cs, contexte);
    derriere.forEach((h, k) => expect(h.pvActuels).toBe(pvDerriere[k]));
    expect(devant.some((h) => h.pvActuels < h.pvMax)).toBe(true);
  });
  it(`renforts : un monstre de la zone à la puissance du boss, 2 au plus, coût en PA`, () => {
    const { cs, boss, contexte } = combatBoss(`bouftou_royal`);
    appliquerPuissanceZone([boss], `tainela`, `donjon`);
    const pa = boss.paActuels;
    boss.toursJoues = 2;
    declencherCapaciteBoss(boss, cs, contexte);
    const renfort = cs.find((c) => c.invoquePar === boss.ref);
    expect(renfort).toBeDefined();
    expect(boss.capacite.pool).toContain(renfort.monstreId);
    expect(renfort.camp).toBe(`ennemi`);
    expect(boss.paActuels).toBe(pa - boss.capacite.pa);
    const facteur = boss.pvBase / MONSTRES.bouftou_royal.pv;
    expect(renfort.pvMax).toBe(
      Math.round(MONSTRES[renfort.monstreId].pv * facteur * boss.capacite.puissance),
    );
    for (const tour of [5, 8, 11]) {
      boss.toursJoues = tour;
      declencherCapaciteBoss(boss, cs, contexte);
    }
    expect(cs.filter((c) => c.invoquePar === boss.ref && c.pvActuels > 0).length).toBe(2);
    const positions = cs.filter((c) => c.camp === `ennemi`).map((c) => c.position);
    expect(new Set(positions).size).toBe(positions.length);
  });
  it(`bouclier de zone : tout le camp du boss gagne un bouclier temporaire`, () => {
    const { cs, boss, contexte } = combatBoss(`directeur_grunob`);
    const sbire = creerMonstre(MONSTRES.gobaladee, `e1_gob`, 1);
    cs.push(sbire);
    boss.toursJoues = 2;
    declencherCapaciteBoss(boss, cs, contexte);
    for (const m of [boss, sbire]) {
      expect(m.bouclier).toBe(Math.round(m.pvMax * boss.capacite.pct));
      expect(m.boucliersTemporaires[0].tours).toBe(boss.capacite.tours);
    }
  });
  it(`bourrasque : les héros échangent leurs lignes, sans case en double`, () => {
    const { cs, heros, boss, contexte } = combatBoss(`batofu`);
    const avant = heros.map((h) => enLigneAvant(h));
    boss.toursJoues = 2;
    declencherCapaciteBoss(boss, cs, contexte);
    heros.forEach((h, k) => expect(enLigneAvant(h)).toBe(!avant[k]));
    const positions = heros.map((h) => h.position);
    expect(new Set(positions).size).toBe(positions.length);
    expect(positions.every((p) => p >= 0 && p <= 7)).toBe(true);
  });
  it(`les combats de boss de chaque zone se jouent jusqu'au bout sans erreur`, async () => {
    let capacitesJouees = 0;
    for (const monde of MONDES) {
      for (const zoneId of monde.zones) {
        const zone = ZONES.find((z) => z.id === zoneId);
        for (const combatId of zone.pools.boss) {
          const run = nouvelleRun([`iop`, `eniripsa`, `feca`], 0, monde.id);
          for (const p of run.persos) p.progression.niveau = monde.niveaux[1];
          const monstres = monstresDuCombat(combatId);
          appliquerPuissanceZone(monstres, zoneId, `donjon`);
          const cs = [...combattantsEquipe(run), ...monstres];
          const lignes = [];
          await executerCombat(cs, {
            rng: rngGraine(combatId.length),
            log: (m) => lignes.push(m),
            controllers: { joueur: choisirActionIA, ennemi: choisirActionIA },
          });
          capacitesJouees += lignes.filter((l) => /se concentre sur| — /.test(l)).length;
          for (const c of cs) {
            expect(Number.isFinite(c.pvActuels), combatId).toBe(true);
            expect(c.pvActuels).toBeGreaterThanOrEqual(0);
          }
          // les renforts disparaissent avec leur boss
          for (const r of cs.filter((c) => c.renfortBoss)) {
            const chef = cs.find((c) => c.ref === r.invoquePar);
            if (chef.pvActuels <= 0) expect(r.pvActuels, combatId).toBe(0);
          }
        }
      }
    }
    expect(capacitesJouees).toBeGreaterThan(40);
  }, 60000);
});

describe(`combats durs : deux compositions par zone`, () => {
  it(`le second combat dur reprend des monstres de la zone, à une menace proche du premier`, () => {
    const menace = (ids) =>
      ids.reduce((s, id) => s + MONSTRES[id].pv, 0) *
      ids.reduce(
        (s, id) =>
          s +
          1 +
          0.03 *
            Math.max(
              ...[`force`, `intelligence`, `agilite`, `chance`].map(
                (k) => MONSTRES[id].stats?.[k] ?? 0,
              ),
            ),
        0,
      );
    for (const monde of MONDES) {
      for (const zoneId of monde.zones) {
        const pools = ZONES.find((z) => z.id === zoneId).pools;
        expect(pools.elite.length, zoneId).toBe(2);
        const [premier, second] = pools.elite.map((id) => COMBATS[id]);
        expect(second.nom).toMatch(/\(dur\)$/);
        const especes = new Set(
          [...pools.normales, pools.elite[0]].flatMap((id) =>
            COMBATS[id].ennemis.map((e) => e.monstre),
          ),
        );
        for (const e of second.ennemis)
          expect(especes.has(e.monstre), `${zoneId} ${e.monstre}`).toBe(true);
        const ratio =
          menace(second.ennemis.map((e) => e.monstre)) /
          menace(premier.ennemis.map((e) => e.monstre));
        expect(Math.abs(ratio - 1), zoneId).toBeLessThan(0.1);
      }
    }
  });
});
