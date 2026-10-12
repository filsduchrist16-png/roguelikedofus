import { afficherEcran, barreContinuer, echapperHtml } from "../commun.js";
export function ecranMessage(e, t) {
  return new Promise((resolve) => {
    afficherEcran(`
      <h1>${echapperHtml(e)}</h1>
      <p class="sous-titre">${echapperHtml(t)}</p>
      ${barreContinuer(`btn-next`)}
    `);
    document.getElementById(`btn-next`)?.addEventListener(`click`, () => resolve());
  });
}
