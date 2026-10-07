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
export function infligerDegats(e, t, n, ctx, i, a, element) {
  if (e.estLance) {
    if (e.pvActuels <= 0) {
      return;
    }
    --e.pvActuels;
    ctx?.log(`🔱 La lance encaisse (${Math.max(0, e.pvActuels)}/2).`);
    if (e.pvActuels <= 0) {
      e.pvActuels = 0;
      let t = ctx?.combatants && trouverParRef(ctx.combatants, e.lanceurRef ?? ``);
      if (t && t.pvActuels > 0) {
        let e = Math.round(16 * multiplicateurSoinDe(t));
        t.bouclier += e;
        ctx?.log(`🔱 La lance de ${t.nom} vole en éclats : ${t.nom} gagne ${e} bouclier.`);
      }
    }
    return;
  }
  if (!a && t > 0 && ctx?.combatants && !e.estInvocation) {
    let i = ctx.combatants.find(
      (t) =>
        t.estEgide && t.pvActuels > 0 && t.camp === e.camp && enLigneAvant(t) === enLigneAvant(e),
    );
    if (i) {
      ctx.log(`🛡️ L'Égide encaisse le coup destiné à ${e.nom}.`);
      infligerDegats(i, t, n, ctx, false, true, element);
      return;
    }
  }
  if (!a && t > 0 && e.nullifieProchainCoup) {
    e.nullifieProchainCoup = false;
    ctx?.log(`${e.nom} annule le coup grâce à sa nullification !`);
    t = 0;
  }
  if (!a && t > 0 && (e.coupsAnnulesRestants ?? 0) > 0) {
    --e.coupsAnnulesRestants;
    ctx?.log(
      `${e.nom} encaisse sans broncher (${e.coupsAnnulesRestants} annulation(s) restante(s)).`,
    );
    t = 0;
  }
  if (!a && t > 0 && ctx?.combatants && e.camp === `joueur` && !enLigneAvant(e)) {
    let a = vivants(ctx.combatants).find(
      (t) => t.camp === e.camp && t.ref !== e.ref && t.redirection && t.redirection.tours > 0,
    );
    if (a) {
      let s = t;
      if (e.bouclier > 0 && !i) {
        let t = Math.min(e.bouclier, s);
        e.bouclier -= t;
        s -= t;
      }
      let c = a.redirection.ratio;
      let l = Math.floor(s * c);
      let u = Math.ceil(s * (1 - c));
      ctx.log(`🌀 ${a.nom} dévie une partie du coup destiné à ${e.nom}.`);
      infligerDegats(a, l, n, ctx, false, true, element);
      t = u;
      i = true;
    }
  }
  n && t > 0 && ctx?.onDegats?.(n.ref, t);
  n &&
    t > 0 &&
    ctx?.onEvenement?.({
      type: `degats`,
      attaquantRef: n.ref,
      cibleRef: e.ref,
      montant: t,
      element,
    });
  if (n && t > 0 && (ctx?.tourDeRef === undefined || n.ref === ctx.tourDeRef)) {
    n.aFrappeCeTour = true;
  }
  let s = e.pvActuels > 0;
  let c = t;
  if (e.bouclier > 0 && !i) {
    let t = Math.min(e.bouclier, c);
    e.bouclier -= t;
    c -= t;
  }
  e.pvActuels = Math.max(0, e.pvActuels - c);
  // Dokille : le premier héros qui tombe sous un coup reste debout, une fois par combat
  if (
    s &&
    e.pvActuels <= 0 &&
    ctx &&
    !ctx.dokilleUtilise &&
    !e.estInvocation &&
    !e.creature &&
    reliquesActivesDe(e, ctx).has(`dokille`)
  ) {
    ctx.dokilleUtilise = true;
    e.pvActuels = 1;
    ctx.log(`💀 Le Dokille retient ${e.nom} : il reste debout avec 1 PV !`);
  }
  verifierDofusArgente(e, reliquesActivesDe(e, ctx ?? {}));
  verifierRenaissance(e, ctx);
  s &&
    e.pvActuels <= 0 &&
    ctx?.onEvenement?.({
      type: `mort`,
      ref: e.ref,
    });
  if (s && e.pvActuels <= 0 && n && ctx?.combatants && n.camp !== e.camp && n.pvActuels > 0) {
    appliquerSoinsEtBoucliers(boucliersDorigami(n, reliquesActivesDe(n, ctx)), ctx.combatants, ctx);
  }
  if (e.soinDegatsRecus && t > 0 && e.pvActuels > 0) {
    let n = Math.round(t * e.soinDegatsRecus);
    if (n > 0) {
      e.pvActuels = Math.min(e.pvMax, e.pvActuels + n);
      ctx?.log(`${e.nom} récupère ${n} PV (Goyave).`);
    }
  }
  if (n && ctx && t > 0 && n.pvActuels > 0) {
    let i = sommeEffets(e, `proie`);
    if (i > 0) {
      let e = Math.round(t * i);
      if (e > 0) {
        n.pvActuels = Math.min(n.pvMax, n.pvActuels + e);
        ctx.log(`${n.nom} dévore sa proie : +${e} PV.`);
      }
    }
  }
  let l = n && ctx ? sommeEffets(e, `contre`) + (enLigneAvant(e) ? (e.riposteAvant ?? 0) : 0) : 0;
  if (
    n &&
    ctx &&
    t > 0 &&
    e.pvActuels > 0 &&
    n.pvActuels > 0 &&
    n.camp !== e.camp &&
    l > 0 &&
    ctx.rng() < l
  ) {
    let t = calculerDegatsDetail(
      e,
      {
        baseMin: 8,
        baseMax: 12,
      },
      n,
      {
        useMax: false,
        mult: 1,
        ctx,
      },
    );
    infligerDegats(n, t.dmg);
    logDegats(ctx, `${e.nom} riposte : `, t.dmg, t.element, ` à ${n.nom}.`);
  }
}
export function caseOpposeeLibre(e, t) {
  let n = new Set(
    vivants(t)
      .filter((t) => t.camp === e.camp)
      .map((e) => e.position),
  );
  let [r, i] = enLigneAvant(e) ? [4, 7] : [0, 3];
  let a = enLigneAvant(e) ? e.position + 4 : e.position - 4;
  if (!n.has(a)) {
    return a;
  }
  for (let e = r; e <= i; e++) {
    if (!n.has(e)) {
      return e;
    }
  }
  return null;
}
export function caseLibreSurLigne(e, t, n) {
  let r = new Set(
    vivants(n)
      .filter((t) => t.camp === e)
      .map((e) => e.position),
  );
  let [i, a] = t ? [0, 3] : [4, 7];
  for (let e = i; e <= a; e++) {
    if (!r.has(e)) {
      return e;
    }
  }
  return null;
}
export function repousser(e, t, n, r) {
  if (t === `arriere` && !enLigneAvant(e)) {
    return;
  }
  let i = caseOpposeeLibre(e, n);
  if (i !== null) {
    e.position = i;
    r.log(`${e.nom} est repoussé en ligne ${i < 4 ? `AVANT` : `ARRIÈRE`}.`);
    declencherPiege(e, n, r);
  }
}
export function plusProches(e, t, n) {
  let r = e.position % 4;
  return [...t]
    .sort((e, t) => Math.abs((e.position % 4) - r) - Math.abs((t.position % 4) - r))
    .slice(0, n);
}
export function allieDerriere(e, t) {
  if (!enLigneAvant(e)) {
    return null;
  }
  let n = vivants(t).filter((t) => t.camp === e.camp && !enLigneAvant(t));
  if (n.length) {
    return n.sort(
      (t, n) => Math.abs(t.position - 4 - e.position) - Math.abs(n.position - 4 - e.position),
    )[0];
  }
  return null;
}
function verifierRenaissance(e, t) {
  if (!(e.pvActuels > 0 || !e.renaissance || !(e.renaissancesRestantes ?? 0))) {
    e.renaissancesRestantes = (e.renaissancesRestantes ?? 1) - 1;
    e.pvActuels = Math.max(1, Math.round(e.pvMax * e.renaissance));
    e.bombes = 0;
    e.telefrags = 0;
    t?.log(`🥚 ${e.nom} renaît de son Kwakwanneau à ${e.pvActuels} PV !`);
  }
}
function voisinSuivant(e, t) {
  return vivants(t)
    .filter((t) => t.camp === e.camp && t.position > e.position)
    .sort((e, t) => e.position - t.position)[0];
}
export function retirerPA(e, t, n) {
  let e_paActuels = e.paActuels;
  e.paActuels = Math.max(0, e.paActuels - t);
  if (e.paActuels < e_paActuels) {
    n.log(`${e.nom} perd ${e_paActuels - e.paActuels} PA.`);
  }
}
const EFFETS_DECOMPTES_DEBUT_TOUR = [`paParTour`, `hot`, `bonusPieges`];
export function debutTourEffets(e, t, n) {
  if (e.paBonusNextTurn !== 0) {
    e.paActuels = Math.max(0, e.paActuels + e.paBonusNextTurn);
    if (e.paBonusNextTurn > 0) {
      n.log(`${e.nom} gagne ${e.paBonusNextTurn} PA.`);
    } else {
      n.log(`${e.nom} perd ${-e.paBonusNextTurn} PA.`);
    }
    e.paBonusNextTurn = 0;
  }
  for (let t of e.effets.filter((e) => e.stat === `paParTour`)) {
    e.paActuels += t.valeur;
    n.log(`${e.nom} gagne ${t.valeur} PA (effet de ligne).`);
    --t.toursRestants;
  }
  for (let t of e.effets.filter((e) => e.stat === `poison`)) {
    e.pvActuels = Math.max(0, e.pvActuels - t.valeur);
    n.log(`${e.nom} subit ${t.valeur} dégâts de poison.`);
  }
  verifierDofusArgente(e, reliquesActivesDe(e, n));
  verifierRenaissance(e, n);
  if (e.pvActuels <= 0) {
    n.onEvenement?.({
      type: `mort`,
      ref: e.ref,
    });
    n.log(`${e.nom} succombe au poison !`);
    let r = voisinSuivant(e, t);
    for (let t of e.effets.filter((e) => e.stat === `poison` && e.transmet)) {
      if (r) {
        r.effets.push({
          stat: `poison`,
          valeur: t.valeur,
          toursRestants: t.toursRestants,
          transmet: true,
        });
        n.log(`Le poison se transmet à ${r.nom} !`);
      }
    }
    return true;
  }
  for (let t of e.effets.filter((e) => e.stat === `hot`)) {
    if (!aFriction(e)) {
      let r = e.pvActuels;
      e.pvActuels = Math.min(e.pvMax, e.pvActuels + t.valeur);
      if (e.pvActuels > r) {
        n.log(`${e.nom} régénère ${e.pvActuels - r} PV.`);
        n.onEvenement?.({
          type: `soin`,
          cibleRef: e.ref,
          montant: e.pvActuels - r,
        });
      }
    }
    --t.toursRestants;
  }
  for (let t of e.effets.filter((e) => e.stat === `bonusPieges`)) {
    --t.toursRestants;
  }
  e.effets = e.effets.filter(
    (e) => !(EFFETS_DECOMPTES_DEBUT_TOUR.includes(e.stat) && e.toursRestants <= 0),
  );
  if (e.boucliersTemporaires?.length) {
    for (let t of e.boucliersTemporaires) {
      --t.tours;
    }
    let t = e.boucliersTemporaires.filter((e) => e.tours <= 0);
    for (let r of t) {
      let t = Math.min(r.montant, e.bouclier);
      e.bouclier -= t;
      if (t > 0) {
        n.log(`Le bouclier temporaire de ${e.nom} s'estompe (−${t}).`);
      }
    }
    e.boucliersTemporaires = e.boucliersTemporaires.filter((e) => e.tours > 0);
  }
  return false;
}
export function finTourEffets(e) {
  let t = false;
  e.effets.forEach((e) => {
    EFFETS_DECOMPTES_DEBUT_TOUR.includes(e.stat) ||
      (--e.toursRestants, e.toursRestants <= 0 && e.stat === `vitalite` && (t = true));
  });
  e.effets = e.effets.filter((e) => e.toursRestants > 0);
  if (t) {
    recalculerPvMax(e);
  }
  e.resquilleActive = undefined;
  e.redirection &&
    (e.redirectionPoseCeTour
      ? (e.redirectionPoseCeTour = false)
      : --e.redirection.tours <= 0 && (e.redirection = undefined));
  for (let t of Object.keys(e.cooldowns)) {
    if (e.cooldownsPosesCeTour?.has(t)) {
      e.cooldownsPosesCeTour.delete(t);
      continue;
    }
    --e.cooldowns[t];
    e.cooldowns[t] <= 0 && delete e.cooldowns[t];
  }
}
export const consommerMaxRoll = (e) => {
  if (e.maxRollCharges > 0) {
    return (--e.maxRollCharges, true);
  }
  return false;
};
export function soigner(e, t, n) {
  if (aFriction(e)) {
    n.log(`${e.nom} ne peut pas être soigné (friction).`);
    return false;
  }
  let e_pvActuels = e.pvActuels;
  e.pvActuels = Math.min(e.pvMax, e.pvActuels + t);
  let i = e.pvActuels - e_pvActuels;
  if (i > 0) {
    n.log(`${e.nom} récupère ${i} PV.`);
    n.onEvenement?.({
      type: `soin`,
      cibleRef: e.ref,
      montant: i,
    });
  }
  return true;
}
export function soignerPlusBlesse(e, t, n, r, i) {
  let a = [...e].sort((e, t) => e.pvActuels / e.pvMax - t.pvActuels / t.pvMax)[0];
  if (!(!a || a.pvActuels >= a.pvMax)) {
    soigner(a, Math.round(n * t * multiplicateurSoinDe(r)), i);
  }
}
export function appliquerSoinsEtBoucliers(e, t, n) {
  for (let r of e.soins) {
    let e = trouverParRef(t, r.ref);
    !e ||
      e.pvActuels <= 0 ||
      (soigner(e, r.montant, n) &&
        (r.argenteConsume && ((e.argenteArme = undefined), (e.argenteUtilise = true)),
        r.veilleursConsume && (e.veilleursRecuCeTour = true)));
  }
  for (let r of e.boucliers) {
    let e = trouverParRef(t, r.ref);
    if (!(!e || e.pvActuels <= 0 || aFriction(e))) {
      e.bouclier += r.montant;
      (e.boucliersTemporaires ??= []).push({
        montant: r.montant,
        tours: r.tours,
      });
      n.log(`${e.nom} gagne un bouclier de ${r.montant}.`);
    }
  }
}
export function ciblesBouclierGroupe(e, t, n) {
  switch (n) {
    case `soi`:
      return [e];
    case `rangee_lanceur`:
      return alliesVivants(e, t).filter((t) => enLigneAvant(t) === enLigneAvant(e));
    case `rangee_avant`:
      return alliesVivants(e, t).filter(enLigneAvant);
  }
}
export function bouclierGroupe(e, t, n, r, tours, a) {
  for (let o of ciblesBouclierGroupe(e, t, n)) {
    if (aFriction(o)) {
      continue;
    }
    let e = Math.round(o.pvMax * r);
    o.bouclier += e;
    a.log(`${o.nom} gagne un bouclier de ${e}.`);
    if (tours) {
      (o.boucliersTemporaires ??= []).push({
        montant: e,
        tours,
      });
    }
  }
}
export function ciblesSoutien(e, t, n, r) {
  if (e.cible === `allie_tous`) {
    return alliesVivants(t, r);
  }
  if (n) {
    return [n];
  }
  return [];
}
export const aBonusSiCrit = (e) => !!(e.bouclierPctSiCrit || e.tiragesSiCrit);
export function descriptionBuff(e) {
  if (e.bouclierPct) {
    return `bouclier (${Math.round(e.bouclierPct * 100)} % PV max)`;
  }
  if (e.effet) {
    return `${e.effet.stat} ${e.effet.valeur >= 0 ? `+` : ``}${e.effet.valeur}`;
  }
  return `effet`;
}
export function appliquerSoutien(e, t, n, r, i = false) {
  if (e.dissipe) {
    let e = t.effets.length;
    t.effets = t.effets.filter((e) => e.stat !== `poison` && e.stat !== `degatsInfliges`);
    if (t.effets.length < e) {
      r.log(`${t.nom} est purgé de ses effets négatifs.`);
    }
  }
  if (e.bouclierPct && !aFriction(t)) {
    let n = i && e.bouclierPctSiCrit ? e.bouclierPctSiCrit : e.bouclierPct;
    let a = Math.round(t.pvMax * n);
    t.bouclier += a;
    r.log(`${t.nom} gagne un bouclier de ${a}.`);
    if (e.bouclierTours) {
      (t.boucliersTemporaires ??= []).push({
        montant: a,
        tours: e.bouclierTours,
      });
    }
  }
  if (e.hotPct && !aFriction(t)) {
    appliquerEffet(t, {
      stat: `hot`,
      valeur: Math.max(1, Math.round(t.stats.vitalite * e.hotPct * multiplicateurSoinDe(n))),
      duree: e.hotDuree ?? 2,
    });
  }
  if (e.paGain) {
    t.paBonusNextTurn += e.paGain;
    r.log(`${t.nom} recevra ${e.paGain} PA au prochain tour.`);
  }
  if (e.paImmediat) {
    t.paActuels += e.paImmediat;
    r.log(`${t.nom} gagne ${e.paImmediat} PA pour ce tour.`);
  }
  if (e.paProchainTour) {
    t.paBonusNextTurn = Math.max(t.paBonusNextTurn, e.paProchainTour);
    r.log(`${t.nom} anticipe : +${e.paProchainTour} PA au prochain tour (Prémonition).`);
  }
  if (e.bonusProchainSortPct) {
    t.bonusOffensifProchain += e.bonusProchainSortPct;
    r.log(`${t.nom} prépare un sort renforcé (+${Math.round(e.bonusProchainSortPct * 100)} %).`);
  }
  if (e.effet) {
    appliquerEffet(t, e.effet);
  }
  if (e.dissipePositifs) {
    desenvouter(t, r);
  }
  if (e.nullifieProchain) {
    t.nullifieProchainCoup = true;
    r.log(`${t.nom} se prépare à annuler le prochain coup direct.`);
  }
  if (e.resquille) {
    t.resquilleActive = e.resquille;
    r.log(`${t.nom} prépare une Resquille (−${e.resquille} PA au prochain Kaboom).`);
  }
  if (e.bonusPieges) {
    appliquerEffet(n, {
      stat: `bonusPieges`,
      valeur: e.bonusPieges,
      duree: e.bonusPiegesDuree ?? 1,
    });
    r.log(
      `${n.nom} concentre son Chakra : pièges +${Math.round(e.bonusPieges * 100)} % (${e.bonusPiegesDuree ?? 1}t).`,
    );
  }
}
function deuxDevant(e, t) {
  return (
    vivants(t).filter((t) => t.camp === e.camp && enLigneAvant(t) && !t.estInvocation).length >= 2
  );
}
export function membresRangee(e, t, n) {
  let r = t.rangee === `avant`;
  return vivants(n).filter((t) => t.camp === e.camp && enLigneAvant(t) === r && !t.estInvocation);
}
export function buffRangee(e, t, n, r) {
  let i = membresRangee(e, t, n);
  if (!i.length) {
    return;
  }
  let a = t.rangee === `avant`;
  let o = deuxDevant(e, n);
  let s = [];
  for (let e of t.effets) {
    let t = o && e.valeurSiDeuxDevant !== undefined ? e.valeurSiDeuxDevant : e.valeur;
    s.push(`${e.stat} ${t >= 0 ? `+` : ``}${t} (${e.duree}t)`);
    for (let n of i) {
      if (e.stat === `maxRoll`) {
        n.maxRollCharges += t;
        continue;
      }
      let r = n.effets.find((t) => t.stat === e.stat && t.viaBuffRangee);
      if (r) {
        r.valeur = t;
        r.toursRestants = e.duree;
      } else {
        n.effets.push({
          stat: e.stat,
          valeur: t,
          toursRestants: e.duree,
          viaBuffRangee: true,
        });
      }
      if (e.stat === `vitalite`) {
        recalculerPvMax(n);
      }
    }
  }
  let c = t.effets.some((e) => e.valeurSiDeuxDevant !== undefined);
  r.log(
    `${e.nom} renforce la rangée ${a ? `avant` : `arrière`} : ${s.join(`, `)}${o && c ? ` (renfort à deux)` : ``}.`,
  );
}
export function brumeRangee(e, t, toursRestants, r, i) {
  let a = chanceEsquive(e, {
    sansBonusPosition: true,
    sansViaBrume: true,
    sansPlafond: true,
  });
  let o = alliesVivants(e, r).filter((e) => enLigneAvant(e) === enLigneAvant(t));
  for (let e of o) {
    e.effets.push({
      stat: `esquive`,
      valeur: a,
      toursRestants,
      viaBrume: true,
    });
  }
  i.log(
    `${e.nom} enveloppe la rangée ${enLigneAvant(t) ? `avant` : `arrière`} d'une Brume (+${Math.round(a * 100)} % d'esquive, ${toursRestants}t).`,
  );
}
export function invoquerPoupee(e, t, n, r) {
  let i = `poupee_${e.ref}`;
  if (n.some((e) => e.ref === i && e.pvActuels > 0)) {
    r.log(`${e.nom} a déjà ${t.article ?? `une`} ${t.nom} active.`);
    return;
  }
  // place libre, de préférence en ligne avant (la poupée provoque et encaisse)
  let prises = new Set(
    vivants(n)
      .filter((c) => c.camp === e.camp)
      .map((c) => c.position),
  );
  let position = [0, 1, 2, 3, 4, 5, 6, 7].find((p) => !prises.has(p));
  if (position === undefined) {
    r.log(`L'invocation de ${e.nom} échoue (plus de place).`);
    return;
  }
  let a = n.findIndex((e) => e.ref === i);
  if (a >= 0) {
    n.splice(a, 1);
  }
  let pv = t.pvPct ? Math.max(10, Math.round(e.pvMax * t.pvPct)) : t.pv;
  n.push({
    ref: i,
    nom: t.nom,
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
    resistances: { ...(t.resistances ?? {}) },
    sorts: [],
    camp: e.camp,
    position,
    niveau: 1,
    img: t.img ?? `/assets/divers/poupee.png`,
    ...etatCombatInitial(),
    estInvocation: true,
    joueTour: false,
    provoque: t.provoque,
    invoquePar: e.ref,
  });
  r.log(`${e.nom} invoque ${t.article ?? `une`} ${t.nom} (${pv} PV) qui provoque les ennemis.`);
}
export function planterLance(e, t, n, r) {
  let i = `lance_${e.ref}`;
  if (vivants(n).some((e) => e.ref === i)) {
    return null;
  }
  let [a, o] = enLigneAvant(t) ? [0, 3] : [4, 7];
  let s = new Set(
    vivants(n)
      .filter((e) => e.camp === `ennemi`)
      .map((e) => e.position),
  );
  let c = t.position % 4;
  let l = null;
  let u = Infinity;
  for (let e = a; e <= o; e++) {
    if (s.has(e)) {
      continue;
    }
    let t = Math.abs((e % 4) - c);
    if (t < u) {
      u = t;
      l = e;
    }
  }
  if (l === null) {
    return null;
  }
  let d = n.findIndex((e) => e.ref === i);
  if (d >= 0) {
    n.splice(d, 1);
  }
  let f = {
    ref: i,
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
    position: l,
    niveau: 1,
    img: `/assets/spells/forgelance/lance.png`,
    ...etatCombatInitial(),
    estInvocation: true,
    joueTour: false,
    estLance: true,
    lanceurRef: e.ref,
  };
  n.push(f);
  r.log(`🔱 ${e.nom} plante une Lance.`);
  return f;
}
export function invoquerEgide(e, t, toursRestantsInvocation, r, i) {
  let a = `egide_${e.ref}`;
  if (vivants(r).some((e) => e.ref === a)) {
    return null;
  }
  let o = caseLibreSurLigne(e.camp, enLigneAvant(t), r);
  if (o === null) {
    return null;
  }
  let s = r.findIndex((e) => e.ref === a);
  if (s >= 0) {
    r.splice(s, 1);
  }
  let c = {
    ref: a,
    nom: `Égide`,
    pvBase: e.pvMax,
    pvMax: e.pvMax,
    pvActuels: e.pvMax,
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
    camp: e.camp,
    position: o,
    niveau: 1,
    img: `/assets/spells/feca/egide.png`,
    ...etatCombatInitial(),
    estInvocation: true,
    joueTour: false,
    estEgide: true,
    lanceurRef: e.ref,
    toursRestantsInvocation,
  };
  r.push(c);
  i.log(`🛡️ ${e.nom} invoque une Égide (${c.pvMax} PV) sur sa rangée.`);
  return c;
}
function premiereCaseLibre(camp, t) {
  let n = new Set(
    vivants(t)
      .filter((t) => t.camp === camp)
      .map((e) => e.position),
  );
  for (let e = 0; e < 8; e++) {
    if (!n.has(e)) {
      return e;
    }
  }
  return null;
}
function creerInvocation(e, ref, position, camp, invoquePar) {
  return {
    ref,
    nom: e.nom,
    pvBase: e.pv,
    pvMax: e.pv,
    pvActuels: e.pv,
    stats: {
      ...e.stats,
    },
    paMax: e.pa,
    paActuels: e.pa,
    initiative: e.initiative,
    resistances: {
      ...e.resistances,
    },
    sorts: [...e.sorts],
    camp,
    position,
    niveau: 1,
    monstreId: e.id,
    ia: e.ia,
    img: e.img,
    ...etatCombatInitial(),
    invoquePar,
  };
}
const alliesMortsRessuscitables = (e, t) =>
  t.filter(
    (t) =>
      t.camp === e.camp &&
      t.pvActuels <= 0 &&
      t.ref !== e.ref &&
      !t.estInvocation &&
      !MONSTRES[t.monstreId ?? ``]?.boss,
  );
