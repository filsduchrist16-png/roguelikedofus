// Cartes de récompense (amélioration de sort, relique de run, bonus), montrées sur l'écran butin +
// récompense après un combat (apresCombat.js) et dans les Songes. Mobile d'abord : l'effet exact
// est écrit sur la carte (pas besoin d'infobulle).
import { NOMS_RARETES_CHOIX, decrireChoix } from "../../jeu/recompensesRun.js";
import { echapperHtml, iconeSort } from "../commun.js";

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
