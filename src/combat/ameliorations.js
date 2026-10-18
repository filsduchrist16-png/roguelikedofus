// Améliorations de sort (choix de récompense après un combat) et effets des reliques de run vus
// par le moteur. Une amélioration ne change jamais SORTS : le moteur travaille sur une copie du
// sort propre au héros (`sortAmeliore`), obtenue aux points d'entrée (coût, cibles, lancer).

// Résolveurs à part (bombes, pièges, boomerang…) : leurs dégâts ne passent pas par la résolution
// standard, donc ni poison, ni vol de vie, ni bouclier, ni éclaboussure ajoutés.
const RESOLUTION_SPECIALE = [
  `poseBombe`,
  `posePiege`,
  `kaboom`,
  `boomerang`,
  `enflammee`,
  `degatsPoussee`,
  `soinLigneAvantRatio`,
  `mixte`,
  `changeLigne`,
  `invoqueLance`,
  `invoqueEgide`,
  `rappelleLance`,
  `redirigeArriere`,
  `marqueProie`,
  `paParTourLigne`,
  `posePortail`,
  `paProchainTourLigne`,
  `facesAleatoires`,
  `consommeRage`,
];
const offensif = (sort) => sort.type === `degats` && sort.baseMax > 0;
/** Sort de dégâts résolu par la résolution standard (celle qui gère poison, vol de vie…). */
export const degatsStandard = (sort) =>
  offensif(sort) &&
  (sort.cible === `ennemi_ligne` || sort.cible === `ennemi_tous`) &&
  !RESOLUTION_SPECIALE.some((cle) => sort[cle]);

/**
 * Améliorations possibles. `possible(sort)` dit si elle a un sens pour ce sort, `appliquer(copie)`
 * modifie la copie du sort avec des clés que le moteur gère déjà, `texte(sort)` l'effet exact.
 */
export const AMELIORATIONS_SORT = {
  puissance: {
    nom: `Puissance`,
    icone: `💪`,
    rarete: `commun`,
    texte: (sort) => (sort.type === `soin` ? `+15 % de soins` : `+15 % de dégâts`),
    possible: (sort) =>
      (sort.type === `degats` || sort.type === `soin`) && sort.baseMax > 0 && !sort.soinComplet,
    appliquer: (sort) => {
      sort.baseMin *= 1.15;
      sort.baseMax *= 1.15;
    },
  },
  venin: {
    nom: `Venin`,
    icone: `🧪`,
    rarete: `commun`,
    texte: () => `Empoisonne : 15 % des dégâts du coup à chacun des 2 tours suivants`,
    possible: (sort) => degatsStandard(sort) && !sort.poison && !sort.poisonSiPortails,
    // poison proportionnel au coup, comme celui des portails de l'Eliotrope (seuil 0 : toujours)
    appliquer: (sort) => {
      sort.poisonSiPortails = { seuil: 0, ratio: 0.15, duree: 2 };
    },
  },
  vampirisme: {
    nom: `Vampirisme`,
    icone: `🩸`,
    rarete: `commun`,
    texte: () => `Rend en PV 15 % des dégâts infligés`,
    possible: (sort) => degatsStandard(sort),
    appliquer: (sort) => {
      sort.vampirismeRatio = (sort.vampirismeRatio ?? 0) + 0.15;
    },
  },
  rempart: {
    nom: `Rempart`,
    icone: `🛡️`,
    rarete: `commun`,
    texte: () => `Bouclier égal à 20 % des dégâts infligés`,
    possible: (sort) => degatsStandard(sort) && !sort.bouclierRatioDegats,
    appliquer: (sort) => {
      sort.bouclierRatioDegats = 0.2;
    },
  },
  precision: {
    nom: `Précision`,
    icone: `🎯`,
    rarete: `rare`,
    texte: () => `+10 % de chance de coup critique`,
    possible: (sort) => offensif(sort) && !sort.sansEsquiveNiCrit,
    appliquer: (sort) => {
      sort.critBonusSort = (sort.critBonusSort ?? 0) + 0.1;
    },
  },
  economie: {
    nom: `Économie`,
    icone: `💠`,
    rarete: `rare`,
    texte: () => `Coûte 1 PA de moins`,
    possible: (sort) => sort.coutPA >= 3,
    appliquer: (sort) => {
      sort.coutPA = Math.max(1, sort.coutPA - 1);
    },
  },
  recharge: {
    nom: `Recharge`,
    icone: `⏱️`,
    rarete: `rare`,
    texte: () => `Recharge plus courte d'1 tour`,
    possible: (sort) => (sort.cooldownTours ?? 0) >= 2,
    appliquer: (sort) => {
      sort.cooldownTours -= 1;
    },
  },
  allonge: {
    nom: `Allonge`,
    icone: `🏹`,
    rarete: `rare`,
    texte: () => `Peut viser la ligne arrière`,
    possible: (sort) => sort.cible === `ennemi_ligne` && sort.type === `degats`,
    appliquer: (sort) => {
      sort.cible = `ennemi_tous`;
    },
  },
  eclaboussure: {
    nom: `Éclaboussure`,
    icone: `💥`,
    rarete: `epique`,
    texte: () => `Touche aussi le reste de la rangée de la cible (35 % des dégâts)`,
    possible: (sort) =>
      degatsStandard(sort) &&
      !sort.zoneLigne &&
      !sort.ratioLigne &&
      !sort.rebond &&
      !sort.zoneLance &&
      !sort.bonusParEnnemiToucheZone,
    appliquer: (sort) => {
      sort.ratioLigne = 0.35;
    },
  },
};
/** Nombre maximal d'améliorations sur un même sort. */
export const AMELIORATIONS_PAR_SORT = 2;

