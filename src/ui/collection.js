import { EQUIPEMENTS, RELIQUES, SECRETS } from "../data/index.js";
import { butinDeZone, zonesDuMonde } from "../jeu/config.js";
import { racine } from "./commun.js";
export function pastilleReliques(e, t) {
  let length = e.filter((e) => RELIQUES[e]).length;
  if (length === 0) {
    return null;
  }
  let length_1 = e.filter((e) => RELIQUES[e] && t.includes(e)).length;
  if (length > 0 && length_1 === length) {
    return {
      texte: `✓`,
      complete: true,
    };
  }
  return {
    texte: length > 1 ? `${length_1}/${length}` : `?`,
    complete: false,
  };
}
// Butin d'une zone rangé pour l'Armurerie : ses panoplies (toutes leurs pièces, et où elles
// tombent), puis les autres objets par catégorie de combat.
export function butinParCategorie(e) {
  const vide = { panoplies: [], panoplie: null, combats: [], elites: [], boss: [] };
  const grouper = (listes) => {
    const noms = [];
    for (const [ids, ou] of listes) {
      for (const id of ids) {
        const nom = EQUIPEMENTS[id]?.panoplie;
        if (nom && !noms.some((p) => p.nom === nom)) {
          noms.push({ nom, ids: [], ou });
        }
        noms.find((p) => p.nom === nom)?.ids.push(id);
      }
    }
    return noms;
  };
  // donjon secret : ses panoplies, et ses autres objets comme butin du boss
  if (e.startsWith(`secret:`)) {
    const ids = (SECRETS[e.slice(7)]?.butin ?? []).filter((id) => EQUIPEMENTS[id]);
    const panoplies = grouper([[ids, `boss`]]);
    return {
      ...vide,
      panoplies,
      panoplie: panoplies[0] ?? null,
      boss: ids.filter((id) => !EQUIPEMENTS[id].panoplie).map((id) => ({ id, aussiElite: false })),
    };
  }
  const t = butinDeZone(e);
  if (!t) {
    return vide;
  }
  const n = (l) => l.filter((id) => EQUIPEMENTS[id]);
  const libre = (id) => !EQUIPEMENTS[id].panoplie;
  const boss = n(t.boss);
  const panoplies = grouper([
    [n(t.normales), `combats`],
    [n(t.elites), `elites`],
    [boss, `boss`],
  ]);
  return {
    panoplies,
    panoplie: panoplies[0] ?? null,
    combats: n(t.normales).filter(libre),
    elites: n(t.elites).filter((id) => libre(id) && !boss.includes(id)),
    boss: boss.filter(libre).map((id) => ({
      id,
      aussiElite: t.elites.includes(id),
    })),
  };
}
export function pastilleCollection(e, t) {
  if (!e.length) {
    return null;
  }
  let length = e.filter((e) => t[e]).length;
  if (length === e.length) {
    return {
      texte: `✓`,
      complete: true,
    };
  }
  return {
    texte: `${length}/${e.length}`,
    complete: false,
  };
}
export function progressionArmurerie(e, t) {
  let n = new Set();
  for (let t of zonesDuMonde(e)) {
    let e = butinDeZone(t.id);
    for (let t of e ? [...e.normales, ...e.elites, ...e.boss] : []) {
      if (EQUIPEMENTS[t]) {
        n.add(t);
      }
    }
  }
  for (let id of SECRETS[e.id]?.butin ?? []) {
    n.add(id);
  }
  let r = [...n].filter((e) => t[e]);
  return {
    fait: r.length,
    sur: n.size,
    legendaires: r.filter((e) => t[e] === `legendaire`).length,
  };
}
export function rendreEnGardantScroll(e, t) {
  let n = t ? (racine.querySelector(`.best-zones`)?.scrollTop ?? 0) : 0;
  let window_scrollY = window.scrollY;
  e();
  let i = racine.querySelector(`.best-zones`);
  if (i) {
    i.scrollTop = n;
  }
  window.scrollTo(0, window_scrollY);
}
