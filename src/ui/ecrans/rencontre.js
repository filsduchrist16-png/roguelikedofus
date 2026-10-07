// Écran générique d'une rencontre : une illustration, un texte et des choix décrits.
import { afficherEcran, cheminAsset, echapperHtml, htmlKamas } from "../commun.js";

/**
 * @param {{titre: string, img?: string, texte: string, kamas?: number,
 *   choix: {id: string, libelle: string, detail?: string, prix?: number, desactive?: string}[]}} r
 * @returns {Promise<string>} l'identifiant du choix
 */
export function ecranRencontre(r) {
  return new Promise((resolve) => {
    afficherEcran(`
      <h1>${echapperHtml(r.titre)}</h1>
      ${r.img ? `<img class="rencontre-img" src="${cheminAsset(r.img)}" alt="" onerror="this.remove()" />` : ``}
      <p class="sous-titre rencontre-texte">${echapperHtml(r.texte)}</p>
      ${r.kamas !== undefined ? `<p class="rencontre-bourse">Ta bourse : ${htmlKamas(r.kamas)}</p>` : ``}
      <div class="rencontre-choix">
        ${r.choix
          .map(
            (
              c,
            ) => `<button class="rencontre-option${c.id === `partir` ? ` secondaire` : ``}" data-choix="${c.id}" ${c.desactive ? `disabled title="${echapperHtml(c.desactive)}"` : ``}>
            <span class="rencontre-libelle">${c.img ? `<img class="rencontre-choix-img" src="${cheminAsset(c.img)}" alt="" onerror="this.remove()" />` : ``}${echapperHtml(c.libelle)}${c.prix !== undefined ? ` · ${htmlKamas(c.prix)}` : ``}</span>
            ${c.detail ? `<small>${echapperHtml(c.detail)}</small>` : ``}
            ${c.desactive ? `<small class="rencontre-bloque">${echapperHtml(c.desactive)}</small>` : ``}
          </button>`,
          )
          .join(``)}
      </div>
    `);
    document
      .querySelectorAll(`[data-choix]`)
      .forEach((b) => b.addEventListener(`click`, () => resolve(b.dataset.choix)));
  });
}
