// Encart « Dofus à portée » de l'accueil : les Dofus qu'on n'a pas encore et dont le succès est le
// plus avancé (à égalité, le moins haut niveau), avec leurs quêtes faites ou non et où les faire.
import { DOFUS } from "../data/index.js";
import { decrireQuete, indiceQuete, mondeDuDofus, succesDuDofus } from "../jeu/obtention.js";
import { contexteMeta, etatQuete, progressionSucces } from "../jeu/quetes.js";
import { cheminAsset, echapperHtml } from "./commun.js";

/** Les Dofus à viser, du plus avancé au moins avancé. */
export function dofusAPortee(meta) {
  const possedes = new Set(meta.dofus.map((d) => d.id));
  const etat = meta.quetes ?? { faites: [], compteurs: {} };
  return Object.values(DOFUS)
    .filter((d) => !possedes.has(d.id) && succesDuDofus(d.id))
    .map((d) => {
      const p = progressionSucces(etat, succesDuDofus(d.id));
      return { d, avance: p.faites / Math.max(1, p.total) };
    })
    .sort((a, b) => b.avance - a.avance || a.d.niveau - b.d.niveau)
    .map((x) => x.d);
}

function htmlUnDofus(meta, d) {
  const succes = succesDuDofus(d.id);
  const ctx = contexteMeta(meta);
  const etat = meta.quetes ?? { faites: [], compteurs: {} };
  const lignes = succes.quetes.map((q) => {
    const e = etatQuete(etat, q, ctx);
    const compteur =
      e.compteur && !e.faite ? ` <small>${e.compteur[0]}/${e.compteur[1]}</small>` : ``;
    return `<li class="${e.faite ? `fait` : ``}" data-tip="${echapperHtml(indiceQuete(q))}">${e.faite ? `✔` : `○`} ${echapperHtml(decrireQuete(q).titre)}${compteur}</li>`;
  });
  const monde = mondeDuDofus(d.id);
  return `<div class="pd-dofus" data-dofus="${echapperHtml(d.id)}">
    <img class="pd-img" src="${cheminAsset(d.img)}" alt="" onerror="this.remove()" />
    <div class="pd-corps">
      <p class="pd-titre"><b>${echapperHtml(d.nom)}</b> <span class="pd-niv">niv. ${d.niveau}${monde ? ` · ${echapperHtml(monde.nom)}` : ``}</span></p>
      <ul class="pd-quetes">${lignes.join(``)}</ul>
    </div>
  </div>`;
}

export function htmlProchainDofus(meta) {
  const liste = dofusAPortee(meta).slice(0, 2);
  if (!liste.length) {
    return ``;
  }
  return `<section class="prochain-dofus" aria-label="Dofus à portée">
    <p class="pd-entete">🥚 Dofus à portée <small>${meta.dofus.length}/${Object.keys(DOFUS).length} obtenus</small></p>
    ${liste.map((d) => htmlUnDofus(meta, d)).join(``)}
  </section>`;
}
