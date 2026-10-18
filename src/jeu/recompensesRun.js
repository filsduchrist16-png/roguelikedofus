// Choix de récompense après un combat (inspiré de Slay the Spire / Hades) : amélioration de sort
// d'un héros, relique de run ou petit bonus, ou « Passer » contre quelques kamas. Logique pure :
// tirage (hasard injecté), application du choix, effets des reliques de run, sauvegarde.
import { CLASSES, MONDES, RELIQUES_RUN, SORTS, SYNERGIES_RUN } from "../data/index.js";
import {
  AMELIORATIONS_PAR_SORT,
  AMELIORATIONS_SORT,
  ameliorationsPossibles,
} from "../combat/ameliorations.js";
import { ajouterKamas, gainKamas } from "./economie.js";
import { effetsDifficulte, pvMaxPerso, soignerEquipe, sortsAppris } from "./run.js";

export const RARETES_CHOIX = [`commun`, `rare`, `epique`];
export const NOMS_RARETES_CHOIX = { commun: `Commune`, rare: `Rare`, epique: `Épique` };
export const CONFIG_RECOMPENSES = {
  // chance que la 2e carte soit une relique de run (sinon une 2e amélioration de sort)
  // (élite : relique garantie, c'est la récompense du chemin risqué de la carte)
  chanceRelique: { normal: 0.2, elite: 1 },
  // chance que la 3e carte soit un nouveau sort (sort avancé de la classe) au lieu d'un bonus,
  // tant qu'un héros a encore un sort avancé à apprendre
  chanceNouveauSort: { normal: 0.2, elite: 0.45 },
  // poids des raretés au début du monde ; `progression` (0 → 1 sur les zones du monde) les décale
  raretes: {
    normal: { commun: 72, rare: 25, epique: 3 },
    elite: { commun: 20, rare: 50, epique: 30 },
  },
  // bonus : kamas (× gain d'un combat de ce type), repos, caractéristiques
  bonusKamas: 1.5,
  soinPct: 0.35,
  // « Passer » : part des kamas du bonus
  passer: 0.4,
  // +stats : points dans les quatre caractéristiques élémentaires, selon le niveau du héros
  statsBase: 5,
  statsParNiveau: 0.15,
  // compensation : les monstres de la zone d'indice i (0 = première zone du monde) gagnent
  // 1 + lin × i + quad × i² de puissance (PV et dégâts). Les récompenses s'accumulent et se
  // combinent : la compensation reste faible au début et monte vers la fin du monde, pour garder
  // les taux de victoire de la 1.6.0. Le Monde 1 (héros de bas niveau, sur qui chaque bonus pèse
  // plus) a la sienne, le Monde 3 aussi. Réglé par simulation : npm run sim -- t1,t3,t5 30
  compensation: {
    // 1.8.0 : relevée pour les camps, coffres, reliques hors combat et élites plus généreuses
    t1: { lin: 0.063, quad: 0.0095 },
    t3: { lin: 0, quad: 0.012 },
    autres: { lin: 0, quad: 0.011 },
  },
};
/** Facteur de puissance des monstres d'une zone dû aux récompenses de combat (1 en zone 1). */
export function compensationRecompenses(zoneId) {
  const monde = MONDES.find((candidat) => candidat.zones.includes(zoneId));
  const indice = monde ? monde.zones.indexOf(zoneId) : 0;
  const { lin, quad } =
    CONFIG_RECOMPENSES.compensation[monde?.id] ?? CONFIG_RECOMPENSES.compensation.autres;
  const i = Math.max(0, indice);
  return 1 + lin * i + quad * i * i;
}

// ---------- Reliques de run ----------
export const reliqueRunConnue = (id) => !!RELIQUES_RUN[id];
/** Reliques de run de la run (identifiants connus, sans doublon). */
export function reliquesRunDe(run) {
  return [...new Set((run?.reliquesRun ?? []).filter(reliqueRunConnue))];
}
// effets qui se multiplient (les autres s'additionnent, les booléens s'activent)
const MULTIPLICATIFS = new Set([`multKamas`, `xpMult`]);

