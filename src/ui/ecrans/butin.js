import { EQUIPEMENTS } from "../../data/index.js";
import { RARETES_INFO } from "../../jeu/config.js";
import { equiperMeilleur, herosAmeliores } from "../../jeu/inventaire.js";
import {
  afficherEcran,
  attrTipObjet,
  barreContinuer,
  classeRarete,
  htmlBadgesHeros,
  htmlChipsObjet,
  htmlMetaObjet,
  htmlNomObjet,
  imgObjet,
} from "../commun.js";
// run (facultatif) : pour montrer à qui sert chaque objet et proposer de l'équiper tout de suite.
export function ecranButin(e, run) {
  return new Promise((resolve) => {
    let n = e
      .map((e) => {
        let t = EQUIPEMENTS[e.id];
        return `<div class="drop-item${classeRarete(e)}"${attrTipObjet(e.id)}>
        <img src="${imgObjet(e.id)}" alt="" loading="lazy" onerror="this.remove()" />
        <span class="drop-nom">${htmlNomObjet(e)}${e.rarete ? `<span class="drop-rarete inom-${e.rarete}">${RARETES_INFO[e.rarete].nom}</span>` : ``}<small><span class="ic-meta">${htmlMetaObjet(e)}</span> ${htmlChipsObjet(e)}</small>${run ? htmlBadgesHeros(e, run.persos) : ``}</span>
      </div>`;
      })
      .join(``);
    const utiles = run ? e.filter((inst) => herosAmeliores(inst, run.persos).length).length : 0;
    afficherEcran(`
      <h1>🎁 Butin !</h1>
      <p class="sous-titre">L'équipe ramasse ${e.length} pièce${e.length > 1 ? `s` : ``} d'équipement.</p>
      <div class="drop-liste">${n}</div>
      ${utiles ? `<p class="drop-auto"><button id="drop-equiper" class="primaire petit">⚡ Équiper les améliorations (${utiles})</button> <span id="drop-auto-msg" class="muet"></span></p>` : ``}
      ${barreContinuer(`drop-ok`)}
    `);
    document.getElementById(`drop-equiper`)?.addEventListener(`click`, (ev) => {
      const nb = equiperMeilleur(run);
      ev.currentTarget.disabled = true;
      const m = document.getElementById(`drop-auto-msg`);
      if (m) {
        m.textContent = nb
          ? `✓ ${nb} objet${nb > 1 ? `s` : ``} équipé${nb > 1 ? `s` : ``}.`
          : `Rien à équiper.`;
      }
    });
    document.getElementById(`drop-ok`)?.addEventListener(`click`, () => resolve());
  });
}
