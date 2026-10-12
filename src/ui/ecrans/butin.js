import { CLASSES } from "../../data/index.js";

import { equiperMeilleur, planEquiper } from "../../jeu/inventaire.js";
import {
  afficherEcran,
  attrTipObjet,
  barreContinuer,
  boutonContinuer,
  classeRarete,
  echapperHtml,
  htmlBadgesHeros,
  htmlChipsObjet,
  htmlMetaObjet,
  htmlNomObjet,
  imgObjet,
  photoEquipement,
  restaurerEquipement,
} from "../commun.js";
import { afficherAstuce, afficherBandeau } from "./succes.js";
// run (facultatif) : pour montrer à qui sert chaque objet et proposer de l'équiper tout de suite.
// bilan (facultatif) : XP et kamas gagnés au combat, en sous-titre.
export function ecranButin(e, run, bilan) {
  return new Promise((resolve) => {
    afficherAstuce(
      `butin`,
      `Prends ce qui te sert : dans l'inventaire, ⚡ Équiper le meilleur équipe tes héros en un geste.`,
    );
    let n = e
      .map((e, k) => {
        return `<div class="drop-item${classeRarete(e)}"${attrTipObjet(e.id)} data-drop="${k}">
        <img src="${imgObjet(e.id)}" alt="" loading="lazy" onerror="this.remove()" />
        <span class="drop-nom">${htmlNomObjet(e)}<small><span class="ic-meta">${htmlMetaObjet(e)}</span> ${htmlChipsObjet(e)}</small>${run ? htmlBadgesHeros(e, run.persos) : ``}</span>
      </div>`;
      })
      .join(``);
    const utiles = run ? planEquiper(run).length : 0;
    afficherEcran(`
      <h1>🎁 Butin !</h1>
      ${bilan ? `<p class="sous-titre drop-bilan">${echapperHtml(bilan)}</p>` : ``}
      <p class="sous-titre">L'équipe ramasse ${e.length} pièce${e.length > 1 ? `s` : ``} d'équipement.</p>
      <div class="drop-liste">${n}</div>
      ${
        utiles
          ? `<div class="boutons-ecran butin-boutons"><button id="drop-equiper" class="primaire">⚡ Équiper (${utiles})</button>${boutonContinuer(`drop-ok`)}</div>`
          : barreContinuer(`drop-ok`)
      }
    `);
    document.getElementById(`drop-equiper`)?.addEventListener(`click`, (ev) => {
      const bouton = ev.currentTarget;
      // de quoi annuler : l'équipement d'avant et les pastilles « pour qui » de chaque objet
      const photo = photoEquipement(run);
      const badgesAvant = e.map(
        (_, k) => document.querySelector(`[data-drop="${k}"] .badges-heros`)?.outerHTML ?? ``,
      );
      const nb = equiperMeilleur(run);
      bouton.disabled = true;
      // qui porte maintenant chaque objet du butin
      e.forEach((inst, k) => {
        const porteur = run.persos.find((p) => Object.values(p.equipement).includes(inst));
        const ligne = document.querySelector(`[data-drop="${k}"] .drop-nom`);
        if (!porteur || !ligne) {
          return;
        }
        ligne.querySelector(`.badges-heros`)?.remove();
        ligne.insertAdjacentHTML(
          `beforeend`,
          `<span class="badges-heros"><span class="badge-heros badge-porte">✓ sur ${echapperHtml(CLASSES[porteur.classeId]?.nom ?? porteur.classeId)}</span></span>`,
        );
      });
      if (!nb) {
        afficherBandeau(`Rien à équiper`);
        return;
      }
      // « ✓ n objets équipés · Annuler » : remet les anciens objets (échanges de planEquiper)
      const ligneAnnul = document.createElement(`p`);
      ligneAnnul.className = `sous-titre butin-annul`;
      ligneAnnul.setAttribute(`role`, `status`);
      ligneAnnul.innerHTML = `✓ ${nb} objet${nb > 1 ? `s` : ``} équipé${nb > 1 ? `s` : ``} · <button class="secondaire petit">Annuler</button>`;
      document.querySelector(`.drop-liste`)?.after(ligneAnnul);
      const annuler = ligneAnnul.querySelector(`button`);
      annuler.focus({ preventScroll: true });
      annuler.addEventListener(`click`, () => {
        restaurerEquipement(run, photo);
        e.forEach((_, k) => {
          const ligne = document.querySelector(`[data-drop="${k}"] .drop-nom`);
          ligne?.querySelector(`.badges-heros`)?.remove();
          if (badgesAvant[k]) {
            ligne?.insertAdjacentHTML(`beforeend`, badgesAvant[k]);
          }
        });
        ligneAnnul.remove();
        bouton.disabled = false;
        bouton.focus({ preventScroll: true });
        afficherBandeau(`↩ Équipement remis comme avant`);
      });
    });
    document.getElementById(`drop-ok`)?.addEventListener(`click`, () => resolve());
  });
}