/** Améliorations encore possibles pour ce sort (sans celles déjà prises). */
export function ameliorationsPossibles(sort, deja = []) {
  if (!sort || deja.length >= AMELIORATIONS_PAR_SORT) {
    return [];
  }
  const copie = appliquerAmeliorations(sort, deja);
  return Object.keys(AMELIORATIONS_SORT).filter(
    (id) => !deja.includes(id) && AMELIORATIONS_SORT[id].possible(copie),
  );
}
function appliquerAmeliorations(sort, ids) {
  const copie = { ...sort, ameliorations: [...ids] };
  for (const id of ids) {
    AMELIORATIONS_SORT[id]?.appliquer(copie);
  }
  return copie;
}

// copies déjà calculées : sort d'origine → (liste d'améliorations → copie)
const cache = new WeakMap();
/**
 * Sort tel que ce combattant le lance : la copie améliorée si le héros a des améliorations pour ce
 * sort, sinon le sort lui-même. Sans effet sur une copie déjà améliorée.
 */
export function sortAmeliore(combattant, sort) {
  const ids = sort && combattant?.ameliorations?.[sort.id];
  if (!ids?.length || sort.ameliorations) {
    return sort;
  }
  let parSort = cache.get(sort);
  if (!parSort) {
    parSort = new Map();
    cache.set(sort, parSort);
  }
  const cle = ids.join(`,`);
  let copie = parSort.get(cle);
  if (!copie) {
    copie = appliquerAmeliorations(sort, ids);
    parSort.set(cle, copie);
  }
  return copie;
}
/** Textes des améliorations d'un sort pour un combattant : [`💪 Puissance : +20 % de dégâts`]. */
export function textesAmeliorations(combattant, sort) {
  const ids = (sort && combattant?.ameliorations?.[sort.id]) ?? [];
  return ids
    .filter((id) => AMELIORATIONS_SORT[id])
    .map((id) => {
      const def = AMELIORATIONS_SORT[id];
      return `${def.icone} ${def.nom} : ${def.texte(sort)}`;
    });
}

/** Effet d'une relique de run porté par un héros (0 si aucun). */
export const effetRun = (combattant, cle) => combattant?.effetsRun?.[cle] ?? 0;
