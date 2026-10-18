import { AFFIXES_GROUPE, CONFIG_CARTE, XP_PAR_COMBAT } from "../jeu/config.js";
const tirageEntierRng = (rng, lignesMin, lignesMax) =>
  lignesMin + Math.floor(rng() * (lignesMax - lignesMin + 1));
const choixAleatoire = (rng, liste) => liste[Math.floor(rng() * liste.length)];
function tirageSansRemise(rng, affixes, nombre) {
  let reste = [...affixes];
  let tires = [];
  while (tires.length < nombre && reste.length) {
    tires.push(reste.splice(Math.floor(rng() * reste.length), 1)[0]);
  }
  return tires;
}
function tirageType(rng, poids) {
  let entrees = Object.entries(poids);
  let total = entrees.reduce((acc, [, poidsType]) => acc + poidsType, 0);
  let tirage = rng() * total;
  for (let [type, poidsType] of entrees) {
    tirage -= poidsType;
    if (tirage < 0) {
      return type;
    }
  }
  return `combat`;
}
// Champs propres au contenu d'une case (retirés quand la case change de type).
const CHAMPS_CONTENU = [`combatId`, `xp`, `eliteModifs`, `piege`, `tresor`];
function remplirNoeud(rng, noeud, pools) {
  for (const champ of CHAMPS_CONTENU) {
    delete noeud[champ];
  }
  switch (noeud.type) {
    case `combat`:
      noeud.combatId = choixAleatoire(rng, pools.normales);
      noeud.xp = XP_PAR_COMBAT.combat;
      break;
    case `combat_dur`:
      noeud.combatId = choixAleatoire(rng, pools.elite);
      noeud.xp = XP_PAR_COMBAT.combat_dur;
      noeud.eliteModifs = tirageSansRemise(rng, AFFIXES_GROUPE, 1).map((affixe) => affixe.id);
      break;
    case `donjon`:
      noeud.combatId = choixAleatoire(rng, pools.boss);
      break;
    case `coffre`: {
      // contenu tiré avec la carte (même coffre après un rechargement, et pour tous en run du
      // jour) mais caché au joueur : relique de run ou objet, parfois un piège
      const { piege, relique } = CONFIG_CARTE.coffre;
      noeud.tresor = rng() < relique ? `relique` : `objet`;
      if (rng() < piege) {
        noeud.piege = rng() < 0.5 ? `combat` : `pv`;
        if (noeud.piege === `combat`) {
          noeud.combatId = choixAleatoire(rng, pools.normales);
          noeud.xp = XP_PAR_COMBAT.combat;
        }
      }
      break;
    }
  }
}
function largeursLignes(rng) {
  let { lignesMin, lignesMax } = CONFIG_CARTE;
  let nbLignes = tirageEntierRng(rng, lignesMin, lignesMax);
  if (nbLignes % 2 != 0) {
    nbLignes += nbLignes < lignesMax ? 1 : -1;
  }
  let largeurs = [];
  for (let indice = 0; indice < nbLignes - 1; indice++) {
    largeurs.push(indice % 2 == 0 ? 2 : 3);
  }
  largeurs.push(1);
  return largeurs;
}
const colonnesLigne = (largeur) => {
  switch (largeur) {
    case 2:
      return [-0.5, 0.5];
    case 3:
      return [-1, 0, 1];
    default:
      return [0];
  }
};
// Retire des types d'un tirage de poids ; si plus rien ne reste, un combat (ou le premier permis).
function tirageSauf(rng, poids, interdits) {
  const restants = Object.fromEntries(
    Object.entries(poids).filter(([type]) => !interdits.includes(type)),
  );
  if (Object.keys(restants).length) {
    return tirageType(rng, restants);
  }
  return interdits.includes(`combat`) ? (Object.keys(poids)[0] ?? `combat`) : `combat`;
}
function changerType(rng, noeud, type, pools) {
  noeud.type = type;
  remplirNoeud(rng, noeud, pools);
}
/**
 * Vrais choix de chemin (façon Slay the Spire) : depuis une case, les deux cases suivantes sont de
 * types différents. Les liens ne relient que des colonnes voisines, donc la règle est propre à chaque
 * rangée : sur 2 cases, elles diffèrent ; sur 3, celle du milieu diffère de ses deux voisines.
 * La rangée 0 (deux combats) propose deux groupes de monstres différents.
 */
