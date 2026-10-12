// Encart « Dofus à portée » de l'accueil : les Dofus qu'on n'a pas encore et dont le succès est le
// plus avancé (à égalité, le moins haut niveau), avec leurs quêtes faites ou non et où les faire.
import { DOFUS } from "../data/index.js";
import { decrireQuete, indiceQuete, mondeDuDofus, succesDuDofus } from "../jeu/obtention.js";
import { contexteMeta, etatQuete, progressionSucces } from "../jeu/quetes.js";
import { cheminAsset, echapperHtml } from "./commun.js";

/** Les Dofus à viser, du plus avancé au moins avancé. */
export function dofusAPortee(meta) {
  const possedes = new Set(meta.dofus.map((dofus) => dofus.id));
  const etat = meta.quetes ?? { faites: [], compteurs: {} };
  return Object.values(DOFUS)
    .filter((dofus) => !possedes.has(dofus.id) && succesDuDofus(dofus.id))
    .map((dofus) => {
      const progression = progressionSucces(etat, succesDuDofus(dofus.id));
      return { d: dofus, avance: progression.faites / Math.max(1, progression.total) };
    })
    .sort((premier, second) => second.avance - premier.avance || premier.d.niveau - second.d.niveau)
    .map((element) => element.d);
}

function htmlUnDofus(meta, dofus) {
  const succes = succesDuDofus(dofus.id);
  const ctx = contexteMeta(meta);
  const etat = meta.quetes ?? { faites: [], compteurs: {} };
  const lignes = succes.quetes.map((quete) => {
    const avancement = etatQuete(etat, quete, ctx);
    const compteur =
      avancement.compteur && !avancement.faite
        ? ` <small>${avancement.compteur[0]}/${avancement.compteur[1]}</small>`
        : ``;
    return `<li class="${avancement.faite ? `fait` : ``}" data-tip="${echapperHtml(indiceQuete(quete))}">${avancement.faite ? `✔` : `○`} ${echapperHtml(decrireQuete(quete).titre)}${compteur}</li>`;
  });
  const monde = mondeDuDofus(dofus.id);
  return `<div class="pd-dofus" data-dofus="${echapperHtml(dofus.id)}">
    <img class="pd-img" src="${cheminAsset(dofus.img)}" alt="" onerror="this.remove()" />
    <div class="pd-corps">
      <p class="pd-titre"><b>${echapperHtml(dofus.nom)}</b> <span class="pd-niv">niv. ${dofus.niveau}${monde ? ` · ${echapperHtml(monde.nom)}` : ``}</span></p>
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
    ${liste.map((dofus) => htmlUnDofus(meta, dofus)).join(``)}
  </section>`;
}
