// Simulation de runs complètes avec la vraie logique du jeu (carte, XP, butin, tavernes,
// rencontres, HDV), un joueur automatique qui choisit son chemin et s'équipe, et l'IA en combat.
// usage : npm run sim -- t1,t2 [N] [ascension] [sortie.json]
//         npm run sim -- songes [N]   (Songes infinis : étage moyen atteint par le robot)
// (N runs par monde ; l'IA joue les héros en essayant chaque sort sur une copie du combat)
const R = new URL("../../src", import.meta.url).pathname;
const { CLASSES, EQUIPEMENTS, MONDES, ZONES, SORTS, DOFUS, MONSTRES, CAPACITES_BOSS, RENCONTRES } =
  await import(`${R}/data/index.js`);
// comparaisons 1.9.0 (avant le chargement des règles) : SANS_RENCONTRES_LORE=1 retire les
// rencontres du Krosmoz du tirage
if (process.env.SANS_RENCONTRES_LORE)
  for (const id of Object.keys(RENCONTRES)) delete RENCONTRES[id];
// SANS_ELITES_190=1 : un seul combat dur par zone, comme avant la 1.9.0
if (process.env.SANS_ELITES_190) for (const zone of ZONES) zone.pools.elite.splice(1);
const cfg = await import(`${R}/jeu/config.js`);
// SANS_AFFIXES_190=1 : seulement les trois affixes d'élite d'avant la 1.9.0
if (process.env.SANS_AFFIXES_190) cfg.AFFIXES_GROUPE.splice(3);
const run_ = await import(`${R}/jeu/run.js`);
const eco = await import(`${R}/jeu/economie.js`);
const meta_ = await import(`${R}/sauvegarde/meta.js`);
const renc = await import(`${R}/jeu/rencontres.js`);
const { genererCarte, noeudsAtteignables, tirerTypeZaap } = await import(
  `${R}/carte/generation.js`
);
const { executerCombat } = await import(`${R}/combat/moteur.js`);
const { choisirActionIA } = await import(`${R}/combat/ia.js`);
const { alliesVivants, coutPA } = await import(`${R}/combat/stats.js`);
const { mondeDuDofus } = await import(`${R}/jeu/obtention.js`);
const { creerIaPlus } = await import("./iaplus.mjs");
const songes = await import(`${R}/jeu/songes.js`);
const recRun = await import(`${R}/jeu/recompensesRun.js`);
const cases = await import(`${R}/jeu/cases.js`);
const lore = await import(`${R}/jeu/rencontresLore.js`);
// SANS_RECOMPENSES=1 : pas de choix de récompense après les combats (comparaison avec la 1.6.0)
const SANS_RECOMPENSES = !!process.env.SANS_RECOMPENSES;
if (SANS_RECOMPENSES) {
  for (const cle of Object.keys(recRun.CONFIG_RECOMPENSES.compensation))
    recRun.CONFIG_RECOMPENSES.compensation[cle] = { lin: 0, quad: 0 };
}
// réglage : COMP='{"t1":{"lin":0.05,"quad":0.01}}' remplace la compensation d'un monde
if (process.env.COMP)
  Object.assign(recRun.CONFIG_RECOMPENSES.compensation, JSON.parse(process.env.COMP));
const IA_SIMPLE = !!process.env.IA_SIMPLE;
// comparaisons 1.9.0 : SANS_CAPACITES=1 retire les capacités de boss, SANS_SORTS_AVANCES=1 les
// sorts avancés des classes (rien à apprendre)
if (process.env.SANS_CAPACITES)
  for (const id of Object.keys(CAPACITES_BOSS)) delete CAPACITES_BOSS[id];
if (process.env.SANS_SORTS_AVANCES) for (const c of Object.values(CLASSES)) c.sortsAvances = [];

