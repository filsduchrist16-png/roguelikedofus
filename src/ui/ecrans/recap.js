import { CLASSES, RELIQUES } from "../../data/index.js";
import { DIFFICULTES } from "../../jeu/config.js";
import {
  afficherEcran,
  barreRetour,
  echapperHtml,
  etoilesDifficulte,
  htmlKamas,
  imgSymboleClasse,
} from "../commun.js";
export function ecranRecap(e, t, n = []) {
  return new Promise((resolve) => {
    let e_stats = e.stats;
    let a = Math.max(1, ...Object.values(e_stats.degats));
    let o = Object.entries(e_stats.degats).sort((e, t) => t[1] - e[1])[0]?.[0];
    let s = e.persos
      .map((e) => {
        let t = e_stats.degats[e.classeId] ?? 0;
        let n = Math.round((t / a) * 100);
        return `<div class="recap-ligne">
          <img class="recap-sym" src="${imgSymboleClasse(e.classeId)}" alt="" onerror="this.remove()" />
          <span class="recap-nom">${echapperHtml(CLASSES[e.classeId].nom)}${e.classeId === o ? ` 👑` : ``}<small>Niv. ${e.progression.niveau}</small></span>
          <div class="recap-barre"><div class="recap-barre-rempli" style="width:${n}%"></div><span>${t.toLocaleString(`fr-FR`)} dégâts</span></div>
        </div>`;
      })
      .join(``);
    afficherEcran(`
      <h1 class="${t ? `` : `defaite`}">${t ? `🏆 Krosmoz traversé !` : `Équipe anéantie`}</h1>
      ${e.ascension >= 1 ? `<p class="asc-record">${echapperHtml(DIFFICULTES[e.ascension].nom)} <span class="asc-badge">${etoilesDifficulte(e.ascension)}</span></p>` : ``}
      <p class="sous-titre">${t ? `Toutes les zones du monde sont vaincues.` : `La run s'arrête ici. Tes Dofus et tes captures, eux, sont conservés.`}</p>
      <div class="recap-compteurs">
        <span class="recap-chip">🗺️ ${e_stats.zones} zone${e_stats.zones > 1 ? `s` : ``}</span>
        <span class="recap-chip">⚔️ ${e_stats.combats} combat${e_stats.combats > 1 ? `s` : ``} gagné${e_stats.combats > 1 ? `s` : ``}</span>
        <span class="recap-chip">🎒 ${e_stats.objets} objet${e_stats.objets > 1 ? `s` : ``}</span>
        <span class="recap-chip">✨ ${e_stats.archis} âme${e_stats.archis > 1 ? `s` : ``} capturée${e_stats.archis > 1 ? `s` : ``}</span>
        <span class="recap-chip">${htmlKamas(e_stats.kamasGagnes ?? 0)} gagnés</span>
      </div>
      <div class="recap-degats">${s}</div>
      ${e_stats.reliques?.length ? `<div class="recap-succes">${e_stats.reliques.map((e) => `<span class="succes-chip nouveau">Relique : ${echapperHtml(RELIQUES[e]?.nom ?? e)}</span>`).join(``)}</div>` : ``}
      ${n.length ? `<div class="recap-succes">${n.map((e) => `<span class="succes-chip nouveau">✓ ${echapperHtml(e.nom)}</span>`).join(``)}</div>` : ``}
      ${barreRetour(`recap-retour`, `Retour à l'accueil`)}
    `);
    document.getElementById(`recap-retour`)?.addEventListener(`click`, () => resolve());
  });
}
