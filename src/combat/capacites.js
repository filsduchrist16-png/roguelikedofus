// Capacités spéciales des boss de donjon (src/data/capacitesBoss.json), jouées au début du tour du
// boss, avant ses sorts. Quatre sortes, toutes lisibles (ligne de journal, badge sur la carte) :
// - `invocation` : le boss appelle un monstre de sa zone, à sa puissance (une part de ses PV) ;
// - `bouclier` : bouclier de zone sur tout son camp pour quelques tours ;
// - `bourrasque` : les héros changent de ligne (la ligne avant passe derrière et inversement) ;
// - `telegraphe` : le boss se concentre tout un tour (aucun sort, badge ⚠️), puis au tour suivant
//   frappe toute l'équipe ou une ligne. L'interrompre : lui retirer `interruption` de ses PV max
//   entre-temps, ou l'assommer.
// Une capacité revient tous les `tous` tours du boss, à partir de son tour `debut`, et coûte `pa`
// PA de ce tour (le boss en garde le reste pour ses sorts).
import { CAPACITES_BOSS, MONSTRES } from "../data/index.js";
import { calculerDegatsDetail, enLigneAvant, logDegats, vivants } from "./stats.js";
import { infligerDegats } from "./effets.js";

/** Capacité d'un boss (copie de la donnée), ou undefined. */
export const capaciteDeBoss = (monstreId) =>
  CAPACITES_BOSS[monstreId] ? structuredClone(CAPACITES_BOSS[monstreId]) : undefined;

/** Le tour `tour` du boss (1 = premier) déclenche-t-il la capacité ? */
export function tourDeCapacite(capacite, tour) {
  const debut = capacite.debut ?? 2;
  const tous = Math.max(1, capacite.tous ?? 3);
  return tour >= debut && (tour - debut) % tous === 0;
}
/** Texte de la cible d'une frappe télégraphiée. */
export const TEXTES_CIBLE_TELEGRAPHE = {
  equipe: `toute l'équipe`,
  avant: `la ligne avant`,
  arriere: `la ligne arrière`,
};
/** PV à retirer au boss pendant sa concentration pour l'interrompre. */
export const seuilInterruption = (boss) =>
  Math.max(1, Math.round(boss.pvMax * (boss.capacite?.interruption ?? 0.15)));

/** Puissance d'un boss par rapport à sa fiche (zone, difficulté, affixes) : 1 = fiche brute. */
function puissanceBoss(boss) {
  const def = MONSTRES[boss.monstreId];
  return def?.pv ? boss.pvBase / def.pv : 1;
}
function caseLibreEnnemie(combattants, camp) {
  const occupees = new Set(
    vivants(combattants)
      .filter((combattant) => combattant.camp === camp)
      .map((combattant) => combattant.position),
  );
  for (const position of [4, 5, 6, 7, 0, 1, 2, 3]) {
    if (!occupees.has(position)) {
      return position;
    }
  }
  return null;
}
function invoquer(boss, capacite, combattants, ctx) {
  const deja = vivants(combattants).filter((combattant) => combattant.invoquePar === boss.ref);
  const pool = (capacite.pool ?? []).filter((id) => MONSTRES[id]);
  const position = caseLibreEnnemie(combattants, boss.camp);
  if (!pool.length || deja.length >= (capacite.max ?? 2) || position === null) {
    return false;
  }
  const def = MONSTRES[pool[Math.floor(ctx.rng() * pool.length)]];
  // le renfort suit la puissance du boss (zone, difficulté), avec une part de ses PV
  const facteur = puissanceBoss(boss);
  const pv = Math.max(1, Math.round(def.pv * facteur * (capacite.puissance ?? 0.6)));
  const stats = { ...def.stats };
  for (const stat of [`force`, `intelligence`, `agilite`, `chance`]) {
    if (stats[stat] !== undefined) {
      stats[stat] = Math.max(0, Math.round(((1 + 0.03 * stats[stat]) * facteur - 1) / 0.03));
    }
  }
  combattants.push({
    ref: `renfort_${boss.ref}_${combattants.length}`,
    nom: def.nom,
    pvBase: pv,
    pvMax: pv,
    pvActuels: pv,
    stats,
    paMax: def.pa,
    paActuels: def.pa,
    initiative: def.initiative,
    resistances: { ...def.resistances },
    sorts: [...def.sorts],
    camp: boss.camp,
    position,
    niveau: 1,
    monstreId: def.id,
    ia: def.ia,
    img: def.img,
    effets: [],
    maxRollCharges: 0,
    bouclier: 0,
    paBonusNextTurn: 0,
    cooldowns: {},
    bonusOffensifProchain: 0,
    invoquePar: boss.ref,
    renfortBoss: true,
  });
  ctx.log(`📯 ${boss.nom} — ${capacite.nom} : ${def.nom} rejoint le combat (${pv} PV) !`);
  return true;
}
function bouclierDeZone(boss, capacite, combattants, ctx) {
  const allies = vivants(combattants).filter(
    (combattant) => combattant.camp === boss.camp && !combattant.estLance,
  );
  for (const allie of allies) {
    const montant = Math.round(allie.pvMax * (capacite.pct ?? 0.1));
    allie.bouclier = (allie.bouclier ?? 0) + montant;
    (allie.boucliersTemporaires ??= []).push({ montant, tours: capacite.tours ?? 2 });
  }
  ctx.log(
    `🛡️ ${boss.nom} — ${capacite.nom} : tout son camp gagne un bouclier de ${Math.round((capacite.pct ?? 0.1) * 100)} % de ses PV max (${capacite.tours ?? 2} tours).`,
  );
  return allies.length > 0;
}
function bourrasque(boss, capacite, combattants, ctx) {
  // les deux lignes adverses échangent leur place, colonne par colonne (aucune case en conflit)
  const heros = vivants(combattants).filter((combattant) => combattant.camp !== boss.camp);
  if (!heros.length) {
    return false;
  }
  for (const combattant of heros) {
    combattant.position =
      combattant.position < 4 ? combattant.position + 4 : combattant.position - 4;
  }
  ctx.log(
    `🌪️ ${boss.nom} — ${capacite.nom} : les héros sont projetés, la ligne avant passe derrière et la ligne arrière devant !`,
  );
  return true;
}
function ciblesTelegraphe(boss, capacite, combattants) {
  const heros = vivants(combattants).filter(
    (combattant) => combattant.camp !== boss.camp && !combattant.estLance,
  );
  if (capacite.cible === `avant` || capacite.cible === `arriere`) {
    const ligne = heros.filter((h) => enLigneAvant(h) === (capacite.cible === `avant`));
    // ligne vide : la frappe retombe sur l'autre
    return ligne.length ? ligne : heros;
  }
  return heros;
}
function frapper(boss, capacite, combattants, ctx) {
  const sort = {
    id: `capacite_${boss.monstreId}`,
    nom: capacite.nom,
    baseMin: capacite.baseMin ?? 10,
    baseMax: capacite.baseMax ?? 14,
    sansEsquiveNiCrit: true,
  };
  ctx.log(
    `💥 ${boss.nom} déchaîne ${capacite.nom} sur ${TEXTES_CIBLE_TELEGRAPHE[capacite.cible] ?? TEXTES_CIBLE_TELEGRAPHE.equipe} !`,
  );
  for (const cible of ciblesTelegraphe(boss, capacite, combattants)) {
    const detail = calculerDegatsDetail(boss, sort, cible, { mult: 1, ctx });
    infligerDegats(cible, detail.dmg, boss, ctx, false, undefined, detail.element);
    logDegats(
      ctx,
      `${boss.nom} → ${capacite.nom} sur ${cible.nom} : `,
      detail.dmg,
      detail.element,
      `.${cible.pvActuels <= 0 ? ` ${cible.nom} est K.O. !` : ``}`,
    );
  }
}

