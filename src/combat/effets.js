import { MONSTRES } from "../data/index.js";
import { boucliersDorigami, verifierDofusArgente } from "../jeu/progression.js";
import {
  aFriction,
  alliesVivants,
  appliquerEffet,
  calculerDegatsDetail,
  chanceEsquive,
  desenvouter,
  enLigneAvant,
  etatCombatInitial,
  logDegats,
  multiplicateurSoinDe,
  recalculerPvMax,
  reliquesActivesDe,
  sommeEffets,
  trouverParRef,
  vivants,
} from "./stats.js";
import { declencherPiege } from "./sorts.js";
import { effetRun } from "./ameliorations.js";
// Libellé lisible d'un renfort de rangée pour le journal (« +10 % de dégâts (1 tour) »).
const NOMS_EFFETS_RANGEE = {
  degatsInfliges: [`de dégâts`, true],
  resAll: [`de résistance`, true],
  esquive: [`d'esquive`, true],
  reductionDegats: [`de dégâts subis en moins`, true],
  vitalite: [`PV max`, false],
  armure: [`d'armure`, false],
  initiative: [`d'initiative`, false],
};
function libelleEffetRangee(stat, valeur, duree) {
  const [nom, pct] = NOMS_EFFETS_RANGEE[stat] ?? [stat, false];
  const texte = pct ? `${Math.round(valeur * 100)} %` : `${Math.round(valeur)}`;
  return `${valeur >= 0 ? `+` : ``}${texte} ${nom} (${duree} tour${duree > 1 ? `s` : ``})`;
}
export function infligerDegats(
  cible,
  montant,
  attaquant,
  ctx,
  ignoreBouclier,
  dejaRedirige,
  element,
) {
  if (cible.estLance) {
    if (cible.pvActuels <= 0) {
      return;
    }
    --cible.pvActuels;
    ctx?.log(`🔱 La lance encaisse (${Math.max(0, cible.pvActuels)}/2).`);
    if (cible.pvActuels <= 0) {
      cible.pvActuels = 0;
      let lanceur = ctx?.combatants && trouverParRef(ctx.combatants, cible.lanceurRef ?? ``);
      if (lanceur && lanceur.pvActuels > 0) {
        let gain = Math.round(16 * multiplicateurSoinDe(lanceur));
        lanceur.bouclier += gain;
        ctx?.log(
          `🔱 La lance de ${lanceur.nom} vole en éclats : ${lanceur.nom} gagne ${gain} bouclier.`,
        );
      }
    }
    return;
  }
  if (!dejaRedirige && montant > 0 && ctx?.combatants && !cible.estInvocation) {
    let egide = ctx.combatants.find(
      (combattant) =>
        combattant.estEgide &&
        combattant.pvActuels > 0 &&
        combattant.camp === cible.camp &&
        enLigneAvant(combattant) === enLigneAvant(cible),
    );
    if (egide) {
      ctx.log(`🛡️ L'Égide encaisse le coup destiné à ${cible.nom}.`);
      infligerDegats(egide, montant, attaquant, ctx, false, true, element);
      return;
    }
  }
  if (!dejaRedirige && montant > 0 && cible.nullifieProchainCoup) {
    cible.nullifieProchainCoup = false;
    ctx?.log(`${cible.nom} annule le coup grâce à sa nullification !`);
    montant = 0;
  }
  // relique de run : le premier coup ennemi reçu par chaque héros est réduit
  const reductionPremierCoup = effetRun(cible, `premierCoupReduit`);
  if (
    !dejaRedirige &&
    montant > 0 &&
    reductionPremierCoup &&
    !cible.premierCoupEncaisse &&
    attaquant &&
    attaquant.camp !== cible.camp
  ) {
    cible.premierCoupEncaisse = true;
    montant = Math.round(montant * (1 - reductionPremierCoup));
    ctx?.log(
      `🐞 ${cible.nom} amortit le premier coup (−${Math.round(reductionPremierCoup * 100)} %).`,
    );
  }
  if (!dejaRedirige && montant > 0 && (cible.coupsAnnulesRestants ?? 0) > 0) {
    --cible.coupsAnnulesRestants;
    ctx?.log(
      `${cible.nom} encaisse sans broncher (${cible.coupsAnnulesRestants} annulation(s) restante(s)).`,
    );
    montant = 0;
  }
  if (
    !dejaRedirige &&
    montant > 0 &&
    ctx?.combatants &&
    cible.camp === `joueur` &&
    !enLigneAvant(cible)
  ) {
    let protecteur = vivants(ctx.combatants).find(
      (combattant) =>
        combattant.camp === cible.camp &&
        combattant.ref !== cible.ref &&
        combattant.redirection &&
        combattant.redirection.tours > 0,
    );
    if (protecteur) {
      let restant = montant;
      if (cible.bouclier > 0 && !ignoreBouclier) {
        let absorbe = Math.min(cible.bouclier, restant);
        cible.bouclier -= absorbe;
        restant -= absorbe;
      }
      let ratio = protecteur.redirection.ratio;
      let devie = Math.floor(restant * ratio);
      let garde = Math.ceil(restant * (1 - ratio));
      ctx.log(`🌀 ${protecteur.nom} dévie une partie du coup destiné à ${cible.nom}.`);
      infligerDegats(protecteur, devie, attaquant, ctx, false, true, element);
      montant = garde;
      ignoreBouclier = true;
    }
  }
  attaquant && montant > 0 && ctx?.onDegats?.(attaquant.ref, montant);
  attaquant &&
    montant > 0 &&
    ctx?.onEvenement?.({
      type: `degats`,
      attaquantRef: attaquant.ref,
      cibleRef: cible.ref,
      montant,
      element,
    });
  if (
    attaquant &&
    montant > 0 &&
    (ctx?.tourDeRef === undefined || attaquant.ref === ctx.tourDeRef)
  ) {
    attaquant.aFrappeCeTour = true;
  }
  let etaitVivant = cible.pvActuels > 0;
  let aInfliger = montant;
  if (cible.bouclier > 0 && !ignoreBouclier) {
    let absorbe = Math.min(cible.bouclier, aInfliger);
    cible.bouclier -= absorbe;
    aInfliger -= absorbe;
    // les boucliers temporaires absorbent en premier : à leur expiration, on ne retire que ce qu'il en reste
    let reste = absorbe;
    for (let temporaire of cible.boucliersTemporaires ?? []) {
      let pris = Math.min(temporaire.montant, reste);
      temporaire.montant -= pris;
      reste -= pris;
    }
  }
  cible.pvActuels = Math.max(0, cible.pvActuels - aInfliger);
  // Dokille : le premier héros qui tombe sous un coup reste debout, une fois par combat
  if (
    etaitVivant &&
    cible.pvActuels <= 0 &&
    ctx &&
    !ctx.dokilleUtilise &&
    !cible.estInvocation &&
    !cible.creature &&
    reliquesActivesDe(cible, ctx).has(`dokille`)
  ) {
    ctx.dokilleUtilise = true;
    cible.pvActuels = 1;
    ctx.log(`💀 Le Dokille retient ${cible.nom} : il reste debout avec 1 PV !`);
  }
  // relique de run : un K.O. par combat est annulé (le héros reste à 1 PV)
  if (
    etaitVivant &&
    cible.pvActuels <= 0 &&
    ctx &&
    !ctx.koRunAnnule &&
    !cible.estInvocation &&
    !cible.creature &&
    effetRun(cible, `koAnnule`)
  ) {
    ctx.koRunAnnule = true;
    cible.pvActuels = 1;
    ctx.log(`🔥 La Plume de Phénix relève ${cible.nom} : il reste debout avec 1 PV !`);
  }
  verifierDofusArgente(cible, reliquesActivesDe(cible, ctx ?? {}));
  verifierRenaissance(cible, ctx);
  etaitVivant &&
    cible.pvActuels <= 0 &&
    ctx?.onEvenement?.({
      type: `mort`,
      ref: cible.ref,
    });
  if (
    etaitVivant &&
    cible.pvActuels <= 0 &&
    attaquant &&
    ctx?.combatants &&
    attaquant.camp !== cible.camp &&
    attaquant.pvActuels > 0
  ) {
    appliquerSoinsEtBoucliers(
      boucliersDorigami(attaquant, reliquesActivesDe(attaquant, ctx)),
      ctx.combatants,
      ctx,
    );
    // relique de run : achever un ennemi donne un bouclier
    const bouclierKo = effetRun(attaquant, `bouclierSurKO`);
    if (bouclierKo) {
      const gain = Math.round(attaquant.pvMax * bouclierKo);
      attaquant.bouclier = (attaquant.bouclier ?? 0) + gain;
      ctx.log(`🏆 ${attaquant.nom} gagne un bouclier de ${gain} en achevant ${cible.nom}.`);
    }
  }
  // relique de run : une partie des dégâts subis par un héros revient à l'ennemi qui frappe
  const renvoi = effetRun(cible, `renvoiDegats`);
  if (
    renvoi &&
    attaquant &&
    ctx &&
    !ctx.enRenvoi &&
    aInfliger > 0 &&
    attaquant.camp !== cible.camp &&
    attaquant.pvActuels > 0
  ) {
    const retour = Math.round(aInfliger * renvoi);
    if (retour > 0) {
      ctx.enRenvoi = true;
      try {
        infligerDegats(attaquant, retour, undefined, ctx);
      } finally {
        ctx.enRenvoi = false;
      }
      ctx.log(`🌵 Les ronces renvoient ${retour} dégâts à ${attaquant.nom}.`);
    }
  }
  if (cible.soinDegatsRecus && montant > 0 && cible.pvActuels > 0) {
    let soinGoyave = Math.round(montant * cible.soinDegatsRecus);
    if (soinGoyave > 0) {
      cible.pvActuels = Math.min(cible.pvMax, cible.pvActuels + soinGoyave);
      ctx?.log(`${cible.nom} récupère ${soinGoyave} PV (Goyave).`);
    }
  }
  if (attaquant && ctx && montant > 0 && attaquant.pvActuels > 0) {
    let proie = sommeEffets(cible, `proie`);
    if (proie > 0) {
      let vol = Math.round(montant * proie);
      if (vol > 0) {
        attaquant.pvActuels = Math.min(attaquant.pvMax, attaquant.pvActuels + vol);
        ctx.log(`${attaquant.nom} dévore sa proie : +${vol} PV.`);
      }
    }
  }
  let chanceContre =
    attaquant && ctx
      ? sommeEffets(cible, `contre`) + (enLigneAvant(cible) ? (cible.riposteAvant ?? 0) : 0)
      : 0;
  if (
    attaquant &&
    ctx &&
    !ctx.enRiposte &&
    montant > 0 &&
    cible.pvActuels > 0 &&
    attaquant.pvActuels > 0 &&
    attaquant.camp !== cible.camp &&
    chanceContre > 0 &&
    ctx.rng() < chanceContre
  ) {
    let riposte = calculerDegatsDetail(
      cible,
      {
        baseMin: 8,
        baseMax: 12,
      },
      attaquant,
      {
        useMax: false,
        mult: 1,
        ctx,
      },
    );
    // pas de riposte à une riposte
    ctx.enRiposte = true;
    try {
      infligerDegats(attaquant, riposte.dmg, cible, ctx, undefined, undefined, riposte.element);
    } finally {
      ctx.enRiposte = false;
    }
    logDegats(ctx, `${cible.nom} riposte : `, riposte.dmg, riposte.element, ` à ${attaquant.nom}.`);
  }
}
export function caseOpposeeLibre(combattant, combattants) {
  let occupees = new Set(
    vivants(combattants)
      .filter((autre) => autre.camp === combattant.camp)
      .map((autre) => autre.position),
  );
  let [debut, fin] = enLigneAvant(combattant) ? [4, 7] : [0, 3];
  let positionOpposee = enLigneAvant(combattant)
    ? combattant.position + 4
    : combattant.position - 4;
  if (!occupees.has(positionOpposee)) {
    return positionOpposee;
  }
  for (let position = debut; position <= fin; position++) {
    if (!occupees.has(position)) {
      return position;
    }
  }
  return null;
}
export function caseLibreSurLigne(camp, ligneAvant, combattants) {
  let occupees = new Set(
    vivants(combattants)
      .filter((combattant) => combattant.camp === camp)
      .map((combattant) => combattant.position),
  );
  let [debut, fin] = ligneAvant ? [0, 3] : [4, 7];
  for (let position = debut; position <= fin; position++) {
    if (!occupees.has(position)) {
      return position;
    }
  }
  return null;
}
export function repousser(cible, direction, combattants, contexte) {
  if (direction === `arriere` && !enLigneAvant(cible)) {
    return;
  }
  let position = caseOpposeeLibre(cible, combattants);
  if (position !== null) {
    cible.position = position;
    contexte.log(`${cible.nom} est repoussé en ligne ${position < 4 ? `AVANT` : `ARRIÈRE`}.`);
    declencherPiege(cible, combattants, contexte);
  }
}
export function plusProches(cible, candidats, nombre) {
  let colonne = cible.position % 4;
  return [...candidats]
    .sort(
      (premier, second) =>
        Math.abs((premier.position % 4) - colonne) - Math.abs((second.position % 4) - colonne),
    )
    .slice(0, nombre);
}
export function allieDerriere(combattant, combattants) {
  if (!enLigneAvant(combattant)) {
    return null;
  }
  let derriere = vivants(combattants).filter(
    (autre) => autre.camp === combattant.camp && !enLigneAvant(autre),
  );
  if (derriere.length) {
    return derriere.sort(
      (premier, second) =>
        Math.abs(premier.position - 4 - combattant.position) -
        Math.abs(second.position - 4 - combattant.position),
    )[0];
  }
  return null;
}
function verifierRenaissance(combattant, contexte) {
  if (!(
    combattant.pvActuels > 0 ||
    !combattant.renaissance ||
    !(combattant.renaissancesRestantes ?? 0)
  )) {
    combattant.renaissancesRestantes = (combattant.renaissancesRestantes ?? 1) - 1;
    combattant.pvActuels = Math.max(1, Math.round(combattant.pvMax * combattant.renaissance));
    combattant.bombes = 0;
    combattant.telefrags = 0;
    contexte?.log(`🥚 ${combattant.nom} renaît de son Kwakwanneau à ${combattant.pvActuels} PV !`);
  }
}
function voisinSuivant(combattant, combattants) {
  return vivants(combattants)
    .filter((autre) => autre.camp === combattant.camp && autre.position > combattant.position)
    .sort((premier, second) => premier.position - second.position)[0];
}
export function retirerPA(combattant, nombre, contexte) {
  let paAvant = combattant.paActuels;
  combattant.paActuels = Math.max(0, combattant.paActuels - nombre);
  if (combattant.paActuels < paAvant) {
    contexte.log(`${combattant.nom} perd ${paAvant - combattant.paActuels} PA.`);
  }
}
const EFFETS_DECOMPTES_DEBUT_TOUR = [`paParTour`, `hot`, `bonusPieges`];
export function debutTourEffets(combattant, combattants, contexte) {
  if (combattant.paBonusNextTurn !== 0) {
    combattant.paActuels = Math.max(0, combattant.paActuels + combattant.paBonusNextTurn);
    if (combattant.paBonusNextTurn > 0) {
      contexte.log(`${combattant.nom} gagne ${combattant.paBonusNextTurn} PA.`);
    } else {
      contexte.log(`${combattant.nom} perd ${-combattant.paBonusNextTurn} PA.`);
    }
    combattant.paBonusNextTurn = 0;
  }
  for (let effet of combattant.effets.filter((candidat) => candidat.stat === `paParTour`)) {
    combattant.paActuels += effet.valeur;
    contexte.log(`${combattant.nom} gagne ${effet.valeur} PA (effet de ligne).`);
    --effet.toursRestants;
  }
  for (let effet of combattant.effets.filter((candidat) => candidat.stat === `poison`)) {
    combattant.pvActuels = Math.max(0, combattant.pvActuels - effet.valeur);
    contexte.log(`${combattant.nom} subit ${effet.valeur} dégâts de poison.`);
  }
  verifierDofusArgente(combattant, reliquesActivesDe(combattant, contexte));
  verifierRenaissance(combattant, contexte);
  if (combattant.pvActuels <= 0) {
    contexte.onEvenement?.({
      type: `mort`,
      ref: combattant.ref,
    });
    contexte.log(`${combattant.nom} succombe au poison !`);
    let suivant = voisinSuivant(combattant, combattants);
    for (let effet of combattant.effets.filter(
      (candidat) => candidat.stat === `poison` && candidat.transmet,
    )) {
      if (suivant) {
        suivant.effets.push({
          stat: `poison`,
          valeur: effet.valeur,
          toursRestants: effet.toursRestants,
          transmet: true,
        });
        contexte.log(`Le poison se transmet à ${suivant.nom} !`);
      }
    }
    return true;
  }
  for (let effet of combattant.effets.filter((candidat) => candidat.stat === `hot`)) {
    if (!aFriction(combattant)) {
      let pvAvant = combattant.pvActuels;
      combattant.pvActuels = Math.min(combattant.pvMax, combattant.pvActuels + effet.valeur);
      if (combattant.pvActuels > pvAvant) {
        contexte.log(`${combattant.nom} régénère ${combattant.pvActuels - pvAvant} PV.`);
        contexte.onEvenement?.({
          type: `soin`,
          cibleRef: combattant.ref,
          montant: combattant.pvActuels - pvAvant,
        });
      }
    }
    --effet.toursRestants;
  }
  for (let effet of combattant.effets.filter((candidat) => candidat.stat === `bonusPieges`)) {
    --effet.toursRestants;
  }
  combattant.effets = combattant.effets.filter(
    (effet) => !(EFFETS_DECOMPTES_DEBUT_TOUR.includes(effet.stat) && effet.toursRestants <= 0),
  );
  if (combattant.boucliersTemporaires?.length) {
    for (let bouclier of combattant.boucliersTemporaires) {
      --bouclier.tours;
    }
    let expires = combattant.boucliersTemporaires.filter((bouclier) => bouclier.tours <= 0);
    for (let expire of expires) {
      let retire = Math.min(expire.montant, combattant.bouclier);
      combattant.bouclier -= retire;
      if (retire > 0) {
        contexte.log(`Le bouclier temporaire de ${combattant.nom} s'estompe (−${retire}).`);
      }
    }
    combattant.boucliersTemporaires = combattant.boucliersTemporaires.filter(
      (bouclier) => bouclier.tours > 0,
    );
  }
  return false;
}
export function finTourEffets(combattant) {
  let vitaliteExpiree = false;
  combattant.effets.forEach((effet) => {
    EFFETS_DECOMPTES_DEBUT_TOUR.includes(effet.stat) ||
      (--effet.toursRestants,
      effet.toursRestants <= 0 && effet.stat === `vitalite` && (vitaliteExpiree = true));
  });
  combattant.effets = combattant.effets.filter((effet) => effet.toursRestants > 0);
  if (vitaliteExpiree) {
    recalculerPvMax(combattant);
  }
  combattant.resquilleActive = undefined;
  combattant.redirection &&
    (combattant.redirectionPoseCeTour
      ? (combattant.redirectionPoseCeTour = false)
      : --combattant.redirection.tours <= 0 && (combattant.redirection = undefined));
  for (let cle of Object.keys(combattant.cooldowns)) {
    if (combattant.cooldownsPosesCeTour?.has(cle)) {
      combattant.cooldownsPosesCeTour.delete(cle);
      continue;
    }
    --combattant.cooldowns[cle];
    combattant.cooldowns[cle] <= 0 && delete combattant.cooldowns[cle];
  }
}
export const consommerMaxRoll = (combattant) => {
  if (combattant.maxRollCharges > 0) {
    return (--combattant.maxRollCharges, true);
  }
  return false;
};
export function soigner(cible, montant, contexte) {
  if (aFriction(cible)) {
    contexte.log(`${cible.nom} ne peut pas être soigné (friction).`);
    return false;
  }
  let pvAvant = cible.pvActuels;
  cible.pvActuels = Math.min(cible.pvMax, cible.pvActuels + montant);
  let gain = cible.pvActuels - pvAvant;
  if (gain > 0) {
    contexte.log(`${cible.nom} récupère ${gain} PV.`);
    contexte.onEvenement?.({
      type: `soin`,
      cibleRef: cible.ref,
      montant: gain,
    });
  }
  return true;
}
export function soignerPlusBlesse(allies, ratio, degats, lanceur, contexte) {
  let plusBlesse = [...allies].sort(
    (premier, second) => premier.pvActuels / premier.pvMax - second.pvActuels / second.pvMax,
  )[0];
  if (!(!plusBlesse || plusBlesse.pvActuels >= plusBlesse.pvMax)) {
    soigner(plusBlesse, Math.round(degats * ratio * multiplicateurSoinDe(lanceur)), contexte);
  }
}
export function appliquerSoinsEtBoucliers(resultat, combattants, contexte) {
  for (let soin of resultat.soins) {
    let cible = trouverParRef(combattants, soin.ref);
    !cible ||
      cible.pvActuels <= 0 ||
      (soigner(cible, soin.montant, contexte) &&
        (soin.argenteConsume && ((cible.argenteArme = undefined), (cible.argenteUtilise = true)),
        soin.veilleursConsume && (cible.veilleursRecuCeTour = true)));
  }
  for (let bouclier of resultat.boucliers) {
    let cible = trouverParRef(combattants, bouclier.ref);
    if (!(!cible || cible.pvActuels <= 0 || aFriction(cible))) {
      cible.bouclier += bouclier.montant;
      (cible.boucliersTemporaires ??= []).push({
        montant: bouclier.montant,
        tours: bouclier.tours,
      });
      contexte.log(`${cible.nom} gagne un bouclier de ${bouclier.montant}.`);
    }
  }
}
export function ciblesBouclierGroupe(lanceur, combattants, portee) {
  switch (portee) {
    case `soi`:
      return [lanceur];
    case `rangee_lanceur`:
      return alliesVivants(lanceur, combattants).filter(
        (allie) => enLigneAvant(allie) === enLigneAvant(lanceur),
      );
    case `rangee_avant`:
      return alliesVivants(lanceur, combattants).filter(enLigneAvant);
  }
}
export function bouclierGroupe(lanceur, combattants, portee, pct, tours, contexte) {
  for (let cible of ciblesBouclierGroupe(lanceur, combattants, portee)) {
    if (aFriction(cible)) {
      continue;
    }
    let montant = Math.round(cible.pvMax * pct);
    cible.bouclier += montant;
    contexte.log(`${cible.nom} gagne un bouclier de ${montant}.`);
    if (tours) {
      (cible.boucliersTemporaires ??= []).push({
        montant,
        tours,
      });
    }
  }
}
export function ciblesSoutien(sort, lanceur, cible, combattants) {
  if (sort.cible === `allie_tous`) {
    return alliesVivants(lanceur, combattants);
  }
  if (cible) {
    return [cible];
  }
  return [];
}
export const aBonusSiCrit = (sort) => !!(sort.bouclierPctSiCrit || sort.tiragesSiCrit);
export function descriptionBuff(buff) {
  if (buff.bouclierPct) {
    return `bouclier (${Math.round(buff.bouclierPct * 100)} % PV max)`;
  }
  if (buff.effet) {
    return `${buff.effet.stat} ${buff.effet.valeur >= 0 ? `+` : ``}${buff.effet.valeur}`;
  }
  return `effet`;
}
export function appliquerSoutien(sort, cible, lanceur, contexte, critique = false) {
  if (sort.dissipe) {
    let nbAvant = cible.effets.length;
    cible.effets = cible.effets.filter(
      (effet) => effet.stat !== `poison` && effet.stat !== `degatsInfliges`,
    );
    if (cible.effets.length < nbAvant) {
      contexte.log(`${cible.nom} est purgé de ses effets négatifs.`);
    }
  }
  if (sort.bouclierPct && !aFriction(cible)) {
    let pct = critique && sort.bouclierPctSiCrit ? sort.bouclierPctSiCrit : sort.bouclierPct;
    let montant = Math.round(cible.pvMax * pct);
    cible.bouclier += montant;
    contexte.log(`${cible.nom} gagne un bouclier de ${montant}.`);
    if (sort.bouclierTours) {
      (cible.boucliersTemporaires ??= []).push({
        montant,
        tours: sort.bouclierTours,
      });
    }
  }
  if (sort.hotPct && !aFriction(cible)) {
    appliquerEffet(cible, {
      stat: `hot`,
      valeur: Math.max(1, Math.round(cible.pvMax * sort.hotPct * multiplicateurSoinDe(lanceur))),
      duree: sort.hotDuree ?? 2,
    });
  }
  if (sort.paGain) {
    cible.paBonusNextTurn += sort.paGain;
    contexte.log(`${cible.nom} recevra ${sort.paGain} PA au prochain tour.`);
  }
  if (sort.paImmediat) {
    cible.paActuels += sort.paImmediat;
    contexte.log(`${cible.nom} gagne ${sort.paImmediat} PA pour ce tour.`);
  }
  if (sort.paProchainTour) {
    cible.paBonusNextTurn = Math.max(cible.paBonusNextTurn, sort.paProchainTour);
    contexte.log(
      `${cible.nom} anticipe : +${sort.paProchainTour} PA au prochain tour (Prémonition).`,
    );
  }
  if (sort.bonusProchainSortPct) {
    cible.bonusOffensifProchain += sort.bonusProchainSortPct;
    contexte.log(
      `${cible.nom} prépare un sort renforcé (+${Math.round(sort.bonusProchainSortPct * 100)} %).`,
    );
  }
  if (sort.effet) {
    // un sort non cumulable rafraîchit la durée de l'effet déjà en place au lieu de l'empiler
    let present = sort.nonCumulable
      ? cible.effets.find((existant) => existant.stat === sort.effet.stat)
      : undefined;
    if (present) {
      present.toursRestants = Math.max(present.toursRestants, sort.effet.duree);
    } else {
      appliquerEffet(cible, sort.effet);
    }
  }
  if (sort.dissipePositifs) {
    desenvouter(cible, contexte);
  }
  if (sort.nullifieProchain) {
    cible.nullifieProchainCoup = true;
    contexte.log(`${cible.nom} se prépare à annuler le prochain coup direct.`);
  }
  if (sort.resquille) {
    cible.resquilleActive = sort.resquille;
    contexte.log(`${cible.nom} prépare une Resquille (−${sort.resquille} PA au prochain Kaboom).`);
  }
  if (sort.bonusPieges) {
    appliquerEffet(lanceur, {
      stat: `bonusPieges`,
      valeur: sort.bonusPieges,
      duree: sort.bonusPiegesDuree ?? 1,
    });
    contexte.log(
      `${lanceur.nom} concentre son Chakra : pièges +${Math.round(sort.bonusPieges * 100)} % (${sort.bonusPiegesDuree ?? 1}t).`,
    );
  }
}
function deuxDevant(combattant, combattants) {
  return (
    vivants(combattants).filter(
      (autre) => autre.camp === combattant.camp && enLigneAvant(autre) && !autre.estInvocation,
    ).length >= 2
  );
}
export function membresRangee(combattant, buff, combattants) {
  let avant = buff.rangee === `avant`;
  return vivants(combattants).filter(
    (autre) =>
      autre.camp === combattant.camp && enLigneAvant(autre) === avant && !autre.estInvocation,
  );
}
export function buffRangee(lanceur, buff, combattants, contexte) {
  let membres = membresRangee(lanceur, buff, combattants);
  if (!membres.length) {
    return;
  }
  let avant = buff.rangee === `avant`;
  let renfort = deuxDevant(lanceur, combattants);
  let libelles = [];
  for (let effet of buff.effets) {
    let valeur =
      renfort && effet.valeurSiDeuxDevant !== undefined ? effet.valeurSiDeuxDevant : effet.valeur;
    libelles.push(libelleEffetRangee(effet.stat, valeur, effet.duree));
    for (let membre of membres) {
      if (effet.stat === `maxRoll`) {
        membre.maxRollCharges += valeur;
        continue;
      }
      let existant = membre.effets.find(
        (effetMembre) => effetMembre.stat === effet.stat && effetMembre.viaBuffRangee,
      );
      if (existant) {
        existant.valeur = valeur;
        existant.toursRestants = effet.duree;
      } else {
        membre.effets.push({
          stat: effet.stat,
          valeur,
          toursRestants: effet.duree,
          viaBuffRangee: true,
        });
      }
      if (effet.stat === `vitalite`) {
        recalculerPvMax(membre);
      }
    }
  }
  let renfortPresent = buff.effets.some((effet) => effet.valeurSiDeuxDevant !== undefined);
  contexte.log(
    `${lanceur.nom} renforce la rangée ${avant ? `avant` : `arrière`} : ${libelles.join(`, `)}${renfort && renfortPresent ? ` (renfort à deux)` : ``}.`,
  );
}
export function brumeRangee(lanceur, cible, toursRestants, combattants, contexte) {
  let esquive = chanceEsquive(lanceur, {
    sansBonusPosition: true,
    sansViaBrume: true,
    sansPlafond: true,
  });
  let allies = alliesVivants(lanceur, combattants).filter(
    (allie) => enLigneAvant(allie) === enLigneAvant(cible),
  );
  for (let allie of allies) {
    allie.effets.push({
      stat: `esquive`,
      valeur: esquive,
      toursRestants,
      viaBrume: true,
    });
  }
  contexte.log(
    `${lanceur.nom} enveloppe la rangée ${enLigneAvant(cible) ? `avant` : `arrière`} d'une Brume (+${Math.round(esquive * 100)} % d'esquive, ${toursRestants}t).`,
  );
}
export function invoquerPoupee(lanceur, poupee, combattants, contexte) {
  let ref = `poupee_${lanceur.ref}`;
  if (combattants.some((combattant) => combattant.ref === ref && combattant.pvActuels > 0)) {
    contexte.log(`${lanceur.nom} a déjà ${poupee.article ?? `une`} ${poupee.nom} active.`);
    return;
  }
  // place libre, de préférence en ligne avant (la poupée provoque et encaisse)
  let prises = new Set(
    vivants(combattants)
      .filter((combattant) => combattant.camp === lanceur.camp)
      .map((combattant) => combattant.position),
  );
  let position = [0, 1, 2, 3, 4, 5, 6, 7].find((place) => !prises.has(place));
  if (position === undefined) {
    contexte.log(`L'invocation de ${lanceur.nom} échoue (plus de place).`);
    return;
  }
  let indice = combattants.findIndex((combattant) => combattant.ref === ref);
  if (indice >= 0) {
    combattants.splice(indice, 1);
  }
  let pv = poupee.pvPct ? Math.max(10, Math.round(lanceur.pvMax * poupee.pvPct)) : poupee.pv;
  combattants.push({
    ref,
    nom: poupee.nom,
    pvBase: pv,
    pvMax: pv,
    pvActuels: pv,
    stats: {
      force: 0,
      intelligence: 0,
      agilite: 0,
      vitalite: pv,
    },
    paMax: 0,
    paActuels: 0,
    initiative: 0,
    resistances: { ...(poupee.resistances ?? {}) },
    sorts: [],
    camp: lanceur.camp,
    position,
    niveau: 1,
    img: poupee.img ?? `/assets/divers/poupee.png`,
    ...etatCombatInitial(),
    estInvocation: true,
    joueTour: false,
    provoque: poupee.provoque,
    invoquePar: lanceur.ref,
  });
  contexte.log(
    `${lanceur.nom} invoque ${poupee.article ?? `une`} ${poupee.nom} (${pv} PV) qui provoque les ennemis.`,
  );
}
export function planterLance(lanceur, cible, combattants, contexte) {
  let ref = `lance_${lanceur.ref}`;
  if (vivants(combattants).some((combattant) => combattant.ref === ref)) {
    return null;
  }
  let [debut, fin] = enLigneAvant(cible) ? [0, 3] : [4, 7];
  let occupees = new Set(
    vivants(combattants)
      .filter((combattant) => combattant.camp === `ennemi`)
      .map((combattant) => combattant.position),
  );
  let colonne = cible.position % 4;
  let meilleure = null;
  let distanceMin = Infinity;
  for (let position = debut; position <= fin; position++) {
    if (occupees.has(position)) {
      continue;
    }
    let distance = Math.abs((position % 4) - colonne);
    if (distance < distanceMin) {
      distanceMin = distance;
      meilleure = position;
    }
  }
  if (meilleure === null) {
    return null;
  }
  let indice = combattants.findIndex((combattant) => combattant.ref === ref);
  if (indice >= 0) {
    combattants.splice(indice, 1);
  }
  let lance = {
    ref,
    nom: `Lance`,
    pvBase: 2,
    pvMax: 2,
    pvActuels: 2,
    stats: {
      force: 0,
      intelligence: 0,
      agilite: 0,
      vitalite: 0,
    },
    paMax: 0,
    paActuels: 0,
    initiative: 0,
    resistances: {},
    sorts: [],
    camp: `ennemi`,
    position: meilleure,
    niveau: 1,
    img: `/assets/spells/forgelance/lance.png`,
    ...etatCombatInitial(),
    estInvocation: true,
    joueTour: false,
    estLance: true,
    lanceurRef: lanceur.ref,
  };
  combattants.push(lance);
  contexte.log(`🔱 ${lanceur.nom} plante une Lance.`);
  return lance;
}
export function invoquerEgide(lanceur, cible, toursRestantsInvocation, combattants, contexte) {
  let ref = `egide_${lanceur.ref}`;
  if (vivants(combattants).some((combattant) => combattant.ref === ref)) {
    return null;
  }
  let position = caseLibreSurLigne(lanceur.camp, enLigneAvant(cible), combattants);
  if (position === null) {
    return null;
  }
  let indice = combattants.findIndex((combattant) => combattant.ref === ref);
  if (indice >= 0) {
    combattants.splice(indice, 1);
  }
  let egide = {
    ref,
    nom: `Égide`,
    pvBase: lanceur.pvMax,
    pvMax: lanceur.pvMax,
    pvActuels: lanceur.pvMax,
    stats: {
      force: 0,
      intelligence: 0,
      agilite: 0,
      vitalite: 0,
    },
    paMax: 0,
    paActuels: 0,
    initiative: 0,
    resistances: {},
    sorts: [],
    camp: lanceur.camp,
    position,
    niveau: 1,
    img: `/assets/spells/feca/egide.png`,
    ...etatCombatInitial(),
    estInvocation: true,
    joueTour: false,
    estEgide: true,
    lanceurRef: lanceur.ref,
    toursRestantsInvocation,
  };
  combattants.push(egide);
  contexte.log(`🛡️ ${lanceur.nom} invoque une Égide (${egide.pvMax} PV) sur sa rangée.`);
  return egide;
}
function premiereCaseLibre(camp, combattants) {
  let occupees = new Set(
    vivants(combattants)
      .filter((combattant) => combattant.camp === camp)
      .map((combattant) => combattant.position),
  );
  for (let position = 0; position < 8; position++) {
    if (!occupees.has(position)) {
      return position;
    }
  }
  return null;
}
function creerInvocation(def, ref, position, camp, invoquePar) {
  return {
    ref,
    nom: def.nom,
    pvBase: def.pv,
    pvMax: def.pv,
    pvActuels: def.pv,
    stats: {
      ...def.stats,
    },
    paMax: def.pa,
    paActuels: def.pa,
    initiative: def.initiative,
    resistances: {
      ...def.resistances,
    },
    sorts: [...def.sorts],
    camp,
    position,
    niveau: 1,
    monstreId: def.id,
    ia: def.ia,
    img: def.img,
    ...etatCombatInitial(),
    invoquePar,
  };
}
const alliesMortsRessuscitables = (lanceur, combattants) =>
  combattants.filter(
    (combattant) =>
      combattant.camp === lanceur.camp &&
      combattant.pvActuels <= 0 &&
      combattant.ref !== lanceur.ref &&
      !combattant.estInvocation &&
      !MONSTRES[combattant.monstreId ?? ``]?.boss,
  );
