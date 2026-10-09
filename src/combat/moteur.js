import { effetsDebutTourReliques, effetsFinTourReliques } from "../jeu/progression.js";
import {
  ELEMENTS,
  coutPA,
  reinitialiserTour,
  reliquesActivesDe,
  trouverParRef,
  vivants,
} from "./stats.js";
import { appliquerSoinsEtBoucliers, debutTourEffets, finTourEffets } from "./effets.js";
import { lancerSort } from "./sorts.js";
function mueElementaire(e, t) {
  if (e.mueElementaire === undefined) {
    return;
  }
  let n = ELEMENTS[Math.floor(t.rng() * ELEMENTS.length)];
  let e_mueElementaire = e.mueElementaire;
  e.resistances = {
    terre: e_mueElementaire,
    feu: e_mueElementaire,
    eau: e_mueElementaire,
    air: e_mueElementaire,
    [n]: 0,
  };
  t.log(`${e.nom} mue : son plumage ne protège plus contre l'élément ${n.toUpperCase()} !`);
}
function chanceEcaflip(e, t) {
  if (!e.paGamble) {
    return;
  }
  let e_paGamble = e.paGamble;
  if (t.rng() < e_paGamble.pPlus) {
    e.paActuels += e_paGamble.plus;
    t.log(`😼 La Chance d'Ecaflip sourit à ${e.nom} : +${e_paGamble.plus} PA !`);
  } else {
    e.paActuels = Math.max(0, e.paActuels - e_paGamble.moins);
    t.log(`🙀 La Chance d'Ecaflip grimace : ${e.nom} perd ${e_paGamble.moins} PA.`);
  }
}
const campVaincu = (e, t) => vivants(e).every((e) => e.camp !== t || e.estLance || e.estEgide);
const combatTermine = (e) => campVaincu(e, `joueur`) || campVaincu(e, `ennemi`);
const victoireJoueur = (e) => campVaincu(e, `ennemi`) && !campVaincu(e, `joueur`);
export function ordreDeJeu(e) {
  let t = e.filter((e) => !e.estInvocation && !e.invoquePar);
  let n = {
    joueur: t.filter((e) => e.camp === `joueur`),
    ennemi: ((e) => [...e].sort((e, t) => t.initiative - e.initiative))(
      t.filter((e) => e.camp === `ennemi`),
    ),
  };
  let r = (e) => {
    if (e.length) {
      return e.reduce((acc, item) => acc + item.initiative, 0) / e.length;
    }
    return 0;
  };
  let i = n.joueur.some((e) => e.ouvreToujours);
  let a = `joueur`;
  if (!i && r(n.ennemi) > r(n.joueur)) {
    a = `ennemi`;
  }
  let o = [];
  while (n.joueur.length || n.ennemi.length) {
    if (!n[a].length) {
      a = a === `joueur` ? `ennemi` : `joueur`;
    }
    o.push(n[a].shift().ref);
    let e = a === `joueur` ? `ennemi` : `joueur`;
    if (n[e].length) {
      a = e;
    }
  }
  for (let t of e) {
    if (!t.invoquePar || t.estInvocation) {
      continue;
    }
    let n = o.indexOf(t.invoquePar);
    if (n < 0) {
      continue;
    }
    let r = new Set(e.filter((e) => e.invoquePar === t.invoquePar).map((e) => e.ref));
    while (n + 1 < o.length && r.has(o[n + 1])) {
      n++;
    }
    o.splice(n + 1, 0, t.ref);
  }
  return o;
}
function prochainAJouer(e, t) {
  let n = new Map(e.map((e) => [e.ref, e]));
  for (let r of ordreDeJeu(e)) {
    let e = n.get(r);
    if (e && e.pvActuels > 0 && !t.has(r)) {
      return e;
    }
  }
  return null;
}
function retirerInvocationsOrphelines(e, t) {
  while (true) {
    let n = new Set(e.filter((e) => e.pvActuels <= 0).map((e) => e.ref));
    let r = e.filter(
      (e) =>
        e.pvActuels > 0 &&
        ((e.invoquePar !== undefined && n.has(e.invoquePar)) ||
          ((e.estLance || e.estEgide) && e.lanceurRef !== undefined && n.has(e.lanceurRef))),
    );
    if (!r.length) {
      return;
    }
    for (let e of r) {
      e.pvActuels = 0;
      if (e.estLance) {
        t.log(`La lance se brise : son porteur est tombé.`);
      } else if (e.estEgide) {
        t.log(`L'Égide s'efface : son invocateur est tombé.`);
      } else {
        t.log(`${e.nom} disparaît avec son invocateur !`);
      }
    }
  }
}
export async function executerCombat(e, t) {
  let n = {
    rng: t.rng ?? Math.random,
    log: t.log ?? (() => {}),
    playerDamageBonus: t.playerDamageBonus ?? 1,
    enemyDamageBonus: t.enemyDamageBonus ?? 1,
    fx: t.fx,
    onDegats: t.onDegats,
    onEvenement: t.onEvenement,
    reliquesActives: t.reliquesActives,
  };
  let r = 0;
  while (!combatTermine(e) && !(++r > 1000)) {
    n.onEvenement?.({
      type: `ronde`,
    });
    // méta sans texte : l'interface remet la frise à zéro (rien n'est affiché)
    n.log(``, { ronde: true });
    let r = new Set();
    while (!combatTermine(e)) {
      let i = prochainAJouer(e, r);
      if (!i) {
        break;
      }
      r.add(i.ref);
      n.tourDeRef = i.ref;
      reinitialiserTour(i);
      i.toursJoues = (i.toursJoues ?? 0) + 1;
      if (i.nullifieParTour) {
        i.coupsAnnulesRestants = i.nullifieParTour;
      }
      mueElementaire(i, n);
      chanceEcaflip(i, n);
      for (let t of e) {
        if (t.estEgide && t.lanceurRef === i.ref && t.pvActuels > 0) {
          let e = (t.toursRestantsInvocation ?? 0) - 1;
          t.toursRestantsInvocation = e;
          if (e <= 0) {
            t.pvActuels = 0;
            n.log(`🛡️ L'Égide de ${i.nom} expire.`);
          }
        }
      }
      if (debutTourEffets(i, e, n)) {
        retirerInvocationsOrphelines(e, n);
        await t.onUpdate?.();
        continue;
      }
      let a = effetsDebutTourReliques(i, e, reliquesActivesDe(i, n));
      appliquerSoinsEtBoucliers(a, e, n);
      i.degatsPctDofus = a.degatsPct;
      if (i.effets.some((e) => e.stat === `assome`)) {
        i.effets = i.effets.filter((e) => e.stat !== `assome`);
        n.log(`💫 ${i.nom} est assommé et passe son tour !`, { tour: i.ref });
        await t.onUpdate?.();
      } else {
        n.log(`▶ Tour de ${i.nom} (${i.paActuels} PA).`, { tour: i.ref });
        await t.onUpdate?.();
        let r = 0;
        while (i.pvActuels > 0 && !combatTermine(e) && !(++r > 50)) {
          let r = await t.controllers[i.camp](i, e);
          if (!r) {
            break;
          }
          let a = coutPA(r.sort, i);
          if (i.paActuels < a) {
            break;
          }
          i.paActuels -= a;
          lancerSort(i, r.sort, r.cibleRef, e, n);
          if (i.recupPASort && a > 0 && n.rng() < i.recupPASort.chance) {
            i.paActuels += i.recupPASort.pa;
            n.log(`✨ ${i.nom} récupère ${i.recupPASort.pa} PA.`);
          }
          retirerInvocationsOrphelines(e, n);
          await t.onUpdate?.();
        }
      }
      appliquerSoinsEtBoucliers(effetsFinTourReliques(i, e, reliquesActivesDe(i, n)), e, n);
      finTourEffets(i);
      for (let t of e) {
        if (t.conjuration) {
          if (t.conjuration.lanceurRef === i.ref) {
            --t.conjuration.tours <= 0 && delete t.conjuration;
          } else {
            let n = trouverParRef(e, t.conjuration.lanceurRef);
            (!n || n.pvActuels <= 0) && delete t.conjuration;
          }
        }
      }
      i.paActuels = i.paMax;
    }
  }
  return victoireJoueur(e);
}