// ---------- Synergies : deux reliques qui se renforcent ----------
/** Synergies dont toutes les reliques sont possédées. */
export function synergiesActives(run) {
  const possedees = new Set(reliquesRunDe(run));
  return Object.values(SYNERGIES_RUN).filter((synergie) =>
    synergie.reliques.every((id) => possedees.has(id)),
  );
}
/** Synergies auxquelles participe une relique. */
export const synergiesDeRelique = (id) =>
  Object.values(SYNERGIES_RUN).filter((synergie) => synergie.reliques.includes(id));
const nomsReliques = (ids) => ids.map((id) => RELIQUES_RUN[id]?.nom ?? id).join(` + `);
/**
 * Texte des synergies d'une relique, pour sa description : « Synergie Curée avec Crocs de
 * Milimulou : … (active) ». `run` (facultatif) dit si la synergie est active ou ce qui manque.
 */
export function texteSynergies(id, run = null) {
  const possedees = new Set(run ? reliquesRunDe(run) : []);
  return synergiesDeRelique(id)
    .map((synergie) => {
      const autres = synergie.reliques.filter((autre) => autre !== id);
      const etat = !run
        ? ``
        : synergie.reliques.every((relique) => possedees.has(relique))
          ? ` (active)`
          : autres.every((autre) => possedees.has(autre))
            ? ` (tu as ${nomsReliques(autres)} : active si tu la prends)`
            : ``;
      return `Synergie ${synergie.icone} ${synergie.nom} avec ${nomsReliques(autres)} : ${synergie.desc}${etat}`;
    })
    .join(` `);
}
/** Effets cumulés des reliques de run et de leurs synergies : { pvPct: 0.06, multKamas: 1.15, … }. */
export function effetsReliquesRun(run) {
  const total = {};
  const sources = [
    ...reliquesRunDe(run).map((id) => RELIQUES_RUN[id].effet ?? {}),
    ...synergiesActives(run).map((synergie) => synergie.effet ?? {}),
  ];
  for (const effet of sources) {
    for (const [cle, valeur] of Object.entries(effet)) {
      if (typeof valeur === `boolean`) {
        total[cle] = total[cle] || valeur;
      } else if (MULTIPLICATIFS.has(cle)) {
        total[cle] = (total[cle] ?? 1) * valeur;
      } else {
        total[cle] = (total[cle] ?? 0) + valeur;
      }
    }
  }
  return total;
}
/** Part de PV max sacrifiée à l'autel de sang (0 à 0,4). */
export const sacrificePvRun = (run) =>
  typeof run?.sacrificePv === `number` && Number.isFinite(run.sacrificePv)
    ? Math.min(0.4, Math.max(0, run.sacrificePv))
    : 0;
/** Ajoute aux bonus d'équipe (ceux des Dofus et des bénédictions) les reliques « de stats ». */
export function ajouterReliquesAuBonus(bonus, run) {
  const effets = effetsReliquesRun(run);
  bonus.damageMult *= 1 + (effets.degatsPct ?? 0);
  // autel de sang : les reliques prises contre des PV max
  bonus.pvPct += (effets.pvPct ?? 0) - sacrificePvRun(run);
  bonus.resAllBonus += effets.resAll ?? 0;
  bonus.multKamas *= effets.multKamas ?? 1;
  bonus.prospection += effets.prospectionPlat ?? 0;
  bonus.critPlat += effets.critPlat ?? 0;
  bonus.soinPlat += effets.soinPlat ?? 0;
  bonus.initiativeBonus += effets.initiativeBonus ?? 0;
  bonus.esquiveBonus += effets.esquiveBonus ?? 0;
  bonus.bouclierDebutPct += effets.bouclierDebutPct ?? 0;
  bonus.ouvreToujours ||= !!effets.ouvreToujours;
  return bonus;
}
/**
 * Reliques de run à afficher (carte, équipement, bilan) : [{ id, icone, nom, desc }], puis les
 * synergies actives (🔗, `synergie: true`).
 */