export function peutInvoquer(lanceur, sort, combattants) {
  if (sort.invoqueMonstre) {
    return (
      vivants(combattants).filter((combattant) => combattant.invoquePar === lanceur.ref).length <
        sort.invoqueMonstre.max && premiereCaseLibre(lanceur.camp, combattants) !== null
    );
  }
  if (sort.ressuscite) {
    return alliesMortsRessuscitables(lanceur, combattants).length > 0;
  }
  return !!sort.invocation;
}
export function invoquerMonstre(lanceur, invoqueMonstre, combattants, contexte) {
  if (
    !peutInvoquer(
      lanceur,
      {
        invoqueMonstre,
      },
      combattants,
    )
  ) {
    contexte.log(`L'invocation de ${lanceur.nom} échoue (plus de place).`);
    return;
  }
  let monstre =
    MONSTRES[invoqueMonstre.pool[Math.floor(contexte.rng() * invoqueMonstre.pool.length)]];
  let position = premiereCaseLibre(lanceur.camp, combattants);
  let ref = `invoc_${lanceur.ref}_${combattants.length}`;
  combattants.push(creerInvocation(monstre, ref, position, lanceur.camp, lanceur.ref));
  contexte.log(`${lanceur.nom} invoque ${monstre.nom} !`);
}
export function ressusciterAllie(lanceur, ressuscite, combattants, contexte) {
  let morts = alliesMortsRessuscitables(lanceur, combattants);
  if (!morts.length) {
    contexte.log(`${lanceur.nom} appelle les morts… mais personne ne répond.`);
    return;
  }
  let allie = morts[Math.floor(contexte.rng() * morts.length)];
  if (
    new Set(
      vivants(combattants)
        .filter((combattant) => combattant.camp === allie.camp)
        .map((combattant) => combattant.position),
    ).has(allie.position)
  ) {
    let place = premiereCaseLibre(allie.camp, combattants);
    if (place === null) {
      contexte.log(`${lanceur.nom} appelle les morts… mais il n'y a plus de place.`);
      return;
    }
    allie.position = place;
  }
  allie.pvActuels = Math.max(1, Math.round(allie.pvMax * ressuscite.pvPct));
  allie.effets = [];
  allie.bouclier = 0;
  allie.bombes = 0;
  allie.telefrags = 0;
  contexte.log(`${lanceur.nom} réinvoque ${allie.nom} d'entre les morts (${allie.pvActuels} PV) !`);
}
