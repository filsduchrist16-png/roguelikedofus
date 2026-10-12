import { afficherEcran, barreContinuer, echapperHtml } from "../commun.js";
export function ecranMessage(titre, texte) {
  return new Promise((resolve) => {
    afficherEcran(`
      <h1>${echapperHtml(titre)}</h1>
      <p class="sous-titre">${echapperHtml(texte)}</p>
      ${barreContinuer(`btn-next`)}
    `);
    document.getElementById(`btn-next`)?.addEventListener(`click`, () => resolve());
  });
}
