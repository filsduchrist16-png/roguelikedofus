import { EQUIPEMENTS } from "../../data/index.js";
import { RARETES_INFO } from "../../jeu/config.js";
import {
  NOMS_SLOTS,
  afficherEcran,
  attrTipObjet,
  barreContinuer,
  classeRarete,
  htmlChipsObjet,
  htmlNomObjet,
  imgObjet,
} from "../commun.js";
export function ecranButin(e) {
  return new Promise((resolve) => {
    let n = e
      .map((e) => {
        let t = EQUIPEMENTS[e.id];
        return `<div class="drop-item${classeRarete(e)}"${attrTipObjet(e.id)}>
        <img src="${imgObjet(e.id)}" alt="" loading="lazy" onerror="this.remove()" />
        <span class="drop-nom">${htmlNomObjet(e)}${e.rarete ? `<span class="drop-rarete inom-${e.rarete}">${RARETES_INFO[e.rarete].nom}</span>` : ``}<small>${NOMS_SLOTS[t.slot]} ${htmlChipsObjet(e)}</small></span>
      </div>`;
      })
      .join(``);
    afficherEcran(`
      <h1>🎁 Butin !</h1>
      <p class="sous-titre">L'équipe ramasse ${e.length} pièce${e.length > 1 ? `s` : ``} d'équipement.</p>
      <div class="drop-liste">${n}</div>
      ${barreContinuer(`drop-ok`)}
    `);
    document.getElementById(`drop-ok`)?.addEventListener(`click`, () => resolve());
  });
}
