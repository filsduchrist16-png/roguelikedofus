// Défis de combat, inspirés des challenges de DOFUS : un défi est tiré au début de chaque combat ;
// le réussir rapporte un bonus d'XP et de kamas.
import { SORTS } from "../data/index.js";

export const BONUS_DEFI = 0.3;

const DEFIS = {
  premier: {
    nom: `Premier`,
    texte: (defi) => `Achève ${defi.cibleNom} avant tous ses alliés.`,
    possible: ({ ennemis }) => ennemis.length >= 2,
  },
  dernier: {
    nom: `Dernier`,
    texte: (defi) => `Achève ${defi.cibleNom} après tous ses alliés.`,
    possible: ({ ennemis }) => ennemis.length >= 2,
  },
  blitzkrieg: {
    nom: `Blitzkrieg`,
    texte: (defi) => `Gagne en ${defi.rondesMax} rondes au plus.`,
    possible: () => true,
  },
  survivant: {
    nom: `Survivant`,
    texte: () => `Aucun héros ne doit tomber.`,
    possible: () => true,
  },
  abnegation: {
    nom: `Abnégation`,
    texte: () => `Gagne sans qu'aucun héros ne soit soigné (vol de vie compris).`,
    // seulement si l'équipe sait soigner : sinon le défi serait gratuit
    possible: ({ heros }) =>
      heros.some((perso) =>
        perso.sorts.some((id) => SORTS[id]?.type === `soin` || SORTS[id]?.soinEquipeRatio),
      ),
  },
  elementaire: {
    nom: `Élémentaire`,
    texte: (defi) => `N'inflige des dégâts qu'en ${defi.elementNom}.`,
    possible: ({ heros }) => elementCommun(heros) !== undefined,
  },
};

const NOMS_ELEMENTS = { terre: `Terre`, feu: `Feu`, eau: `Eau`, air: `Air` };

function elementCommun(heros) {
  const listes = heros.map((perso) => perso.elements ?? []);
  return listes[0]?.find((el) => listes.every((liste) => liste.includes(el)));
}

/** Tire un défi adapté au combat. `ennemis` et `heros` sont les combattants du début du combat. */
export function tirerDefi(rng, ennemis, heros) {
  const ctx = { ennemis, heros };
  const ids = Object.keys(DEFIS).filter((idDefi) => DEFIS[idDefi].possible(ctx));
  const id = ids[Math.floor(rng() * ids.length)];
  const defi = { id, nom: DEFIS[id].nom };
  if (id === `premier` || id === `dernier`) {
    // de préférence le boss, sinon un ennemi au hasard
    const boss = ennemis.find((ennemi) => ennemi.boss);
    const cible = boss && rng() < 0.6 ? boss : ennemis[Math.floor(rng() * ennemis.length)];
    defi.cible = cible.ref;
    defi.cibleNom = cible.nom;
  }
  if (id === `blitzkrieg`) {
    defi.rondesMax = Math.max(3, ennemis.length + 1);
  }
  if (id === `elementaire`) {
    defi.element = elementCommun(heros);
    defi.elementNom = NOMS_ELEMENTS[defi.element];
  }
  defi.texte = DEFIS[id].texte(defi);
  return defi;
}

/**
 * @param {object} defi
 * @param {object} resultat résultat du combat : gagne, rondes, herosKO, soins, degatsParElement,
 *   ordreMorts (refs des ennemis achevés, dans l'ordre)
 */
export function defiReussi(defi, resultat) {
  if (!defi || !resultat.gagne) {
    return false;
  }
  switch (defi.id) {
    case `premier`:
      return resultat.ordreMorts[0] === defi.cible;
    case `dernier`:
      return resultat.ordreMorts.at(-1) === defi.cible;
    case `blitzkrieg`:
      return resultat.rondes <= defi.rondesMax;
    case `survivant`:
      return !resultat.herosKO;
    case `abnegation`:
      return (resultat.soins ?? 0) === 0;
    case `elementaire`:
      return Object.entries(resultat.degatsParElement ?? {}).every(
        ([el, degats]) => el === defi.element || !degats,
      );
  }
  return false;
}

/**
 * État du défi pendant le combat : `en_cours`, `assure` (réussi si le combat est gagné) ou `rate`,
 * avec un petit détail (« ronde 2/4 »…).
 * @param {object} defi
 * @param {{rondes: number, morts: Set<string>, degats: object, soins: number}} suivi
 * @param {object[]} combattants
 */
export function etatDefi(defi, suivi, combattants) {
  if (!defi) {
    return null;
  }
  // les invocations ne comptent pas (comme dans les quêtes)
  const ennemis = combattants.filter(
    (combattant) =>
      combattant.camp === `ennemi` &&
      combattant.monstreId &&
      !combattant.estLance &&
      !combattant.estInvocation &&
      !combattant.invoquePar,
  );
  const morts = [...suivi.morts].filter((ref) => ennemis.some((ennemi) => ennemi.ref === ref));
  switch (defi.id) {
    case `premier`: {
      if (!morts.length) {
        return { etat: `en_cours` };
      }
      return morts[0] === defi.cible ? { etat: `assure` } : { etat: `rate` };
    }
    case `dernier`: {
      if (!morts.includes(defi.cible)) {
        return { etat: `en_cours`, detail: `${morts.length}/${ennemis.length - 1} alliés achevés` };
      }
      const restants = ennemis.filter(
        (ennemi) => ennemi.ref !== defi.cible && ennemi.pvActuels > 0,
      );
      return restants.length ? { etat: `rate` } : { etat: `assure` };
    }
    case `blitzkrieg`:
      return suivi.rondes > defi.rondesMax
        ? { etat: `rate` }
        : { etat: `en_cours`, detail: `ronde ${Math.max(1, suivi.rondes)}/${defi.rondesMax}` };
    case `survivant`:
      return combattants.some(
        (combattant) =>
          combattant.camp === `joueur` &&
          !combattant.creature &&
          combattant.pvActuels <= 0 &&
          // les héros déjà K.O. avant le combat ne comptent pas
          (!suivi.herosDepart || suivi.herosDepart.includes(combattant.ref)),
      )
        ? { etat: `rate` }
        : { etat: `en_cours` };
    case `abnegation`:
      return (suivi.soins ?? 0) > 0 ? { etat: `rate` } : { etat: `en_cours` };
    case `elementaire`:
      return Object.entries(suivi.degats ?? {}).some(
        ([el, degats]) => el !== defi.element && degats,
      )
        ? { etat: `rate` }
        : { etat: `en_cours` };
  }
  return { etat: `en_cours` };
}