export function reliquesRunAffichees(run) {
  return [
    ...reliquesRunDe(run).map((id) => {
      const synergies = texteSynergies(id, run);
      return {
        id,
        icone: RELIQUES_RUN[id].icone,
        nom: RELIQUES_RUN[id].nom,
        desc: `Relique de run (${NOMS_RARETES_CHOIX[RELIQUES_RUN[id].rarete] ?? ``}) : ${RELIQUES_RUN[id].desc}${synergies ? ` ${synergies}` : ``}`,
        reliqueRun: true,
      };
    }),
    ...synergiesActives(run).map((synergie) => ({
      id: synergie.id,
      icone: `🔗${synergie.icone}`,
      nom: synergie.nom,
      desc: `Synergie active (${nomsReliques(synergie.reliques)}) : ${synergie.desc}`,
      reliqueRun: true,
      synergie: true,
    })),
  ];
}

// ---------- Héros en combat ----------
/**
 * Prépare les héros d'un combat : améliorations de sort, effets des reliques lus par le moteur
 * (`effetsRun`), PA du premier tour, remise du premier sort et bonus de caractéristiques.
 */
export function preparerHerosRun(combattants, run) {
  const effets = effetsReliquesRun(run);
  const aEffets = Object.keys(effets).length > 0;
  for (const combattant of combattants) {
    const classeId = combattant.ref?.startsWith(`j_`) ? combattant.ref.slice(2) : null;
    if (!classeId) {
      continue;
    }
    const ameliorations = run?.ameliorations?.[classeId];
    if (ameliorations && Object.keys(ameliorations).length) {
      combattant.ameliorations = structuredClone(ameliorations);
    }
    if (aEffets) {
      combattant.effetsRun = { ...effets };
      if (effets.paPremierTour) {
        combattant.paBonusNextTurn = (combattant.paBonusNextTurn ?? 0) + effets.paPremierTour;
      }
      if (effets.remisePremierSort) {
        combattant.remisePremierSort = effets.remisePremierSort;
      }
    }
    const points = run?.bonusStats?.[classeId] ?? 0;
    if (points > 0) {
      combattant.stats = {
        ...combattant.stats,
        force: (combattant.stats.force ?? 0) + points,
        intelligence: (combattant.stats.intelligence ?? 0) + points,
        agilite: (combattant.stats.agilite ?? 0) + points,
        chance: (combattant.stats.chance ?? 0) + points,
      };
    }
  }
  return combattants;
}

// ---------- Effets hors combat ----------
/** Bandages : les héros debout récupèrent une part de leurs PV max après une victoire. */
export function soinFinCombat(run) {
  const pct = effetsReliquesRun(run).soinFinCombat ?? 0;
  if (!pct) {
    return 0;
  }
  let total = 0;
  for (const perso of run.persos) {
    if (perso.pvActuels > 0) {
      const max = pvMaxPerso(perso);
      const avant = perso.pvActuels;
      perso.pvActuels = Math.min(max, perso.pvActuels + Math.round(max * pct));
      total += perso.pvActuels - avant;
    }
  }
  return total;
}
export const multXpRun = (run) => effetsReliquesRun(run).xpMult ?? 1;
/** Multiplicateur de kamas propre aux reliques (élites). */
export const multKamasEliteRun = (run, type) =>
  type === `combat_dur` ? 1 + (effetsReliquesRun(run).kamasElite ?? 0) : 1;
/** Part de PV rendue par une taverne, relique comprise (au plus 100 %). */
export const soinTaverneRun = (run, pct) =>
  Math.min(1, pct + (effetsReliquesRun(run).soinTaverne ?? 0));

// ---------- Tirage ----------
function tirerPoids(poids, rng) {
  const entrees = Object.entries(poids).filter(([, valeur]) => valeur > 0);
  const total = entrees.reduce((somme, [, valeur]) => somme + valeur, 0);
  let tirage = rng() * total;
  for (const [cle, valeur] of entrees) {
    tirage -= valeur;
    if (tirage < 0) {
      return cle;
    }
  }
  return entrees[0]?.[0] ?? `commun`;
}
/** Poids des raretés : les élites et les dernières zones du monde donnent plus de rares et d'épiques. */
export function poidsRaretes(elite, progression = 0) {
  const base = CONFIG_RECOMPENSES.raretes[elite ? `elite` : `normal`];
  const p = Math.max(0, Math.min(1, progression));
  return {
    commun: base.commun * (1 - 0.35 * p),
    rare: base.rare * (1 + 0.3 * p),
    epique: base.epique * (1 + 1.2 * p),
  };
}
const choisir = (liste, rng) => liste[Math.floor(rng() * liste.length)];
const herosEligibles = (run) =>
  effetsDifficulte(run.ascension).mortDefinitive
    ? run.persos.filter((perso) => perso.pvActuels > 0)
    : run.persos;