function garantirChoix(rng, lignes, poids, pools) {
  const derniere = lignes.length - 1;
  for (let ligne = 1; ligne < derniere; ligne++) {
    const rangee = lignes[ligne];
    if (rangee.length === 2 && rangee[0].type === rangee[1].type) {
      changerType(rng, rangee[1], tirageSauf(rng, poids, [rangee[0].type]), pools);
    } else if (
      rangee.length === 3 &&
      (rangee[1].type === rangee[0].type || rangee[1].type === rangee[2].type)
    ) {
      changerType(rng, rangee[1], tirageSauf(rng, poids, [rangee[0].type, rangee[2].type]), pools);
    }
  }
  const depart = lignes[0];
  if (depart.length === 2 && new Set(pools.normales).size > 1) {
    while (depart[1].combatId === depart[0].combatId) {
      depart[1].combatId = choixAleatoire(rng, pools.normales);
    }
  }
}
// Rangées où l'on peut placer un combat dur garanti (ni la première, ni celle des tavernes, ni la
// dernière avant le donjon) et cases de repos garanties.
function garantirEtapes(rng, lignes, poids, pools) {
  const derniere = lignes.length - 1;
  // un camp de repos juste avant le donjon (l'autre case reste différente)
  const avantBoss = lignes[derniere - 1];
  if (poids.camp && avantBoss && !avantBoss.some((noeud) => noeud.type === `camp`)) {
    changerType(rng, avantBoss[Math.floor(rng() * avantBoss.length)], `camp`, pools);
  }
  // au moins un combat dur par carte : le chemin risqué existe toujours
  const tous = lignes.slice(2, derniere - 1).flat();
  if (poids.combat_dur && !tous.some((noeud) => noeud.type === `combat_dur`)) {
    const candidats = tous.filter((noeud) => {
      if (noeud.type !== `combat`) {
        return false;
      }
      const rangee = lignes[noeud.ligne];
      const indice = rangee.indexOf(noeud);
      // ses voisines ne doivent pas déjà être des combats durs (sinon le choix redevient faux)
      return [rangee[indice - 1], rangee[indice + 1]].every(
        (voisine) => !voisine || voisine.type !== `combat_dur`,
      );
    });
    if (candidats.length) {
      changerType(rng, choixAleatoire(rng, candidats), `combat_dur`, pools);
    }
  }
}
// `premiereZone` : la case du milieu de la rangée qui suit le premier combat d'un monde est une
// taverne (atteignable depuis les deux départs), pour recruter un troisième héros (ou se soigner)
// avant d'aller plus loin ; ses voisines proposent autre chose.
export function genererCarte(rng, pools, exclus = [], { premiereZone = false } = {}) {
  let poids = Object.fromEntries(
    Object.entries(CONFIG_CARTE.poids).filter(([type]) => !exclus.includes(type)),
  );
  let largeurs = largeursLignes(rng);
  let nbLignes = largeurs.length;
  let lignes = [];
  const rangeeTavernes = premiereZone && !exclus.includes(`taverne`);
  for (let ligne = 0; ligne < nbLignes; ligne++) {
    let colonnes = colonnesLigne(largeurs[ligne]);
    let noeudsLigne = [];
    colonnes.forEach((colonne, indice) => {
      let type =
        ligne === 0
          ? `combat`
          : ligne === nbLignes - 1
            ? `donjon`
            : ligne === 1 && rangeeTavernes
              ? colonne === 0
                ? `taverne`
                : tirageSauf(rng, poids, [`taverne`])
              : tirageType(rng, poids);
      let noeud = {
        id: `n${ligne}_${indice}`,
        type,
        ligne,
        colonne,
        suivants: [],
      };
      remplirNoeud(rng, noeud, pools);
      noeudsLigne.push(noeud);
    });
    lignes.push(noeudsLigne);
  }
  garantirEtapes(rng, lignes, poids, pools);
  garantirChoix(rng, lignes, poids, pools);
  for (let indice = 0; indice < nbLignes - 1; indice++) {
    for (let noeud of lignes[indice]) {
      noeud.suivants = lignes[indice + 1]
        .filter((candidat) => Math.abs(candidat.colonne - noeud.colonne) === 0.5)
        .map((candidat) => candidat.id);
    }
  }
  return {
    noeuds: lignes.flat(),
    courant: null,
    depart: lignes[0].map((noeud) => noeud.id),
  };
}
function typesZaap(exclus) {
  return Object.keys(CONFIG_CARTE.poids).filter(
    (type) => type !== `zaap` && type !== `donjon` && !exclus.includes(type),
  );
}
export function tirerTypeZaap(rng, exclus) {
  let types = typesZaap(exclus);
  if (!types.length) {
    throw Error(`tirerTypeZaap : aucun type de nœud disponible (tout est exclu)`);
  }
  let total = types.reduce((acc, item) => acc + (CONFIG_CARTE.poids[item] ?? 0), 0);
  let tirage = rng() * total;
  for (let type of types) {
    tirage -= CONFIG_CARTE.poids[type] ?? 0;
    if (tirage <= 0) {
      return type;
    }
  }
  return types[types.length - 1];
}
export const trouverNoeud = (carte, id) => carte.noeuds.find((noeud) => noeud.id === id);
export function cheminVisite(carte, depart, arrivee) {
  if (trouverNoeud(carte, arrivee)?.visite) {
    return depart === null || !!trouverNoeud(carte, depart)?.visite;
  }
  return false;
}
export function noeudsAtteignables(carte) {
  return (
    carte.courant === null ? carte.depart : (trouverNoeud(carte, carte.courant)?.suivants ?? [])
  )
    .map((id) => trouverNoeud(carte, id))
    .filter((noeud) => noeud !== undefined);
}
