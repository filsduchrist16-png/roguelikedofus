import { MONSTRES, RELIQUES } from "../../data/index.js";
import { afficherEcran, barreContinuer, cheminAsset, echapperHtml } from "../commun.js";
export function ecranCaptureArchi(e) {
  return new Promise((resolve) => {
    let n = e.length > 1;
    afficherEcran(`
      <h1>✨ Âme${n ? `s` : ``} d'Archimonstre capturée${n ? `s` : ``} !</h1>
      <p class="sous-titre">${e.map(echapperHtml).join(`, `)} ${n ? `rejoignent` : `rejoint`} ton bestiaire (Dofus Ocre).</p>
      ${barreContinuer(`capt-ok`)}
    `);
    document.getElementById(`capt-ok`)?.addEventListener(`click`, () => resolve());
  });
}
export function ecranReliques(e) {
  return new Promise((resolve) => {
    let n = e.length > 1;
    let r = e
      .map(
        (e) => `<div class="relique-obtenue">
        <span class="relique-halo"><img src="${cheminAsset(`/assets/reliques/${e}.png`)}" alt="" onerror="this.remove()" /></span>
        <b>${echapperHtml(RELIQUES[e]?.nom ?? e)}</b>
        <small>lâchée par ${echapperHtml(MONSTRES[e]?.nom ?? e)}</small>
      </div>`,
      )
      .join(``);
    afficherEcran(`
      <h1>Relique${n ? `s` : ``} obtenue${n ? `s` : ``} !</h1>
      <p class="sous-titre">Elle${n ? `s rejoignent` : ` rejoint`} ta collection, dans le Bestiaire.</p>
      <div class="reliques-obtenues">${r}</div>
      ${barreContinuer(`reliques-ok`)}
    `);
    document.getElementById(`reliques-ok`)?.addEventListener(`click`, () => resolve());
  });
}
