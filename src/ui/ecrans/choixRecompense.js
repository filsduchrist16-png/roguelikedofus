// Écran « Choisis une récompense » après un combat normal ou élite : trois cartes (amélioration de
// sort, relique de run, bonus) et « Passer » contre quelques kamas. Mobile d'abord : une carte par
// ligne, l'effet exact écrit sur la carte (pas besoin d'infobulle).
import { NOMS_RARETES_CHOIX, decrireChoix } from "../../jeu/recompensesRun.js";
import { afficherEcran, echapperHtml, htmlKamas, iconeSort } from "../commun.js";

/** Icône d'un choix : l'icône du sort amélioré, sinon un emoji. */
function htmlIconeChoix(description) {
  if (description.sortId) {
    return `<span class="choix-rec-icone choix-rec-icone-sort"><img src="${iconeSort(description.sortId)}" alt="" onerror="this.replaceWith(document.createTextNode('${description.icone}'))" /><b class="choix-rec-fleche" aria-hidden="true">⬆</b></span>`;
  }
  return `<span class="choix-rec-icone" aria-hidden="true">${description.icone}</span>`;
}
/** Contenu d'une carte de choix (partagé avec l'écran des Songes). */
export function htmlContenuChoix(choix, run) {
  const description = decrireChoix(choix, run);
  if (!description) {
    return ``;
  }
  return `${htmlIconeChoix(description)}
    <span class="choix-rec-texte">
      <span class="choix-rec-type">${echapperHtml(description.sousTitre)} · <span class="choix-rec-rarete">${NOMS_RARETES_CHOIX[description.rarete] ?? ``}</span></span>
      <b class="choix-rec-titre">${echapperHtml(description.titre)}</b>
      <span class="choix-rec-effet">${echapperHtml(description.effet)}</span>
    </span>`;
}
export const classeRareteChoix = (choix, run) =>
  ` choix-rec-${decrireChoix(choix, run)?.rarete ?? `commun`}`;

/**
 * Affiche l'offre ; résout l'indice de la carte choisie ou `passer`.
 * @param {{ elite: boolean, choix: object[], passer: number }} offre
 */
export function ecranChoixRecompense(offre, run) {
  return new Promise((resolve) => {
    const cartes = offre.choix
      .map(
        (choix, indice) =>
          `<button class="choix-rec-carte${classeRareteChoix(choix, run)}" data-choix="${indice}">${htmlContenuChoix(choix, run)}</button>`,
      )
      .join(``);
    afficherEcran(
      `
      <h1>${offre.elite ? `🎖️ Récompense d'élite` : `🎁 Récompense`}</h1>
      <p class="sous-titre">Choisis une récompense pour la suite de la run.</p>
      <div class="choix-rec-liste">${cartes}</div>
      <div class="boutons-ecran choix-rec-boutons">
        <button id="choix-rec-passer" class="secondaire">Passer <span class="choix-rec-passer-gain">(+${htmlKamas(offre.passer)})</span></button>
      </div>
    `,
      `ecran-choix-rec`,
    );
    const racineEcran = document.querySelector(`.ecran-choix-rec`);
    racineEcran?.querySelectorAll(`[data-choix]`).forEach((bouton) =>
      bouton.addEventListener(`click`, () => {
        // pas de double choix si on tape deux fois
        racineEcran.querySelectorAll(`button`).forEach((autre) => (autre.disabled = true));
        resolve(Number(bouton.dataset.choix));
      }),
    );
    document.getElementById(`choix-rec-passer`)?.addEventListener(`click`, () => {
      racineEcran?.querySelectorAll(`button`).forEach((autre) => (autre.disabled = true));
      resolve(`passer`);
    });
  });
}
/** Barre des reliques de run (équipement, bilan) : emoji + nom, effet en infobulle. */
export function htmlReliquesRun(reliques = [], titre = ``) {
  if (!reliques.length) {
    return ``;
  }
  return `<div class="reliques-run" aria-label="Reliques de run">${titre}${reliques
    .map(
      (relique) =>
        `<span class="relique-run" tabindex="0" data-tip="${echapperHtml(relique.desc)}">${relique.icone} ${echapperHtml(relique.nom)}</span>`,
    )
    .join(``)}</div>`;
}
