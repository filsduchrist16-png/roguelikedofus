import { effetsDebutTourReliques, effetsFinTourReliques } from "../jeu/progression.js";
import {
  ELEMENTS,
  coutPA,
  reinitialiserTour,
  reliquesActivesDe,
  trouverParRef,
  vivants,
} from "./stats.js";
import { appliquerSoinsEtBoucliers, debutTourEffets, finTourEffets, soigner } from "./effets.js";
import { effetRun } from "./ameliorations.js";
import { lancerSort } from "./sorts.js";
function mueElementaire(combattant, contexte) {
  if (combattant.mueElementaire === undefined) {
    return;
  }
  let element = ELEMENTS[Math.floor(contexte.rng() * ELEMENTS.length)];
  let resistanceMue = combattant.mueElementaire;
  combattant.resistances = {
    terre: resistanceMue,
    feu: resistanceMue,
    eau: resistanceMue,
    air: resistanceMue,
    [element]: 0,
  };
  contexte.log(
    `${combattant.nom} mue : son plumage ne protège plus contre l'élément ${element.toUpperCase()} !`,
  );
}
function chanceEcaflip(combattant, contexte) {
  if (!combattant.paGamble) {
    return;
  }
  let gamble = combattant.paGamble;
  if (contexte.rng() < gamble.pPlus) {
    combattant.paActuels += gamble.plus;
    contexte.log(`😼 La Chance d'Ecaflip sourit à ${combattant.nom} : +${gamble.plus} PA !`);
  } else {
    combattant.paActuels = Math.max(0, combattant.paActuels - gamble.moins);
    contexte.log(`🙀 La Chance d'Ecaflip grimace : ${combattant.nom} perd ${gamble.moins} PA.`);
  }
}
// Furie des boss : sous un seuil de PV (50 % par défaut), au début de son tour, le boss gagne des
// dégâts, des PA et parfois un bouclier, une seule fois par combat. Annoncé dans le journal.
export function declencherFurie(combattant, contexte) {
  let furie = combattant.furie;
  if (
    !furie ||
    combattant.enFurie ||
    combattant.pvActuels <= 0 ||
    combattant.pvActuels > combattant.pvMax * furie.seuil
  ) {
    return false;
  }
  combattant.enFurie = true;
  let effets = [];
  if (furie.degatsPct) {
    combattant.degatsPctPermanent = (combattant.degatsPctPermanent ?? 0) + furie.degatsPct;
    effets.push(`+${Math.round(furie.degatsPct * 100)} % de dégâts`);
  }
  if (furie.pa) {
    combattant.paMax += furie.pa;
    combattant.paActuels += furie.pa;
    effets.push(`+${furie.pa} PA`);
  }
  if (furie.bouclierPct) {
    let bouclier = Math.round(combattant.pvMax * furie.bouclierPct);
    combattant.bouclier = (combattant.bouclier ?? 0) + bouclier;
    effets.push(`bouclier de ${bouclier}`);
  }
  contexte.log(`🔥 ${combattant.nom} entre en furie ! (${effets.join(`, `)})`, {
    tour: combattant.ref,
  });
  return true;
}
const campVaincu = (combattants, camp) =>
  vivants(combattants).every(
    (combattant) => combattant.camp !== camp || combattant.estLance || combattant.estEgide,
  );
const combatTermine = (combattants) =>
  campVaincu(combattants, `joueur`) || campVaincu(combattants, `ennemi`);
const victoireJoueur = (combattants) =>
  campVaincu(combattants, `ennemi`) && !campVaincu(combattants, `joueur`);