const args = process.argv.slice(2).filter((a) => a !== "--");
const mondes = (args[0] ?? "t1,t2,t3,t4,t5").split(",");
const N = Number(args[1] ?? 20);
const ASC = Number(args[2] ?? 0);
if (process.env.REGEN !== undefined) cfg.RECUPERATION.victoire = Number(process.env.REGEN);
// réglage : EFFETS='{"pvMult":1.3}' remplace des effets de la difficulté simulée
if (process.env.EFFETS) Object.assign(cfg.DIFFICULTES[ASC].effets, JSON.parse(process.env.EFFETS));
const SORTIE = args[3];

function rngSeed(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const classes = run_.classesJouables();

// ---------- score d'un héros équipé (pour s'équiper automatiquement) ----------
function scoreHeros(p) {
  const c = run_.creerCombattantPerso(p);
  const els = CLASSES[p.classeId].elements;
  const st = { terre: "force", feu: "intelligence", air: "agilite", eau: "chance" };
  const elem = els.reduce((a, el) => a + (c.stats[st[el]] ?? 0), 0) / els.length;
  const res = ["terre", "feu", "eau", "air"].reduce((a, el) => a + (c.resistances[el] ?? 0), 0) / 4;
  const degats = (1 + 0.03 * elem) * c.paMax;
  const survie = c.pvMax / (1 - Math.min(0.6, res)) + 5 * (c.stats.soin ?? 0);
  return degats * Math.sqrt(survie);
}
function sEquiper(run) {
  // essaie chaque objet de l'inventaire sur chaque héros, garde les améliorations
  let change = true;
  let tours = 0;
  while (change && tours++ < 30) {
    change = false;
    for (let k = run.inventaire.length - 1; k >= 0; k--) {
      const inst = run.inventaire[k];
      const def = EQUIPEMENTS[inst?.id];
      if (!def) continue;
      let meilleur = null;
      for (const p of run.persos) {
        if (!run_.peutEquiper(p, inst.id)) continue;
        const avant = scoreHeros(p);
        const emp = run_.emplacementCible(p, inst);
        if (!emp) continue;
        const ancien = p.equipement[emp];
        p.equipement[emp] = inst;
        const gain = scoreHeros(p) / avant - 1;
        p.equipement[emp] = ancien;
        if (!ancien) delete p.equipement[emp];
        if (gain > 0.001 && (!meilleur || gain > meilleur.gain)) meilleur = { p, gain };
      }
      if (meilleur) {
        const pvAvant = meilleur.p.pvActuels / run_.pvMaxPerso(meilleur.p);
        run_.equiperObjet(run.inventaire, meilleur.p, k);
        meilleur.p.pvActuels = Math.round(run_.pvMaxPerso(meilleur.p) * pvAvant);
        change = true;
      }
    }
  }
  // revend le reste
  eco.vendreTout(run);
}

// ---------- IA des héros : soigne un allié bas, sinon attaque ----------
function iaHeros(c, cs) {
  const soin = c.sorts
    .map((id) => SORTS[id])
    .find((s) => s?.type === "soin" && c.paActuels >= coutPA(s, c));
  if (soin) {
    const bas = alliesVivants(c, cs)
      .filter((a) => a.pvActuels < a.pvMax * 0.55)
      .sort((a, b) => a.pvActuels / a.pvMax - b.pvActuels / b.pvMax);
    if (bas.length) return { sort: soin, cibleRef: bas[0].ref };
  }
  const a = choisirActionIA(c, cs);
  if (a) return a;
  if (c.armeSort && c.paActuels >= coutPA(c.armeSort, c)) {
    const cibles = cs.filter((x) => x.camp !== c.camp && x.pvActuels > 0);
    if (cibles.length) return null;
  }
  return null;
}

// Dofus d'un joueur arrivé à ce monde : ceux des mondes précédents.
function metaPour(monde) {
  const ordre = MONDES.map((m) => m.id);
  const dofus = Object.keys(DOFUS).filter((id) => {
    const m = mondeDuDofus(id);
    return m && ordre.indexOf(m.id) < ordre.indexOf(monde);
  });
  return {
    dofus: dofus.map((id) => ({ id })),
    archis: [],
    reliques: [],
    quetes: { faites: [], compteurs: {} },
  };
}

const pvFrac = (run) => {
  const vivants = run.persos;
  return (
    vivants.reduce((a, p) => a + Math.max(0, p.pvActuels), 0) /
    vivants.reduce((a, p) => a + run_.pvMaxPerso(p), 0)
  );
};

// songe (facultatif) : étage des Songes infinis { facteur, affixes } au lieu d'une zone
async function combat(run, meta, combatId, type, zone, rng, eliteModifs, songe) {
  const heros = run_.combattantsEquipe(run);
  const mons = run_.monstresDuCombat(combatId);
  if (songe) {
    songes.appliquerSonge(mons, songe.facteur, songe.affixes, rng);
  } else {
    // même ordre que le jeu (deroule/combat.js) : le renfort reçoit aussi la puissance de la zone
    run_.appliquerDifficulteMonstres(mons, run_.effetsDifficulte(run.ascension), {
      type,
      zoneId: zone.id,
      especesZone: run_.especesNormalesZone(zone),
      rng,
    });
    run_.appliquerPuissanceZone(mons, zone.id, type);
    run_.appliquerAffixesCombat(mons, rng, {
      type,
      effets: run_.effetsDifficulte(run.ascension),
      eliteModifs,
      affixePermanent: run_.assurerAffixePermanent(run, rng)?.id,
    });
  }
  const idole = renc.idoleActive(run, zone?.id);
  if (idole?.pvMult)
    for (const m of mons) m.pvBase = m.pvMax = m.pvActuels = Math.round(m.pvMax * idole.pvMult);
  run_.tirerArchis(mons, rng, run_.chanceArchi(run));
  const bonus = renc.bonusEquipeRun(meta, run);
  meta_.appliquerBonusDofus(heros, bonus);
  const c = [...heros, ...mons];
  const ctxIa = {
    playerDamageBonus: bonus.damageMult,
    enemyDamageBonus:
      run_.degatsDifficulte(run_.effetsDifficulte(run.ascension), zone?.id) *
      (idole?.degatsMult ?? 1),
    reliquesActives: meta_.dofusPossedes(meta),
  };
  const iaPlus = creerIaPlus(ctxIa);
  const gagne = await executerCombat(c, {
    rng,
    controllers: {
      joueur: (l, cs) =>
        l.creature
          ? choisirActionIA(l, cs)
          : IA_SIMPLE
            ? iaHeros(l, cs)
            : ((ctxIa.tourDeRef = l.ref), iaPlus(l, cs)),
      ennemi: choisirActionIA,
    },
    playerDamageBonus: bonus.damageMult,
    enemyDamageBonus:
      run_.degatsDifficulte(run_.effetsDifficulte(run.ascension), zone?.id) *
      (idole?.degatsMult ?? 1),
    reliquesActives: meta_.dofusPossedes(meta),
    log: process.env.DEBUG ? (s) => console.log(s) : undefined,
  });
  run_.synchroniserPv(run, c);
  return gagne;
}

const mortDefinitive = (run) => !!run_.effetsDifficulte(run.ascension).mortDefinitive;
// remplace un héros tombé par une recrue (équipée de ses objets, comme en jeu)
function remplacer(run, tombe, classeId) {
  run_.recruter(run, classeId, tombe.classeId);
  const recrue = run.persos.find((p) => p.classeId === classeId);
  recrue.pvActuels = run_.pvMaxPerso(recrue);
  sEquiper(run);
}

// Règle simple du robot : amélioration de sort, sinon nouveau sort, sinon relique de run, sinon
// bonus (repos si l'équipe est blessée, sinon caractéristiques, sinon kamas).
function choisirCarte(run, choix) {
  const par = (test) => choix.findIndex(test);
  for (const test of [
    (c) => c.type === "sort",
    (c) => c.type === "apprendre",
    (c) => c.type === "relique",
    (c) => c.bonus === "soin" && pvFrac(run) < 0.5,
    (c) => c.bonus === "stats",
    (c) => c.bonus === "kamas",
  ]) {
    const i = par(test);
    if (i >= 0) return i;
  }
  return 0;
}
function choisirNoeud(run, options) {
  const pv = pvFrac(run);
  const tombe = mortDefinitive(run) && run.persos.some((p) => p.pvActuels <= 0);
  const note = (n) => {
    switch (n.type) {
      case "taverne":
        return run.persos.length < 4 || tombe ? 9 : pv < 0.6 ? 8 : 1;
      case "rencontre":
        return pv < 0.5 ? 6 : 4;
      case "combat":
        return pv > 0.35 ? 5 : 0;
      case "combat_dur":
        return pv > 0.75 ? 6 : pv > 0.5 ? 2 : -1;
      // camp : soin si l'équipe est blessée, sinon une amélioration de sort gratuite
      case "camp":
        return pv < 0.6 ? 8 : 4;
      // coffre : relique ou objet, au risque d'un piège
      case "coffre":
        return pv > 0.5 ? 5 : 3;
      case "hdv":
        return run.kamas > 250 ? 4 : 2;
      case "zaap":
        return 3;
      default:
        return 2;
    }
  };
  return options.slice().sort((a, b) => note(b) - note(a))[0];
}

async function jouerRun(monde, seed) {
  const rng = rngSeed(seed);
  Math.random = rng;
  const meta = metaPour(monde);
  const depart = [];
  while (depart.length < 2) {
    const c = classes[Math.floor(rng() * classes.length)];
    if (!depart.includes(c)) depart.push(c);
  }
  const run = run_.nouvelleRun(depart, ASC, monde);
  const M = MONDES.find((m) => m.id === monde);
  const journal = {
    monde,
    zone: 0,
    mort: null,
    niveaux: [],
    equipes: [],
    panos: 0,
    objets: [],
  };
  for (let zi = 0; zi < M.zones.length; zi++) {
    const zone = ZONES.find((z) => z.id === M.zones[zi]);
    const num = eco.numeroZone(zone.id);
    run.carte = genererCarte(rng, zone.pools, run_.noeudsExclus(run, zone), {
      premiereZone: zi === 0 && !process.env.SANS_TAVERNE,
    });
    console.log(
      "zone",
      zi + 1,
      "pv",
      pvFrac(run).toFixed(2),
      "amel",
      Object.values(run.ameliorations ?? {}).reduce(
        (a, p) => a + Object.values(p).flat().length,
        0,
      ),
      "rel",
      (run.reliquesRun ?? []).length,
      "appris",
      run.persos.map((p) => (p.sortsAppris ?? []).length).join(""),
      "bonusStats",
      JSON.stringify(run.bonusStats),
      "kamas",
      run.kamas,
    );
    journal.niveaux.push(
      Math.round(run.persos.reduce((a, p) => a + p.progression.niveau, 0) / run.persos.length),
    );
    journal.equipes.push(run.persos.length);
    journal.objets.push(
      run.persos.reduce((a, p) => a + Object.keys(p.equipement).length, 0) / run.persos.length,
    );
    while (true) {
      const opts = noeudsAtteignables(run.carte);
      if (!opts.length) break;
      const n = choisirNoeud(run, opts);
      run.carte.courant = n.id;
      n.visite = true;
      let type = n.type;
      let combatId = n.combatId;
      let xp = n.xp ?? 0;
      if (type === "zaap") {
        type = tirerTypeZaap(rng, run_.noeudsExclus(run, zone));
        if (type === "combat") {
          combatId = zone.pools.normales[Math.floor(rng() * zone.pools.normales.length)];
          xp = cfg.XP_PAR_COMBAT.combat;
        }
        if (type === "combat_dur") {
          combatId = zone.pools.elite[Math.floor(rng() * zone.pools.elite.length)];
          xp = cfg.XP_PAR_COMBAT.combat_dur;
        }
      }
      if (type === "combat" || type === "combat_dur" || type === "donjon") {
        const ok = await combat(run, meta, combatId, type, zone, rng, n.eliteModifs);
        if (!ok) {
          journal.classes = run.persos.map((p) => p.classeId);
          journal.mort = {
            zone: zi + 1,
            type,
            combats: journal.combats,
            classes: run.persos.map((p) => p.classeId).join("+"),
            niv: run.persos[0].progression.niveau,
          };
          if (process.env.VERBOSE) console.log("   mort", JSON.stringify(journal.mort));
          return journal;
        }
        journal.combats = (journal.combats ?? 0) + 1;
        if (type !== "donjon") run_.recupererApresVictoire(run);
        recRun.soinFinCombat(run);
        const idole = renc.idoleActive(run, zone.id);
        if (type !== "donjon") {
          eco.ajouterKamas(
            run,
            Math.round(
              eco.gainKamas(type, num, rng) *
                run_.multiplicateurKamas(run) *
                recRun.multKamasEliteRun(run, type),
            ),
          );
          const gain = Math.round(
            cfg.calculerXpCombat(xp, num, monde) *
              (1 + 0.3 * 0.5) *
              (idole?.xpMult ?? 1) *
              recRun.multXpRun(run),
          );
          for (const p of run.persos) run_.gagnerXpPerso(p, gain, monde);
        } else {
          eco.ajouterKamas(run, eco.gainKamas("donjon", num, rng));
        }
        const prosp = renc.bonusEquipeRun(meta, run).prospection;
        run_.tirerButin(
          run,
          zone.id,
          type,
          rng,
          type === "combat_dur" ? "donjon" : undefined,
          prosp,
        );
        sEquiper(run);
        if (type === "donjon") break;
        if (!SANS_RECOMPENSES) {
          // choix de récompense comme en jeu : amélioration de sort > relique > bonus
          run.offreCombat = recRun.tirerOffreCombat(run, {
            elite: type === "combat_dur",
            numZone: num,
            progression: M.zones.length > 1 ? zi / (M.zones.length - 1) : 0,
            rng,
          });
          recRun.resoudreOffreCombat(run, choisirCarte(run, run.offreCombat.choix));
        }
      } else if (type === "camp") {
        // règle simple : repos sous 60 % de PV, sinon un nouveau sort, sinon la première
        // amélioration proposée
        const { soinPct, ameliorations, apprendre } = cases.optionsCamp(
          run,
          rng,
          M.zones.length > 1 ? zi / (M.zones.length - 1) : 0,
        );
        if (pvFrac(run) < 0.6 || (!ameliorations.length && !apprendre))
          cases.reposCamp(run, soinPct);
        else recRun.appliquerChoix(run, apprendre ?? ameliorations[0]);
      } else if (type === "coffre") {
        // le robot ouvre toujours le coffre
        const { tresor, piege } = cases.contenuCoffre(n.type === "coffre" ? n : null, rng, {
          crocheteur: cases.peutCrocheterCoffre(run),
        });
        let ouvert = true;
        if (piege === "pv") {
          cases.piegePv(run);
          ouvert = false;
        } else if (piege === "combat") {
          const id =
            n.combatId ?? zone.pools.normales[Math.floor(rng() * zone.pools.normales.length)];
          if (!(await combat(run, meta, id, "combat", zone, rng))) {
            journal.mort = { zone: zi + 1, type: "combat", combats: journal.combats };
            return journal;
          }
          run_.recupererApresVictoire(run);
        }
        if (ouvert) {
          const relique =
            tresor === "relique"
              ? cases.reliqueDeCoffre(run, rng, M.zones.length > 1 ? zi / (M.zones.length - 1) : 0)
              : null;
          if (relique) recRun.appliquerChoix(run, relique);
          else {
            const butin = cfg.butinDeZone(zone.id);
            const ids = [...(butin?.normales ?? []), ...(butin?.elites ?? [])];
            const id = ids[Math.floor(rng() * ids.length)];
            const obj =
              id && (run_.tirerObjet(id, rng, ["rare", "epique"]) ?? run_.tirerObjet(id, rng));
            if (obj) {
              run.inventaire.push(obj);
              sEquiper(run);
            }
          }
        }
      } else if (type === "taverne") {
        // relique au comptoir : achetée si la bourse le permet largement
        const vente = cases.reliqueTaverne(run, rng, num);
        if (vente && run.kamas >= vente.prix * 2)
          cases.acheterReliqueRun(run, vente.id, vente.prix);
        const recrues = run_.tirerRecrues(run, rng);
        // mort définitive : un héros tombé ne revient pas, on le remplace comme un joueur le ferait
        const tombe = mortDefinitive(run) && run.persos.find((p) => p.pvActuels <= 0);
        if (run.persos.length < 4 && recrues.length) run_.recruter(run, recrues[0]);
        else if (tombe && recrues.length) remplacer(run, tombe, recrues[0]);
        else
          run_.soignerEquipe(run, recRun.soinTaverneRun(run, meta_.pctSoinTaverne(run.ascension)));
      } else if (type === "rencontre") {
        const r = renc.tirerRencontre(
          rng,
          renc.rencontresExclues(run, { mortDefinitive: mortDefinitive(run) }),
        );
        if (r === "sanctuaire") {
          if (pvFrac(run) < 0.6) run_.soignerEquipe(run, 0.3);
          else (run.benedictions ??= []).push(renc.dieuxProposes(run, rng)[0]);
        } else if (r === "coffre") {
          eco.ajouterKamas(run, Math.round(renc.gainBase(num) * 1.5));
        } else if (r === "colporteur") {
          // achète la première relique abordable si la bourse reste garnie
          for (const id of cases.reliquesProposees(run, rng, 3)) {
            const prix = cases.prixReliqueRun(id, num);
            if (run.kamas >= prix * 1.5 && cases.acheterReliqueRun(run, id, prix)) break;
          }
        } else if (r === "autel_sang") {
          // pacte accepté tant que le sacrifice reste petit et que l'équipe est en forme
          const [id] = cases.reliquesProposees(run, rng, 2, { commun: 15, rare: 55, epique: 30 });
          if (id && (run.sacrificePv ?? 0) < 0.16 && pvFrac(run) > 0.6) cases.pacteAutel(run, id);
        } else if (lore.estRencontreLore(r)) {
          // rencontres du Krosmoz, règle simple : repos sous 50 % de PV, pas de risque (perte de PV
          // ou combat) sous 60 %, sinon le premier choix possible (« partir » en dernier recours)
          const prep = lore.preparerRencontreLore(run, r, { rng, toile: num });
          const pv = pvFrac(run);
          const issuesDe = (id) => RENCONTRES[r].choix.find((c) => c.id === id)?.issues ?? [];
          const risque = (id) => issuesDe(id).some((i) => i.combat || i.effets?.pertePvPct);
          const possibles = prep.choix.filter((c) => !c.desactive && issuesDe(c.id).length);
          const choix =
            (pv < 0.5 && possibles.find((c) => issuesDe(c.id).some((i) => i.effets?.soinPct))) ||
            possibles.find((c) => pv >= 0.6 || !risque(c.id));
          const issue = choix && lore.tirerIssue(r, choix.id, rng);
          if (issue && lore.payerChoix(run, r, choix.id, num)) {
            if (issue.combat) {
              const pool = issue.combat === "elite" ? zone.pools.elite : zone.pools.normales;
              const type = issue.combat === "elite" ? "combat_dur" : "combat";
              const id = pool[Math.floor(rng() * pool.length)];
              if (!(await combat(run, meta, id, type, zone, rng))) {
                journal.mort = { zone: zi + 1, type, combats: journal.combats };
                return journal;
              }
              run_.recupererApresVictoire(run);
            }
            lore.appliquerEffetsLore(run, issue.effets, { rng, toile: num, heros: prep.heros });
          }
        } else if (r === "marchand") {
          const prix = renc.prixMarchand(num);
          if (pvFrac(run) < 0.7 && run.kamas >= prix.potion) {
            run.kamas -= prix.potion;
            run_.soignerEquipe(run, 0.4);
          }
        }
      } else if (type === "hdv") {
        const stock = eco.genererStockHdv(zone.id, rng);
        // achète l'objet le plus cher qu'on peut se payer s'il améliore quelqu'un
        stock.sort((a, b) => b.prix - a.prix);
        for (let k = 0; k < stock.length; k++) {
          if (stock[k].prix > run.kamas) continue;
          const avant = run.persos.map(scoreHeros).reduce((a, b) => a + b, 0);
          run.inventaire.push(stock[k].inst);
          sEquiper(run);
          const apres = run.persos.map(scoreHeros).reduce((a, b) => a + b, 0);
          if (apres > avant) run.kamas -= stock[k].prix;
          break;
        }
      } else if (type === "otomai") {
        run.philtres += 1;
      }
    }
    run_.soignerEquipe(run, 1);
    journal.zone = zi + 1;
  }
  journal.classes = run.persos.map((p) => p.classeId);
  journal.panos = run.persos.filter((p) =>
    Object.values(run_.compterPanoplies(p)).some((v) => v >= 4),
  ).length;
  return journal;
}

// ---------- Songes infinis : le robot enchaîne les étages jusqu'à la chute ----------
const scoreEquipe = (run) => run.persos.map(scoreHeros).reduce((a, b) => a + b, 0);
function choisirRecompense(run, offre) {
  const pv = pvFrac(run);
  const ko = run.persos.some((p) => p.pvActuels <= 0);
  const par = (type) => offre.findIndex((r) => r.type === type);
  if (par("soin") >= 0 && (pv < 0.6 || ko)) return par("soin");
  const iObjet = par("objet");
  // améliorations de sort et reliques de run d'abord (même règle qu'après un combat de run)
  if (!SANS_RECOMPENSES) {
    if (par("sort") >= 0) return par("sort");
    if (par("apprendre") >= 0) return par("apprendre");
    if (par("relique") >= 0) return par("relique");
  }
  if (iObjet >= 0 && offre[iObjet].objet) {
    // l'objet est pris s'il améliore l'équipe
    const avant = scoreEquipe(run);
    const essai = structuredClone(run);
    essai.inventaire.push(structuredClone(offre[iObjet].objet));
    sEquiper(essai);
    if (scoreEquipe(essai) > avant * 1.005) return iObjet;
  }
  if (par("amelioration") >= 0) return par("amelioration");
  if (par("soin") >= 0 && pv < 0.85) return par("soin");
  if (par("kamas") >= 0) return par("kamas");
  return 0;
}
function palier(run, rng) {
  const recrues = run_.tirerRecrues(run, rng);
  if (run.persos.length < 4 && recrues.length) {
    run_.recruter(run, recrues[0]);
    const recrue = run.persos.find((p) => p.classeId === recrues[0]);
    songes.equiperKit(recrue, rng);
    recrue.pvActuels = run_.pvMaxPerso(recrue);
  }
  // HDV de la dernière zone du Monde 5 : achète le plus cher qui améliore l'équipe
  const stock = eco.genererStockHdv(MONDES.at(-1).zones.at(-1), rng);
  stock.sort((a, b) => b.prix - a.prix);
  for (const offre of stock) {
    if (offre.prix > run.kamas) continue;
    const avant = scoreEquipe(run);
    run.inventaire.push(offre.inst);
    sEquiper(run);
    if (scoreEquipe(run) > avant) run.kamas -= offre.prix;
  }
}
async function jouerSonge(seed) {
  const rng = rngSeed(seed);
  Math.random = rng;
  const meta = metaPour("t5");
  const depart = [];
  while (depart.length < 2) {
    const c = classes[Math.floor(rng() * classes.length)];
    if (!depart.includes(c)) depart.push(c);
  }
  const run = songes.nouvelleRunSonges(depart, rng, 0);
  while (run.etage < 300) {
    const etage = songes.genererEtage(run.etage, rng);
    const ok = await combat(run, meta, etage.combatId, etage.type, null, rng, undefined, {
      facteur: etage.facteur,
      affixes: run.affixesSonge,
    });
    if (!ok) {
      if (process.env.VERBOSE)
        console.log(`   chute à l'étage ${run.etage} (${etage.combatId}, ${depart.join("+")})`);
      break;
    }
    eco.ajouterKamas(run, eco.gainKamas(etage.boss ? "donjon" : "combat", 60, rng));
    const { palier: estPalier } = songes.franchirEtage(run, rng);
    if (estPalier) palier(run, rng);
    songes.appliquerRecompense(run, run.offreSonge[choisirRecompense(run, run.offreSonge)]);
    run.offreSonge = null;
    run.palierSonge = null;
    sEquiper(run);
  }
  return { score: songes.scoreSonges(run.etage), classes: depart, heros: run.persos.length };
}
if (mondes[0] === "songes") {
  const scores = [];
  for (let k = 0; k < N; k++) {
    const r = await jouerSonge(4242 + 7919 * k);
    scores.push(r.score);
    if (process.env.VERBOSE) console.log(`#${k + 1} : ${r.score} étages (${r.classes.join("+")})`);
  }
  const tri = [...scores].sort((a, b) => a - b);
  const moyenne = scores.reduce((a, b) => a + b, 0) / N;
  const ecartType = Math.sqrt(scores.reduce((a, b) => a + (b - moyenne) ** 2, 0) / N);
  console.log(
    `songes : ${N} tentatives · étage moyen franchi ${moyenne.toFixed(1)} · médiane ${tri[Math.floor(N / 2)]} · min ${tri[0]} · max ${tri.at(-1)} · écart-type ${ecartType.toFixed(1)}`,
  );
  console.log(`   étages franchis : ${tri.join(" ")}`);
  if (SORTIE) (await import("node:fs")).writeFileSync(SORTIE, JSON.stringify({ scores }));
  process.exit(0);
}

const resultats = {};
for (const monde of mondes) {
  const runs = [];
  for (let k = 0; k < N; k++)
    runs.push(await jouerRun(monde, 1000 + 7919 * k + monde.charCodeAt(1) * 131));
  const nbZ = MONDES.find((m) => m.id === monde).zones.length;
  const morts = Array(nbZ + 1).fill(0);
  const mortsType = {};
  for (const r of runs)
    if (r.mort) {
      morts[r.mort.zone]++;
      mortsType[r.mort.type] = (mortsType[r.mort.type] ?? 0) + 1;
    }
  const victoires = runs.filter((r) => !r.mort).length;
  const niv = Array.from({ length: nbZ }, (_, i) => {
    const l = runs.filter((r) => r.niveaux[i] !== undefined).map((r) => r.niveaux[i]);
    return l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : null;
  });
  const obj = Array.from({ length: nbZ }, (_, i) => {
    const l = runs.filter((r) => r.objets[i] !== undefined).map((r) => r.objets[i]);
    return l.length ? Math.round((l.reduce((a, b) => a + b, 0) / l.length) * 10) / 10 : null;
  });
  const zoneMoy = runs.reduce((a, r) => a + r.zone, 0) / N;
  const parClasse = {};
  for (const r of runs)
    for (const c of r.classes ?? []) {
      parClasse[c] ??= [0, 0, 0];
      parClasse[c][0]++;
      parClasse[c][1] += r.zone;
      parClasse[c][2] += r.mort ? 0 : 1;
    }
  resultats[monde] = {
    parClasse,
    victoires: victoires / N,
    zoneMoy,
    morts: morts.slice(1),
    mortsType,
    niv,
    obj,
  };
  console.log(
    `${monde} asc${ASC} : victoires ${Math.round((victoires / N) * 100)} % · zone moyenne atteinte ${zoneMoy.toFixed(1)}/${nbZ}`,
  );
  console.log(`   morts par zone : ${morts.slice(1).join(" ")}   (${JSON.stringify(mortsType)})`);
  console.log(`   niveau à l'entrée : ${niv.join(" ")}`);
  console.log(`   objets portés/héros : ${obj.join(" ")}`);
}
if (SORTIE) (await import("node:fs")).writeFileSync(SORTIE, JSON.stringify(resultats));
