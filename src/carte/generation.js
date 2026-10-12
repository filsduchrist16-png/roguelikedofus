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
  let total = entrees.reduce((acc, [, poids]) => acc + poids, 0);
  let tirage = rng() * total;
  for (let [type, poidsType] of entrees) {
    tirage -= poidsType;
    if (tirage < 0) {
      return type;
    }
  }
  return `combat`;
}
function remplirNoeud(rng, noeud, pools) {
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
// `premiereZone` : la rangée qui suit le premier combat d'un monde est une rangée de tavernes, pour
// recruter un troisième héros (ou se soigner) avant d'aller plus loin.
export function genererCarte(rng, pools, exclus = [], { premiereZone = false } = {}) {
  let poids = Object.fromEntries(
    Object.entries(CONFIG_CARTE.poids).filter(([type]) => !exclus.includes(type)),
  );
  let largeurs = largeursLignes(rng);
  let nbLignes = largeurs.length;
  let lignes = [];
  for (let ligne = 0; ligne < nbLignes; ligne++) {
    let colonnes = colonnesLigne(largeurs[ligne]);
    let noeudsLigne = [];
    colonnes.forEach((colonne, indice) => {
      let type =
        ligne === 0
          ? `combat`
          : ligne === nbLignes - 1
            ? `donjon`
            : ligne === 1 && premiereZone && !exclus.includes(`taverne`)
              ? `taverne`
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