export function ordreDeJeu(combattants) {
  let principaux = combattants.filter(
    (combattant) => !combattant.estInvocation && !combattant.invoquePar,
  );
  let files = {
    joueur: principaux.filter((combattant) => combattant.camp === `joueur`),
    ennemi: ((liste) =>
      [...liste].sort((premier, second) => second.initiative - premier.initiative))(
      principaux.filter((combattant) => combattant.camp === `ennemi`),
    ),
  };
  let moyenneInitiative = (liste) => {
    if (liste.length) {
      return liste.reduce((acc, item) => acc + item.initiative, 0) / liste.length;
    }
    return 0;
  };
  let joueurOuvre = files.joueur.some((combattant) => combattant.ouvreToujours);
  let campCourant = `joueur`;
  if (!joueurOuvre && moyenneInitiative(files.ennemi) > moyenneInitiative(files.joueur)) {
    campCourant = `ennemi`;
  }
  let ordre = [];
  while (files.joueur.length || files.ennemi.length) {
    if (!files[campCourant].length) {
      campCourant = campCourant === `joueur` ? `ennemi` : `joueur`;
    }
    ordre.push(files[campCourant].shift().ref);
    let autreCamp = campCourant === `joueur` ? `ennemi` : `joueur`;
    if (files[autreCamp].length) {
      campCourant = autreCamp;
    }
  }
  for (let combattant of combattants) {
    if (!combattant.invoquePar || combattant.estInvocation) {
      continue;
    }
    let position = ordre.indexOf(combattant.invoquePar);
    if (position < 0) {
      continue;
    }
    let groupe = new Set(
      combattants
        .filter((membre) => membre.invoquePar === combattant.invoquePar)
        .map((membre) => membre.ref),
    );
    while (position + 1 < ordre.length && groupe.has(ordre[position + 1])) {
      position++;
    }
    ordre.splice(position + 1, 0, combattant.ref);
  }
  return ordre;
}
function prochainAJouer(combattants, dejaJoues) {
  let parRef = new Map(combattants.map((combattant) => [combattant.ref, combattant]));
  for (let ref of ordreDeJeu(combattants)) {
    let candidat = parRef.get(ref);
    if (candidat && candidat.pvActuels > 0 && !dejaJoues.has(ref)) {
      return candidat;
    }
  }
  return null;
}
function retirerInvocationsOrphelines(combattants, contexte) {
  while (true) {
    let morts = new Set(
      combattants
        .filter((combattant) => combattant.pvActuels <= 0)
        .map((combattant) => combattant.ref),
    );
    let orphelines = combattants.filter(
      (combattant) =>
        combattant.pvActuels > 0 &&
        ((combattant.invoquePar !== undefined && morts.has(combattant.invoquePar)) ||
          ((combattant.estLance || combattant.estEgide) &&
            combattant.lanceurRef !== undefined &&
            morts.has(combattant.lanceurRef))),
    );
    if (!orphelines.length) {
      return;
    }
    for (let orpheline of orphelines) {
      orpheline.pvActuels = 0;
      if (orpheline.estLance) {
        contexte.log(`La lance se brise : son porteur est tombé.`);
      } else if (orpheline.estEgide) {
        contexte.log(`L'Égide s'efface : son invocateur est tombé.`);
      } else {
        contexte.log(`${orpheline.nom} disparaît avec son invocateur !`);
      }
    }
  }
}
export async function executerCombat(combattants, options) {
  let contexte = {
    rng: options.rng ?? Math.random,
    log: options.log ?? (() => {}),
    playerDamageBonus: options.playerDamageBonus ?? 1,
    enemyDamageBonus: options.enemyDamageBonus ?? 1,
    fx: options.fx,
    onDegats: options.onDegats,
    onEvenement: options.onEvenement,
    reliquesActives: options.reliquesActives,
  };
  let ronde = 0;
  while (!combatTermine(combattants) && !(++ronde > 1000)) {
    contexte.onEvenement?.({
      type: `ronde`,
    });
    // méta sans texte : l'interface remet la frise à zéro (rien n'est affiché)
    contexte.log(``, { ronde: true });
    let dejaJoues = new Set();
    while (!combatTermine(combattants)) {
      let acteur = prochainAJouer(combattants, dejaJoues);
      if (!acteur) {
        break;
      }
      dejaJoues.add(acteur.ref);
      contexte.tourDeRef = acteur.ref;
      reinitialiserTour(acteur);
      acteur.toursJoues = (acteur.toursJoues ?? 0) + 1;
      if (acteur.nullifieParTour) {
        acteur.coupsAnnulesRestants = acteur.nullifieParTour;
      }
      mueElementaire(acteur, contexte);
      chanceEcaflip(acteur, contexte);
      declencherFurie(acteur, contexte);
      for (let combattant of combattants) {
        if (
          combattant.estEgide &&
          combattant.lanceurRef === acteur.ref &&
          combattant.pvActuels > 0
        ) {
          let toursRestants = (combattant.toursRestantsInvocation ?? 0) - 1;
          combattant.toursRestantsInvocation = toursRestants;
          if (toursRestants <= 0) {
            combattant.pvActuels = 0;
            contexte.log(`🛡️ L'Égide de ${acteur.nom} expire.`);
          }
        }
      }
      if (debutTourEffets(acteur, combattants, contexte)) {
        retirerInvocationsOrphelines(combattants, contexte);
        await options.onUpdate?.();
        continue;
      }
      let effetsDebut = effetsDebutTourReliques(
        acteur,
        combattants,
        reliquesActivesDe(acteur, contexte),
      );
      appliquerSoinsEtBoucliers(effetsDebut, combattants, contexte);
      acteur.degatsPctDofus = effetsDebut.degatsPct;
      // relique de run : régénération au début du tour
      const regen = effetRun(acteur, `regenTour`);
      if (regen && acteur.pvActuels > 0 && acteur.pvActuels < acteur.pvMax) {
        soigner(acteur, Math.max(1, Math.round(acteur.pvMax * regen)), contexte);
      }
      if (acteur.effets.some((effet) => effet.stat === `assome`)) {
        acteur.effets = acteur.effets.filter((effet) => effet.stat !== `assome`);
        contexte.log(`💫 ${acteur.nom} est assommé et passe son tour !`, { tour: acteur.ref });
        await options.onUpdate?.();
      } else {
        contexte.log(`▶ Tour de ${acteur.nom} (${acteur.paActuels} PA).`, { tour: acteur.ref });
        await options.onUpdate?.();
        let actions = 0;
        while (acteur.pvActuels > 0 && !combatTermine(combattants) && !(++actions > 50)) {
          let action = await options.controllers[acteur.camp](acteur, combattants, contexte);
          if (!action) {
            break;
          }
          let cout = coutPA(action.sort, acteur);
          if (acteur.paActuels < cout) {
            break;
          }
          acteur.paActuels -= cout;
          // relique de run « premier sort moins cher » : consommée au premier lancer
          acteur.remisePremierSort = 0;
          lancerSort(acteur, action.sort, action.cibleRef, combattants, contexte);
          if (acteur.recupPASort && cout > 0 && contexte.rng() < acteur.recupPASort.chance) {
            acteur.paActuels += acteur.recupPASort.pa;
            contexte.log(`✨ ${acteur.nom} récupère ${acteur.recupPASort.pa} PA.`);
          }
          retirerInvocationsOrphelines(combattants, contexte);
          await options.onUpdate?.();
        }
      }
      appliquerSoinsEtBoucliers(
        effetsFinTourReliques(acteur, combattants, reliquesActivesDe(acteur, contexte)),
        combattants,
        contexte,
      );
      finTourEffets(acteur);
      for (let combattant of combattants) {
        if (combattant.conjuration) {
          if (combattant.conjuration.lanceurRef === acteur.ref) {
            --combattant.conjuration.tours <= 0 && delete combattant.conjuration;
          } else {
            let lanceur = trouverParRef(combattants, combattant.conjuration.lanceurRef);
            (!lanceur || lanceur.pvActuels <= 0) && delete combattant.conjuration;
          }
        }
      }
      acteur.paActuels = acteur.paMax;
    }
  }
  return victoireJoueur(combattants);
}
