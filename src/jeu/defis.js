// Défis de combat, inspirés des challenges de DOFUS : un défi est tiré au début de chaque combat ;
// le réussir rapporte un bonus d'XP et de kamas.
import { SORTS } from "../data/index.js";

export const BONUS_DEFI = 0.3;

const DEFIS = {
  premier: {
    nom: `Premier`,
    texte: (d) => `Achève ${d.cibleNom} avant tous ses alliés.`,
    possible: ({ ennemis }) => ennemis.length >= 2,
  },
  dernier: {
    nom: `Dernier`,
    texte: (d) => `Achève ${d.cibleNom} après tous ses alliés.`,
    possible: ({ ennemis }) => ennemis.length >= 2,
  },
  blitzkrieg: {
    nom: `Blitzkrieg`,
    texte: (d) => `Gagne en ${d.rondesMax} rondes au plus.`,
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
      heros.some((h) =>
        h.sorts.some((id) => SORTS[id]?.type === `soin` || SORTS[id]?.soinEquipeRatio),
      ),
  },
  elementaire: {
    nom: `Élémentaire`,
    texte: (d) => `N'inflige des dégâts qu'en ${d.elementNom}.`,
    possible: ({ heros }) => elementCommun(heros) !== undefined,
  },
};

const NOMS_ELEMENTS = { terre: `Terre`, feu: `Feu`, eau: `Eau`, air: `Air` };

function elementCommun(heros) {
  const listes = heros.map((h) => h.elements ?? []);
  return listes[0]?.find((el) => listes.every((l) => l.includes(el)));
}

/** Tire un défi adapté au combat. `ennemis` et `heros` sont les combattants du début du combat. */
export function tirerDefi(rng, ennemis, heros) {
  const ctx = { ennemis, heros };
  const ids = Object.keys(DEFIS).filter((id) => DEFIS[id].possible(ctx));
  const id = ids[Math.floor(rng() * ids.length)];
  const defi = { id, nom: DEFIS[id].nom };
  if (id === `premier` || id === `dernier`) {
    // de préférence le boss, sinon un ennemi au hasard
    const boss = ennemis.find((e) => e.boss);
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
 * @param {object} r résultat du combat : gagne, rondes, herosKO, soins, degatsParElement,
 *   ordreMorts (refs des ennemis achevés, dans l'ordre)
 */
export function defiReussi(defi, r) {
  if (!defi || !r.gagne) {
    return false;
  }
  switch (defi.id) {
    case `premier`:
      return r.ordreMorts[0] === defi.cible;
    case `dernier`:
      return r.ordreMorts.at(-1) === defi.cible;
    case `blitzkrieg`:
      return r.rondes <= defi.rondesMax;
    case `survivant`:
      return !r.herosKO;
    case `abnegation`:
      return (r.soins ?? 0) === 0;
    case `elementaire`:
      return Object.entries(r.degatsParElement ?? {}).every(([el, v]) => el === defi.element || !v);
  }
  return false;
}
