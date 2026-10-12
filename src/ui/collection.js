import { EQUIPEMENTS, RELIQUES, SECRETS } from "../data/index.js";
import { butinDeZone, zonesDuMonde } from "../jeu/config.js";
import { racine } from "./commun.js";
export function pastilleReliques(ids, possedees) {
  let nbReliques = ids.filter((id) => RELIQUES[id]).length;
  if (nbReliques === 0) {
    return null;
  }
  let nbPossedees = ids.filter((id) => RELIQUES[id] && possedees.includes(id)).length;
  if (nbReliques > 0 && nbPossedees === nbReliques) {
    return {
      texte: `✓`,
      complete: true,
    };
  }
  return {
    texte: nbReliques > 1 ? `${nbPossedees}/${nbReliques}` : `?`,
    complete: false,
  };
}
// Butin d'une zone rangé pour l'Armurerie : ses panoplies (toutes leurs pièces, et où elles
// tombent), puis les autres objets par catégorie de combat.
export function butinParCategorie(zoneId) {
  const vide = { panoplies: [], panoplie: null, combats: [], elites: [], boss: [] };
  const grouper = (listes) => {
    const noms = [];
    for (const [ids, ou] of listes) {
      for (const id of ids) {
        const nom = EQUIPEMENTS[id]?.panoplie;
        if (nom && !noms.some((entree) => entree.nom === nom)) {
          noms.push({ nom, ids: [], ou });
        }
        noms.find((entree) => entree.nom === nom)?.ids.push(id);
      }
    }
    return noms;
  };
  // donjon secret : ses panoplies, et ses autres objets comme butin du boss
  if (zoneId.startsWith(`secret:`)) {
    const ids = (SECRETS[zoneId.slice(7)]?.butin ?? []).filter((id) => EQUIPEMENTS[id]);
    const panopliesSecret = grouper([[ids, `boss`]]);
    return {
      ...vide,
      panoplies: panopliesSecret,
      panoplie: panopliesSecret[0] ?? null,
      boss: ids.filter((id) => !EQUIPEMENTS[id].panoplie).map((id) => ({ id, aussiElite: false })),
    };
  }
  const butin = butinDeZone(zoneId);
  if (!butin) {
    return vide;
  }
  const connus = (liste) => liste.filter((id) => EQUIPEMENTS[id]);
  const libre = (id) => !EQUIPEMENTS[id].panoplie;
  const boss = connus(butin.boss);
  const panoplies = grouper([
    [connus(butin.normales), `combats`],
    [connus(butin.elites), `elites`],
    [boss, `boss`],
  ]);
  return {
    panoplies,
    panoplie: panoplies[0] ?? null,
    combats: connus(butin.normales).filter(libre),
    elites: connus(butin.elites).filter((id) => libre(id) && !boss.includes(id)),
    boss: boss.filter(libre).map((id) => ({
      id,
      aussiElite: butin.elites.includes(id),
    })),
  };
}
export function pastilleCollection(ids, collection) {
  if (!ids.length) {
    return null;
  }
  let nbPossedes = ids.filter((id) => collection[id]).length;
  if (nbPossedes === ids.length) {
    return {
      texte: `✓`,
      complete: true,
    };
  }
  return {
    texte: `${nbPossedes}/${ids.length}`,
    complete: false,
  };
}
export function progressionArmurerie(monde, collection) {
  let ids = new Set();
  for (let zone of zonesDuMonde(monde)) {
    let butinZone = butinDeZone(zone.id);
    for (let objetId of butinZone
      ? [...butinZone.normales, ...butinZone.elites, ...butinZone.boss]
      : []) {
      if (EQUIPEMENTS[objetId]) {
        ids.add(objetId);
      }
    }
  }
  for (let id of SECRETS[monde.id]?.butin ?? []) {
    ids.add(id);
  }
  let possedes = [...ids].filter((id) => collection[id]);
  return {
    fait: possedes.length,
    sur: ids.size,
    legendaires: possedes.filter((id) => collection[id] === `legendaire`).length,
  };
}
export function rendreEnGardantScroll(rendre, garderZones) {
  let scrollZones = garderZones ? (racine.querySelector(`.best-zones`)?.scrollTop ?? 0) : 0;
  let scrollPage = window.scrollY;
  rendre();
  let zones = racine.querySelector(`.best-zones`);
  if (zones) {
    zones.scrollTop = scrollZones;
  }
  window.scrollTo(0, scrollPage);
}
