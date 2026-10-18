import { CLASSES } from "../../data/index.js";

import { equiperMeilleur, planEquiper } from "../../jeu/inventaire.js";
import {
  afficherEcran,
  attrTipObjet,
  barreContinuer,
  classeRarete,
  echapperHtml,
  htmlBadgesHeros,
  htmlChipsObjet,
  htmlMetaObjet,
  htmlNomObjet,
  imgObjet,
  parametres,
  photoEquipement,
  restaurerEquipement,
} from "../commun.js";
import { afficherAstuce, afficherBandeau } from "./succes.js";
const htmlPorte = (perso) =>
  `<span class="badges-heros"><span class="badge-heros badge-porte">✓ sur ${echapperHtml(CLASSES[perso.classeId]?.nom ?? perso.classeId)}</span></span>`;
// Liste des objets ramassés (partagée avec l'écran butin + récompense) ; un objet déjà porté (écran
// remontré après un rechargement) l'indique.
export function htmlListeButin(objets, run) {
  return objets
    .map((objet, indice) => {
      const porteur = run?.persos.find((perso) =>
        Object.values(perso.equipement ?? {}).includes(objet),
      );
      return `<div class="drop-item${classeRarete(objet)}"${attrTipObjet(objet.id)} data-drop="${indice}">
        <img src="${imgObjet(objet.id)}" alt="" loading="lazy" onerror="this.remove()" />
        <span class="drop-nom">${htmlNomObjet(objet)}<small><span class="ic-meta">${htmlMetaObjet(objet)}</span> ${htmlChipsObjet(objet)}</small>${porteur ? htmlPorte(porteur) : run ? htmlBadgesHeros(objet, run.persos) : ``}</span>
      </div>`;
    })
    .join(``);
}
// Bouton « ⚡ Équiper le meilleur (n) » sous la liste (vide s'il n'y a rien à équiper).
export function htmlEquiperButin(run) {
  const utiles = run ? planEquiper(run).length : 0;
  return utiles
    ? `<p class="butin-equiper"><button id="drop-equiper" class="primaire">⚡ Équiper le meilleur (${utiles})</button></p>`
    : ``;
}
// Branche « Équiper le meilleur » et son « Annuler » ; avec le réglage « Butin : équiper le
// meilleur d'office », l'applique dès l'ouverture. Renvoie vrai s'il a été appliqué d'office.
export function brancherEquiperButin(objets, run) {
  document.getElementById(`drop-equiper`)?.addEventListener(`click`, (ev) => {
    const bouton = ev.currentTarget;
    // de quoi annuler : l'équipement d'avant et les pastilles « pour qui » de chaque objet
    const photo = photoEquipement(run);
    const badgesAvant = objets.map(
      (_objet, indice) =>
        document.querySelector(`[data-drop="${indice}"] .badges-heros`)?.outerHTML ?? ``,
    );
    const nb = equiperMeilleur(run);
    bouton.disabled = true;
    // qui porte maintenant chaque objet du butin
    objets.forEach((inst, indice) => {
      const porteur = run.persos.find((perso) => Object.values(perso.equipement).includes(inst));
      const ligne = document.querySelector(`[data-drop="${indice}"] .drop-nom`);
      if (!porteur || !ligne) {
        return;
      }
      ligne.querySelector(`.badges-heros`)?.remove();
      ligne.insertAdjacentHTML(`beforeend`, htmlPorte(porteur));
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
    (document.querySelector(`.butin-equiper`) ?? document.querySelector(`.drop-liste`))?.after(
      ligneAnnul,
    );
    const annuler = ligneAnnul.querySelector(`button`);
    annuler.focus({ preventScroll: true });
    annuler.addEventListener(`click`, () => {
      restaurerEquipement(run, photo);
      objets.forEach((_objet, indice) => {
        const ligne = document.querySelector(`[data-drop="${indice}"] .drop-nom`);
        ligne?.querySelector(`.badges-heros`)?.remove();
        if (badgesAvant[indice]) {
          ligne?.insertAdjacentHTML(`beforeend`, badgesAvant[indice]);
        }
      });
      ligneAnnul.remove();
      bouton.disabled = false;
      bouton.focus({ preventScroll: true });
      afficherBandeau(`↩ Équipement remis comme avant`);
    });
  });
  // réglage « Butin : équiper le meilleur d'office » : appliqué dès l'ouverture, annulable
  const bouton = document.getElementById(`drop-equiper`);
  if (bouton && parametres.butinAutoEquiper) {
    bouton.click();
    return true;
  }
  return false;
}
// run (facultatif) : pour montrer à qui sert chaque objet et proposer de l'équiper tout de suite.
// bilan (facultatif) : XP et kamas gagnés au combat, en sous-titre.
export function ecranButin(objets, run, bilan) {
  return new Promise((resolve) => {
    afficherAstuce(
      `butin`,
      `Prends ce qui te sert : dans l'inventaire, ⚡ Équiper le meilleur équipe tes héros en un geste.`,
    );
    afficherEcran(`
      <h1>🎁 Butin !</h1>
      ${bilan ? `<p class="sous-titre drop-bilan">${echapperHtml(bilan)}</p>` : ``}
      <p class="sous-titre">L'équipe ramasse ${objets.length} pièce${objets.length > 1 ? `s` : ``} d'équipement.</p>
      <div class="drop-liste">${htmlListeButin(objets, run)}</div>
      ${htmlEquiperButin(run)}
      ${barreContinuer(`drop-ok`)}
    `);
    document.getElementById(`drop-ok`)?.addEventListener(`click`, () => resolve());
    if (run && brancherEquiperButin(objets, run)) {
      document.getElementById(`drop-ok`)?.focus({ preventScroll: true });
    }
  });
}
