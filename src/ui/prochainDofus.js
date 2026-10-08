// Encart « Prochain Dofus » de l'accueil : le Dofus suivant dans l'ordre de Dofus 3, ses quêtes
// (faites ou non, avec où les faire) et, s'il attend, les Dofus qui manquent avant lui.
import { DOFUS } from "../data/index.js";
import { indiceQuete, mondeDuDofus, succesDuDofus } from "../jeu/obtention.js";
import { contexteMeta, etatQuete } from "../jeu/quetes.js";
import { dofusEnAttente, dofusManquantsAvant } from "../sauvegarde/meta.js";
import { cheminAsset, echapperHtml } from "./commun.js";

/** Le prochain Dofus à viser : le moins haut niveau parmi ceux qu'on n'a pas. */
export function prochainDofus(meta) {
  const possedes = new Set(meta.dofus.map((d) => d.id));
  return Object.values(DOFUS)
    .filter((d) => !possedes.has(d.id) && succesDuDofus(d.id))
    .sort((a, b) => a.niveau - b.niveau)[0];
}

export function htmlProchainDofus(meta) {
  const d = prochainDofus(meta);
  if (!d) {
    return ``;
  }
  const succes = succesDuDofus(d.id);
  const ctx = contexteMeta(meta);
  const etat = meta.quetes ?? { faites: [], compteurs: {} };
  const lignes = succes.quetes.map((q) => {
    const e = etatQuete(etat, q, ctx);
    const compteur =
      e.compteur && !e.faite ? ` <small>${e.compteur[0]}/${e.compteur[1]}</small>` : ``;
    return `<li class="${e.faite ? `fait` : ``}" title="${echapperHtml(indiceQuete(q))}">${e.faite ? `✔` : `○`} ${echapperHtml(q.nom.replace(/\.$/, ``))}${compteur}</li>`;
  });
  const enAttente = dofusEnAttente(meta);
  const manquants = dofusManquantsAvant(meta, d.id);
  const monde = mondeDuDofus(d.id);
  const attente = enAttente.length
    ? `<p class="pd-attente">⏳ En attente : ${enAttente.map((id) => echapperHtml(DOFUS[id].nom)).join(`, `)} (quêtes finies, ils arrivent dès que ${echapperHtml(d.nom)} est obtenu).</p>`
    : ``;
  return `<section class="prochain-dofus" aria-label="Prochain Dofus">
    <img class="pd-img" src="${cheminAsset(d.img)}" alt="" onerror="this.remove()" />
    <div class="pd-corps">
      <p class="pd-titre"><small>Prochain Dofus</small> <b>${echapperHtml(d.nom)}</b> <span class="pd-niv">niv. ${d.niveau}${monde ? ` · ${echapperHtml(monde.nom)}` : ``}</span></p>
      <ul class="pd-quetes">${lignes.join(``)}</ul>
      ${manquants.length ? `<p class="pd-attente">Il faut d'abord : ${manquants.map((id) => echapperHtml(DOFUS[id].nom)).join(`, `)}.</p>` : ``}
      ${attente}
    </div>
  </section>`;
}