const cleChoix = (choix) =>
  choix.type === `sort`
    ? `sort:${choix.heros}:${choix.sort}`
    : choix.type === `apprendre`
      ? `apprendre:${choix.heros}`
      : choix.type === `relique`
        ? `relique:${choix.id}`
        : `bonus:${choix.bonus}`;
/** Sorts d'un héros qui peuvent recevoir une amélioration : ceux de sa classe et ceux appris. */
const sortsAmeliorables = (perso) => [
  ...(CLASSES[perso.classeId]?.sorts ?? []),
  ...sortsAppris(perso),
];
/** Sorts avancés qu'un héros peut encore apprendre (dans l'ordre de sa classe). */
export function sortsAApprendre(perso) {
  const deja = new Set(sortsAppris(perso));
  return (CLASSES[perso?.classeId]?.sortsAvances ?? []).filter((id) => SORTS[id] && !deja.has(id));
}
/** Un nouveau sort à apprendre pour un héros de l'équipe (ou null s'ils savent tout). */
export function tirerApprentissage(run, rng, exclus = new Set()) {
  const candidats = herosEligibles(run)
    .filter((perso) => !exclus.has(`apprendre:${perso.classeId}`))
    .flatMap((perso) => sortsAApprendre(perso).map((sort) => ({ heros: perso.classeId, sort })));
  return candidats.length ? { type: `apprendre`, ...choisir(candidats, rng) } : null;
}
/** Toutes les améliorations encore possibles : [{ heros, sort, amelioration }]. */
export function ameliorationsCandidates(run) {
  const out = [];
  for (const perso of herosEligibles(run)) {
    for (const sortId of sortsAmeliorables(perso)) {
      const deja = run.ameliorations?.[perso.classeId]?.[sortId] ?? [];
      for (const id of ameliorationsPossibles(SORTS[sortId], deja)) {
        out.push({ heros: perso.classeId, sort: sortId, amelioration: id });
      }
    }
  }
  return out;
}
/** Une amélioration de sort de la rareté voulue (ou d'une autre s'il n'y en a plus). */
export function tirerAmeliorationSort(run, rng, rarete, exclus = new Set()) {
  const candidates = ameliorationsCandidates(run).filter(
    (candidat) => !exclus.has(`sort:${candidat.heros}:${candidat.sort}`),
  );
  if (!candidates.length) {
    return null;
  }
  const deRarete = candidates.filter(
    (candidat) => AMELIORATIONS_SORT[candidat.amelioration].rarete === rarete,
  );
  return { type: `sort`, ...choisir(deRarete.length ? deRarete : candidates, rng) };
}
/** Une relique de run pas encore possédée, de la rareté voulue (ou d'une autre). */
export function tirerReliqueRun(run, rng, rarete, exclus = new Set()) {
  const possedees = new Set(reliquesRunDe(run));
  const libres = Object.keys(RELIQUES_RUN).filter(
    (id) => !possedees.has(id) && !exclus.has(`relique:${id}`),
  );
  if (!libres.length) {
    return null;
  }
  const deRarete = libres.filter((id) => RELIQUES_RUN[id].rarete === rarete);
  return { type: `relique`, id: choisir(deRarete.length ? deRarete : libres, rng) };
}
export const pointsStats = (niveau) =>
  Math.round(CONFIG_RECOMPENSES.statsBase + CONFIG_RECOMPENSES.statsParNiveau * niveau);
