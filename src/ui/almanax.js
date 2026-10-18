// Encart « Almanax du jour » de l'accueil : la quête du jour, son progrès et sa récompense.
import { TEXTES_RECOMPENSE, dateLisible, etatAlmanax } from "../jeu/almanax.js";
import { echapperHtml } from "./commun.js";

export function htmlAlmanax(meta, date) {
  const etat = etatAlmanax(meta, date);
  const { quete, progres } = etat;
  const pct = Math.round((progres / quete.objectif) * 100);
  const enAttente = etat.enAttente
    ? `<p class="almanax-attente">🎁 Récompense prête : ${echapperHtml(TEXTES_RECOMPENSE[etat.enAttente.type])} (hors run du jour et Songes).</p>`
    : ``;
  return `<section class="almanax${etat.fait ? ` almanax-fait` : ``}" aria-label="Almanax du jour">
    <p class="almanax-entete">📅 Almanax du ${echapperHtml(dateLisible(etat.date))}</p>
    <p class="almanax-quete"><span aria-hidden="true">${quete.icone}</span> ${echapperHtml(quete.texte)}${etat.fait ? ` <b class="almanax-ok">✔ accompli</b>` : ``}</p>
    <div class="almanax-jauge" role="progressbar" aria-label="Progrès de l'Almanax" aria-valuemin="0" aria-valuemax="${quete.objectif}" aria-valuenow="${progres}"><span style="width:${pct}%"></span><b>${progres}/${quete.objectif}</b></div>
    <p class="almanax-recompense">${etat.fait ? `Reviens demain pour une nouvelle quête.` : `Récompense : ${echapperHtml(TEXTES_RECOMPENSE[etat.recompense])}. Suivie pendant les runs (pas dans les Songes).`}</p>
    ${enAttente}
  </section>`;
}
