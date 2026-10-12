import { MONSTRES, RELIQUES } from "../../data/index.js";
import { afficherEcran, barreContinuer, cheminAsset, echapperHtml } from "../commun.js";
export function ecranCaptureArchi(noms) {
  return new Promise((resolve) => {
    let pluriel = noms.length > 1;
    afficherEcran(`
      <h1>✨ Âme${pluriel ? `s` : ``} d'Archimonstre capturée${pluriel ? `s` : ``} !</h1>
      <p class="sous-titre">${noms.map(echapperHtml).join(`, `)} ${pluriel ? `rejoignent` : `rejoint`} ton bestiaire (Dofus Ocre).</p>
      ${barreContinuer(`capt-ok`)}
    `);
    document.getElementById(`capt-ok`)?.addEventListener(`click`, () => resolve());
  });
}
export function ecranReliques(ids) {
  return new Promise((resolve) => {
    let pluriel = ids.length > 1;
    let html = ids
      .map(
        (id) => `<div class="relique-obtenue">
        <span class="relique-halo"><img src="${cheminAsset(`/assets/reliques/${id}.png`)}" alt="" onerror="this.remove()" /></span>
        <b>${echapperHtml(RELIQUES[id]?.nom ?? id)}</b>
        <small>lâchée par ${echapperHtml(MONSTRES[id]?.nom ?? id)}</small>
      </div>`,
      )
      .join(``);
    afficherEcran(`
      <h1>Relique${pluriel ? `s` : ``} obtenue${pluriel ? `s` : ``} !</h1>
      <p class="sous-titre">Elle${pluriel ? `s rejoignent` : ` rejoint`} ta collection, dans le Bestiaire.</p>
      <div class="reliques-obtenues">${html}</div>
      ${barreContinuer(`reliques-ok`)}
    `);
    document.getElementById(`reliques-ok`)?.addEventListener(`click`, () => resolve());
  });
}