/** Un bonus simple : kamas, repos ou caractéristiques pour un héros. */
export function tirerBonus(run, rng, { type = `combat`, numZone = 1, exclus = new Set() } = {}) {
  const sortes = [`kamas`, `soin`, `stats`].filter((sorte) => !exclus.has(`bonus:${sorte}`));
  const sorte = choisir(sortes.length ? sortes : [`kamas`], rng);
  if (sorte === `soin`) {
    return { type: `bonus`, bonus: `soin`, pct: CONFIG_RECOMPENSES.soinPct };
  }
  if (sorte === `stats`) {
    const perso = choisir(herosEligibles(run).length ? herosEligibles(run) : run.persos, rng);
    return {
      type: `bonus`,
      bonus: `stats`,
      heros: perso.classeId,
      valeur: pointsStats(perso.progression?.niveau ?? 1),
    };
  }
  return {
    type: `bonus`,
    bonus: `kamas`,
    montant: Math.max(1, Math.round(gainKamas(type, numZone, rng) * CONFIG_RECOMPENSES.bonusKamas)),
  };
}
/**
 * Offre après un combat normal ou élite : trois cartes (amélioration de sort, relique ou 2e
 * amélioration, bonus) et le montant de « Passer ». Tout est tiré ici pour qu'une reprise de
 * sauvegarde montre exactement la même offre.
 */
export function tirerOffreCombat(run, { elite = false, numZone = 1, progression = 0, rng }) {
  const poids = poidsRaretes(elite, progression);
  const exclus = new Set();
  const choix = [];
  const ajouter = (carte) => {
    if (carte) {
      choix.push(carte);
      exclus.add(cleChoix(carte));
    }
    return !!carte;
  };
  const type = elite ? `combat_dur` : `combat`;
  ajouter(tirerAmeliorationSort(run, rng, tirerPoids(poids, rng), exclus));
  const relique = rng() < CONFIG_RECOMPENSES.chanceRelique[elite ? `elite` : `normal`];
  const rarete = tirerPoids(poids, rng);
  if (relique) {
    ajouter(tirerReliqueRun(run, rng, rarete, exclus)) ||
      ajouter(tirerAmeliorationSort(run, rng, rarete, exclus));
  } else {
    ajouter(tirerAmeliorationSort(run, rng, rarete, exclus)) ||
      ajouter(tirerReliqueRun(run, rng, rarete, exclus));
  }
  // 3e carte : parfois un nouveau sort pour un héros (sorts avancés de sa classe)
  if (rng() < CONFIG_RECOMPENSES.chanceNouveauSort[elite ? `elite` : `normal`]) {
    ajouter(tirerApprentissage(run, rng, exclus));
  }
  while (choix.length < 3) {
    ajouter(tirerBonus(run, rng, { type, numZone, exclus }));
  }
  return {
    elite,
    choix,
    passer: Math.max(1, Math.round(gainKamas(type, numZone, rng) * CONFIG_RECOMPENSES.passer)),
  };
}

// ---------- Application ----------
/** Applique un choix (combat ou songe) ; renvoie un texte court pour le bandeau. */
export function appliquerChoix(run, choix) {
  switch (choix?.type) {
    case `sort`: {
      const def = AMELIORATIONS_SORT[choix.amelioration];
      if (!def || !SORTS[choix.sort]) {
        return ``;
      }
      const parHeros = ((run.ameliorations ??= {})[choix.heros] ??= {});
      const liste = (parHeros[choix.sort] ??= []);
      if (!liste.includes(choix.amelioration) && liste.length < AMELIORATIONS_PAR_SORT) {
        liste.push(choix.amelioration);
      }
      return `⬆ ${SORTS[choix.sort].nom} (${CLASSES[choix.heros]?.nom ?? choix.heros}) : ${def.texte(SORTS[choix.sort])}`;
    }
    case `apprendre`: {
      const perso = run.persos.find((candidat) => candidat.classeId === choix.heros);
      const sort = SORTS[choix.sort];
      if (!perso || !sort || !CLASSES[choix.heros]?.sortsAvances?.includes(choix.sort)) {
        return ``;
      }
      perso.sortsAppris = [...new Set([...sortsAppris(perso), choix.sort])];
      return `📖 ${CLASSES[choix.heros].nom} apprend ${sort.nom} : ${sort.desc}`;
    }
    case `relique`: {
      const relique = RELIQUES_RUN[choix.id];
      if (!relique) {
        return ``;
      }
      if (!(run.reliquesRun ??= []).includes(choix.id)) {
        run.reliquesRun.push(choix.id);
      }
      return `${relique.icone} ${relique.nom} : ${relique.desc}`;
    }
    case `bonus`:
      if (choix.bonus === `kamas`) {
        ajouterKamas(run, choix.montant);
        return `💰 +${choix.montant} kamas`;
      }
      if (choix.bonus === `soin`) {
        const avant = run.persos.reduce((somme, perso) => somme + Math.max(0, perso.pvActuels), 0);
        soignerEquipe(run, choix.pct);
        const apres = run.persos.reduce((somme, perso) => somme + Math.max(0, perso.pvActuels), 0);
        return `💤 Repos : +${apres - avant} PV pour l'équipe`;
      }
      if (choix.bonus === `stats`) {
        const bonus = (run.bonusStats ??= {});
        bonus[choix.heros] = (bonus[choix.heros] ?? 0) + choix.valeur;
        return `📈 ${CLASSES[choix.heros]?.nom ?? choix.heros} : +${choix.valeur} en Force, Intelligence, Agilité et Chance`;
      }
      return ``;
    default:
      return ``;
  }
}
/** Choix de l'offre en attente (indice) ou `passer` ; vide l'offre. Renvoie le texte du bandeau. */
export function resoudreOffreCombat(run, indice) {
  const offre = run.offreCombat;
  run.offreCombat = null;
  if (!offre) {
    return ``;
  }
  if (indice === `passer`) {
    ajouterKamas(run, offre.passer);
    return `💰 Tu passes : +${offre.passer} kamas`;
  }
  return appliquerChoix(run, offre.choix[indice]);
}

