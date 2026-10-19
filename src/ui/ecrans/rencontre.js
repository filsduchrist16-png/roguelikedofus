// Écran générique d'une rencontre : une illustration, un texte et des choix décrits.
import { afficherEcran, cheminAsset, echapperHtml, htmlKamas } from "../commun.js";
import { htmlBarreEquipe } from "../barreEquipe.js";

/**
 * @param {{titre: string, img?: string, texte: string, kamas?: number, equipe?: object[],
 *   choix: {id: string, libelle: string, detail?: string, prix?: number, desactive?: string}[]}} rencontre
 * @returns {Promise<string>} l'identifiant du choix
 */
export function ecranRencontre(rencontre) {
  return new Promise((resolve) => {
    afficherEcran(
      `
      <h1>${echapperHtml(rencontre.titre)}</h1>
      ${rencontre.equipe?.length ? htmlBarreEquipe(rencontre.equipe) : ``}
      ${rencontre.img ? `<img class="rencontre-img" src="${cheminAsset(rencontre.img)}" alt="" onerror="this.remove()" />` : ``}
      <p class="sous-titre rencontre-texte">${echapperHtml(rencontre.texte)}</p>
      ${rencontre.kamas !== undefined ? `<p class="rencontre-bourse">Ta bourse : ${htmlKamas(rencontre.kamas)}</p>` : ``}
      <div class="rencontre-choix">
        ${rencontre.choix
          .map(
            (
              choix,
            ) => `<button class="rencontre-option${choix.id === `partir` ? ` secondaire` : ``}" data-choix="${choix.id}" ${choix.desactive ? `disabled title="${echapperHtml(choix.desactive)}"` : ``}>
            <span class="rencontre-libelle">${choix.img ? `<img class="rencontre-choix-img" src="${cheminAsset(choix.img)}" alt="" onerror="this.remove()" />` : ``}${echapperHtml(choix.libelle)}${choix.prix !== undefined ? ` · ${htmlKamas(choix.prix)}` : ``}</span>
            ${choix.detail ? `<small>${echapperHtml(choix.detail)}</small>` : ``}
            ${choix.desactive ? `<small class="rencontre-bloque">${echapperHtml(choix.desactive)}</small>` : ``}
          </button>`,
          )
          .join(``)}
      </div>
    `,
      `ecran-rencontre`,
    );
    document
      .querySelectorAll(`[data-choix]`)
      .forEach((bouton) => bouton.addEventListener(`click`, () => resolve(bouton.dataset.choix)));
  });
}
