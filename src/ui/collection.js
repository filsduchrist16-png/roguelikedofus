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
export function butinParCategorie(e) {
  // donjon secret : sa panoplie, et ses autres objets comme butin du boss
  if (e.startsWith(`secret:`)) {
    let ids = SECRETS[e.slice(7)]?.butin ?? [];
    let nom = ids.map((id) => EQUIPEMENTS[id]?.panoplie).find(Boolean) ?? null;
    let pano = ids.filter((id) => nom && EQUIPEMENTS[id].panoplie === nom);
    return {
      panoplie: nom ? { nom, ids: pano } : null,
      combats: [],
      elites: [],
      boss: ids.filter((id) => !pano.includes(id)).map((id) => ({ id, aussiElite: false })),
    };
  }
  let t = butinDeZone(e);
  if (!t) {
    return {
      panoplie: null,
      combats: [],
      elites: [],
      boss: [],
    };
  }
  let n = (e) => e.filter((e) => EQUIPEMENTS[e]);
  let r = n(t.normales);
  let i = r.filter((e) => EQUIPEMENTS[e].panoplie);
  let nom = i.length ? EQUIPEMENTS[i[0]].panoplie : null;
  let o = n(t.boss);
  return {
    panoplie: nom
      ? {
          nom,
          ids: i.filter((e) => EQUIPEMENTS[e].panoplie === nom),
        }
      : null,
    combats: r.filter((e) => EQUIPEMENTS[e].panoplie !== nom),
    elites: n(t.elites).filter((e) => !o.includes(e)),
    boss: o.map((id) => ({
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