// ---------- Textes (écran de choix, Songes) ----------
/** Description lisible d'un choix : { icone, titre, sousTitre, effet, rarete, sortId? }. */
export function decrireChoix(choix, run) {
  switch (choix?.type) {
    case `sort`: {
      const def = AMELIORATIONS_SORT[choix.amelioration];
      const sort = SORTS[choix.sort];
      const deja = (run?.ameliorations?.[choix.heros]?.[choix.sort] ?? []).length;
      return {
        icone: def?.icone ?? `⬆`,
        titre: `${sort?.nom ?? choix.sort} : ${def?.nom ?? ``}`,
        sousTitre: `Amélioration de sort · ${CLASSES[choix.heros]?.nom ?? choix.heros}${deja ? ` · ${deja + 1}/${AMELIORATIONS_PAR_SORT}` : ``}`,
        effet: def ? `${def.texte(sort ?? {})}, pour toute la run.` : ``,
        rarete: def?.rarete ?? `commun`,
        sortId: choix.sort,
      };
    }
    case `apprendre`: {
      const sort = SORTS[choix.sort];
      return {
        icone: sort?.emoji ?? `📖`,
        titre: `Nouveau sort : ${sort?.nom ?? choix.sort}`,
        sousTitre: `Nouveau sort · ${CLASSES[choix.heros]?.nom ?? choix.heros}`,
        effet:
          `${sort?.desc ?? ``} ${sort ? `${sort.coutPA} PA. ` : ``}Le héros le garde pour toute la run.`.trim(),
        rarete: `rare`,
      };
    }
    case `relique`: {
      const relique = RELIQUES_RUN[choix.id];
      return {
        icone: relique?.icone ?? `🔮`,
        titre: relique?.nom ?? choix.id,
        sousTitre: `Relique de run`,
        effet: [relique?.desc ?? ``, texteSynergies(choix.id, run)].filter(Boolean).join(` `),
        rarete: relique?.rarete ?? `commun`,
      };
    }
    case `bonus`:
      if (choix.bonus === `kamas`) {
        return {
          icone: `💰`,
          titre: `Bourse`,
          sousTitre: `Bonus`,
          effet: `+${choix.montant} kamas.`,
          rarete: `commun`,
        };
      }
      if (choix.bonus === `soin`) {
        const mortDef = run && effetsDifficulte(run.ascension).mortDefinitive;
        return {
          icone: `💤`,
          titre: `Repos`,
          sousTitre: `Bonus`,
          effet: `Chaque héros${mortDef ? ` debout` : `, K.O. compris,`} récupère ${Math.round(choix.pct * 100)} % de ses PV max.`,
          rarete: `commun`,
        };
      }
      return {
        icone: `📈`,
        titre: `Entraînement`,
        sousTitre: `Bonus · ${CLASSES[choix.heros]?.nom ?? choix.heros}`,
        effet: `+${choix.valeur} en Force, Intelligence, Agilité et Chance, pour toute la run.`,
        rarete: `commun`,
      };
    default:
      return null;
  }
}