/**
 * Affixe Protecteurs : au début de son tour, le monstre protège l'allié le plus blessé (lui compris)
 * d'un bouclier temporaire. Renvoie l'allié protégé, ou null.
 */
export function protegerAllie(acteur, combattants, ctx) {
  if (!acteur.protecteur || acteur.pvActuels <= 0) {
    return null;
  }
  const allies = vivants(combattants).filter(
    (combattant) => combattant.camp === acteur.camp && !combattant.estLance && !combattant.estEgide,
  );
  const cible = allies.sort(
    (premier, second) =>
      premier.pvActuels / premier.pvMax - second.pvActuels / second.pvMax ||
      premier.position - second.position,
  )[0];
  if (!cible) {
    return null;
  }
  const montant = Math.max(1, Math.round(cible.pvMax * acteur.protecteur));
  cible.bouclier = (cible.bouclier ?? 0) + montant;
  (cible.boucliersTemporaires ??= []).push({ montant, tours: 2 });
  ctx.log(
    `🛡️ ${acteur.nom} protège ${cible.ref === acteur.ref ? `lui-même` : cible.nom} : bouclier de ${montant}.`,
  );
  return cible;
}
/**
 * Début du tour d'un boss : relâche une frappe préparée (ou constate qu'elle est interrompue), puis
 * déclenche la capacité si c'est son tour. Renvoie { passeTour } quand le boss se concentre et ne
 * lance aucun sort ce tour-ci. `assomme` : le boss passe son tour (la concentration est perdue).
 */
export function declencherCapaciteBoss(boss, combattants, ctx, { assomme = false } = {}) {
  const capacite = boss.capacite;
  if (!capacite || boss.pvActuels <= 0) {
    return { passeTour: false };
  }
  const charge = boss.capaciteEnCharge;
  if (charge) {
    boss.capaciteEnCharge = null;
    const perdus = charge.pv - boss.pvActuels;
    if (assomme) {
      ctx.log(`💫 ${boss.nom} est assommé : ${capacite.nom} se dissipe !`);
    } else if (perdus >= charge.seuil) {
      ctx.log(
        `✋ ${boss.nom} est interrompu (${perdus} PV perdus pendant sa concentration) : ${capacite.nom} échoue !`,
      );
    } else {
      frapper(boss, capacite, combattants, ctx);
    }
    return { passeTour: false };
  }
  if (assomme || !tourDeCapacite(capacite, boss.toursJoues ?? 1)) {
    return { passeTour: false };
  }
  let reussi = false;
  switch (capacite.type) {
    case `invocation`:
      reussi = invoquer(boss, capacite, combattants, ctx);
      break;
    case `bouclier`:
      reussi = bouclierDeZone(boss, capacite, combattants, ctx);
      break;
    case `bourrasque`:
      reussi = bourrasque(boss, capacite, combattants, ctx);
      break;
    case `telegraphe`: {
      const seuil = seuilInterruption(boss);
      boss.capaciteEnCharge = { pv: boss.pvActuels, seuil };
      ctx.log(
        `⚠️ ${boss.nom} se concentre sur ${capacite.nom} : au début de son prochain tour, ${TEXTES_CIBLE_TELEGRAPHE[capacite.cible] ?? TEXTES_CIBLE_TELEGRAPHE.equipe} subira une lourde frappe. Retire-lui ${seuil} PV d'ici là (ou assomme-le) pour l'interrompre !`,
        { alerte: boss.ref },
      );
      return { passeTour: true };
    }
  }
  if (reussi && capacite.pa) {
    boss.paActuels = Math.max(0, boss.paActuels - capacite.pa);
  }
  return { passeTour: false };
}
