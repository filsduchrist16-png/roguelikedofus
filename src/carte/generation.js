import { AFFIXES_GROUPE, CONFIG_CARTE, XP_PAR_COMBAT } from "../jeu/config.js";
const tirageEntierRng = (e, lignesMin, lignesMax) =>
  lignesMin + Math.floor(e() * (lignesMax - lignesMin + 1));
const choixAleatoire = (e, t) => t[Math.floor(e() * t.length)];
function tirageSansRemise(e, AFFIXES_GROUPE, n) {
  let r = [...AFFIXES_GROUPE];
  let i = [];
  while (i.length < n && r.length) {
    i.push(r.splice(Math.floor(e() * r.length), 1)[0]);
  }
  return i;
}
function tirageType(e, t) {
  let n = Object.entries(t);
  let r = n.reduce((acc, [, t]) => acc + t, 0);
  let i = e() * r;
  for (let [e, t] of n) {
    i -= t;
    if (i < 0) {
      return e;
    }
  }
  return `combat`;
}
function remplirNoeud(e, t, n) {
  switch (t.type) {
    case `combat`:
      t.combatId = choixAleatoire(e, n.normales);
      t.xp = XP_PAR_COMBAT.combat;
      break;
    case `combat_dur`:
      t.combatId = choixAleatoire(e, n.elite);
      t.xp = XP_PAR_COMBAT.combat_dur;
      t.eliteModifs = tirageSansRemise(e, AFFIXES_GROUPE, 1).map((e) => e.id);
      break;
    case `donjon`:
      t.combatId = choixAleatoire(e, n.boss);
      break;
  }
}
function largeursLignes(e) {
  let { lignesMin, lignesMax } = CONFIG_CARTE;
  let r = tirageEntierRng(e, lignesMin, lignesMax);
  if (r % 2 != 0) {
    r += r < lignesMax ? 1 : -1;
  }
  let i = [];
  for (let e = 0; e < r - 1; e++) {
    i.push(e % 2 == 0 ? 2 : 3);
  }
  i.push(1);
  return i;
}
const colonnesLigne = (e) => {
  switch (e) {
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
export function genererCarte(e, t, n = [], { premiereZone = false } = {}) {
  let r = Object.fromEntries(Object.entries(CONFIG_CARTE.poids).filter(([e]) => !n.includes(e)));
  let i = largeursLignes(e);
  let i_length = i.length;
  let o = [];
  for (let ligne = 0; ligne < i_length; ligne++) {
    let s = colonnesLigne(i[ligne]);
    let c = [];
    s.forEach((colonne, o) => {
      let type =
        ligne === 0
          ? `combat`
          : ligne === i_length - 1
            ? `donjon`
            : ligne === 1 && premiereZone && !n.includes(`taverne`)
              ? `taverne`
              : tirageType(e, r);
      let l = {
        id: `n${ligne}_${o}`,
        type,
        ligne,
        colonne,
        suivants: [],
      };
      remplirNoeud(e, l, t);
      c.push(l);
    });
    o.push(c);
  }
  for (let e = 0; e < i_length - 1; e++) {
    for (let t of o[e]) {
      t.suivants = o[e + 1].filter((e) => Math.abs(e.colonne - t.colonne) === 0.5).map((e) => e.id);
    }
  }
  return {
    noeuds: o.flat(),
    courant: null,
    depart: o[0].map((e) => e.id),
  };
}
function typesZaap(e) {
  return Object.keys(CONFIG_CARTE.poids).filter(
    (t) => t !== `zaap` && t !== `donjon` && !e.includes(t),
  );
}
export function tirerTypeZaap(e, t) {
  let n = typesZaap(t);
  if (!n.length) {
    throw Error(`tirerTypeZaap : aucun type de nœud disponible (tout est exclu)`);
  }
  let r = n.reduce((acc, item) => acc + (CONFIG_CARTE.poids[item] ?? 0), 0);
  let i = e() * r;
  for (let e of n) {
    i -= CONFIG_CARTE.poids[e] ?? 0;
    if (i <= 0) {
      return e;
    }
  }
  return n[n.length - 1];
}
export const trouverNoeud = (e, t) => e.noeuds.find((e) => e.id === t);
export function cheminVisite(e, t, n) {
  if (trouverNoeud(e, n)?.visite) {
    return t === null || !!trouverNoeud(e, t)?.visite;
  }
  return false;
}
export function noeudsAtteignables(e) {
  return (e.courant === null ? e.depart : (trouverNoeud(e, e.courant)?.suivants ?? []))
    .map((t) => trouverNoeud(e, t))
    .filter((e) => e !== undefined);
}