// ---------- Sauvegarde ----------
const entierPositif = (valeur) =>
  typeof valeur === `number` && Number.isFinite(valeur) ? Math.max(0, Math.round(valeur)) : 0;
/** Un choix lu dans une sauvegarde : nettoyé, ou null s'il est inconnu. */
export function assainirChoix(choix) {
  switch (choix?.type) {
    case `sort`:
      return CLASSES[choix.heros] &&
        SORTS[choix.sort] &&
        (CLASSES[choix.heros].sorts?.includes(choix.sort) ||
          CLASSES[choix.heros].sortsAvances?.includes(choix.sort)) &&
        AMELIORATIONS_SORT[choix.amelioration]
        ? { type: `sort`, heros: choix.heros, sort: choix.sort, amelioration: choix.amelioration }
        : null;
    case `apprendre`:
      return CLASSES[choix.heros]?.sortsAvances?.includes(choix.sort) && SORTS[choix.sort]
        ? { type: `apprendre`, heros: choix.heros, sort: choix.sort }
        : null;
    case `relique`:
      return reliqueRunConnue(choix.id) ? { type: `relique`, id: choix.id } : null;
    case `bonus`:
      if (choix.bonus === `kamas`) {
        return { type: `bonus`, bonus: `kamas`, montant: entierPositif(choix.montant) };
      }
      if (choix.bonus === `soin`) {
        const pct = typeof choix.pct === `number` ? Math.min(1, Math.max(0, choix.pct)) : 0.35;
        return { type: `bonus`, bonus: `soin`, pct };
      }
      if (choix.bonus === `stats` && CLASSES[choix.heros]) {
        return {
          type: `bonus`,
          bonus: `stats`,
          heros: choix.heros,
          valeur: Math.min(500, entierPositif(choix.valeur)),
        };
      }
      return null;
    default:
      return null;
  }
}
/**
 * Champs de la run liés aux récompenses, lus dans une sauvegarde : absents = vides, valeurs
 * inconnues retirées (sorts, améliorations, reliques), offre en attente gardée si elle est valide.
 */
export function assainirRecompensesRun(run) {
  const ameliorations = {};
  for (const [classeId, parSort] of Object.entries(run.ameliorations ?? {})) {
    if (!CLASSES[classeId] || !parSort || typeof parSort !== `object`) {
      continue;
    }
    for (const [sortId, ids] of Object.entries(parSort)) {
      const valides = Array.isArray(ids)
        ? [...new Set(ids.filter((id) => AMELIORATIONS_SORT[id]))].slice(0, AMELIORATIONS_PAR_SORT)
        : [];
      if (SORTS[sortId] && valides.length) {
        (ameliorations[classeId] ??= {})[sortId] = valides;
      }
    }
  }
  run.ameliorations = ameliorations;
  // sorts avancés appris (1.9.0) : absents = aucun, inconnus retirés
  for (const perso of run.persos ?? []) {
    const appris = sortsAppris(perso);
    if (appris.length) {
      perso.sortsAppris = appris;
    } else {
      delete perso.sortsAppris;
    }
  }
  run.reliquesRun = Array.isArray(run.reliquesRun) ? reliquesRunDe(run) : [];
  run.sacrificePv = sacrificePvRun(run);
  const bonusStats = {};
  for (const [classeId, points] of Object.entries(run.bonusStats ?? {})) {
    if (CLASSES[classeId] && entierPositif(points) > 0) {
      bonusStats[classeId] = entierPositif(points);
    }
  }
  run.bonusStats = bonusStats;
  const offre = run.offreCombat;
  const choix = Array.isArray(offre?.choix)
    ? offre.choix.map(assainirChoix).filter(Boolean).slice(0, 3)
    : [];
  run.offreCombat = choix.length
    ? { elite: !!offre.elite, choix, passer: entierPositif(offre.passer) }
    : null;
  return run;
}