export function peutInvoquer(e, t, n) {
  if (t.invoqueMonstre) {
    return (
      vivants(n).filter((t) => t.invoquePar === e.ref).length < t.invoqueMonstre.max &&
      premiereCaseLibre(e.camp, n) !== null
    );
  }
  if (t.ressuscite) {
    return alliesMortsRessuscitables(e, n).length > 0;
  }
  return !!t.invocation;
}
export function invoquerMonstre(e, invoqueMonstre, n, r) {
  if (
    !peutInvoquer(
      e,
      {
        invoqueMonstre,
      },
      n,
    )
  ) {
    r.log(`L'invocation de ${e.nom} échoue (plus de place).`);
    return;
  }
  let i = MONSTRES[invoqueMonstre.pool[Math.floor(r.rng() * invoqueMonstre.pool.length)]];
  let a = premiereCaseLibre(e.camp, n);
  let o = `invoc_${e.ref}_${n.length}`;
  n.push(creerInvocation(i, o, a, e.camp, e.ref));
  r.log(`${e.nom} invoque ${i.nom} !`);
}
export function ressusciterAllie(e, t, n, r) {
  let i = alliesMortsRessuscitables(e, n);
  if (!i.length) {
    r.log(`${e.nom} appelle les morts… mais personne ne répond.`);
    return;
  }
  let a = i[Math.floor(r.rng() * i.length)];
  if (
    new Set(
      vivants(n)
        .filter((e) => e.camp === a.camp)
        .map((e) => e.position),
    ).has(a.position)
  ) {
    let t = premiereCaseLibre(a.camp, n);
    if (t === null) {
      r.log(`${e.nom} appelle les morts… mais il n'y a plus de place.`);
      return;
    }
    a.position = t;
  }
  a.pvActuels = Math.max(1, Math.round(a.pvMax * t.pvPct));
  a.effets = [];
  a.bouclier = 0;
  a.bombes = 0;
  a.telefrags = 0;
  r.log(`${e.nom} réinvoque ${a.nom} d'entre les morts (${a.pvActuels} PV) !`);
}
