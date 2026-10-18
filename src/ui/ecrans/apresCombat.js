// Écran unique après un combat normal ou élite gagné : bilan et butin en haut, les trois cartes de
// récompense (ou « Passer ») dessous, « Continuer » toujours au même endroit, en bas. Mobile
// d'abord : une carte par ligne, l'effet exact écrit sur la carte.
import { secretDuMonde, nomCle } from "../../jeu/secret.js";
import {
  afficherEcran,
  barreContinuer,
  comportementDefilement,
  echapperHtml,
  htmlKamas,
  parametres,
} from "../commun.js";
import { brancherEquiperButin, htmlEquiperButin, htmlListeButin } from "./butin.js";
import { classeRareteChoix, htmlContenuChoix } from "./choixRecompense.js";
import { afficherAstuce } from "./succes.js";

/** Libellé du bouton « Continuer » selon la carte choisie (lecteurs d'écran, infobulle). */
export function libelleContinuer(choisi, offre) {
  if (choisi === null || choisi === undefined) {
    return `Choisis d'abord une récompense (ou passe)`;
  }
  return choisi === `passer`
    ? `Continuer en passant (+${offre.passer} kamas)`
    : `Continuer avec la récompense choisie`;
}

/**
 * Affiche butin + récompense ; résout l'indice de la carte choisie ou `passer`.
 * @param {{ objets: object[], bilan: string, cle: boolean }} butin
 * @param {{ elite: boolean, choix: object[], passer: number }} offre
 */
export function ecranApresCombat(butin, offre, run) {
  return new Promise((resolve) => {
    const { objets = [], bilan = ``, cle = false } = butin ?? {};
    if (objets.length) {
      afficherAstuce(
        `butin`,
        `Prends ce qui te sert : dans l'inventaire, ⚡ Équiper le meilleur équipe tes héros en un geste.`,
      );
    }
    const secret = cle ? secretDuMonde(run.trancheId) : null;
    const cartes = offre.choix
      .map(
        (choix, indice) =>
          `<button class="choix-rec-carte${classeRareteChoix(choix, run)}" data-choix="${indice}" aria-pressed="false">${htmlContenuChoix(choix, run)}</button>`,
      )
      .join(``);
    afficherEcran(
      `
      <h1>${offre.elite ? `🎖️ Victoire d'élite !` : `🏆 Victoire !`}</h1>
      ${bilan ? `<p class="sous-titre drop-bilan">${echapperHtml(bilan)}</p>` : ``}
      ${
        objets.length
          ? `<h2 class="ac-titre">🎁 Butin : ${objets.length} pièce${objets.length > 1 ? `s` : ``} d'équipement</h2>
      <div class="drop-liste">${htmlListeButin(objets, run)}</div>
      ${htmlEquiperButin(run)}`
          : `<p class="sous-titre ac-sans-butin">Pas d'équipement cette fois.</p>`
      }
      ${secret ? `<p class="ac-cle" role="status">🗝️ <b>${echapperHtml(nomCle(run.trancheId))}</b> : un des monstres portait une clé. Elle ouvre le donjon secret du monde, ${echapperHtml(secret.nom)}.</p>` : ``}
      <h2 class="ac-titre" id="ac-titre-rec">${offre.elite ? `🎖️ Récompense d'élite` : `🎁 Récompense`} : choisis-en une</h2>
      <div class="choix-rec-liste" role="group" aria-labelledby="ac-titre-rec">${cartes}</div>
      <p class="ac-passer"><button id="choix-rec-passer" class="secondaire" aria-pressed="false">Passer <span class="choix-rec-passer-gain">(+${htmlKamas(offre.passer)})</span></button></p>
      <p class="ac-aide" id="ac-aide" hidden>Choisis une récompense (ou passe) avant de continuer.</p>
      ${barreContinuer(`drop-ok`)}
    `,
      `ecran-apres-combat`,
    );
    const racine = document.querySelector(`.ecran-apres-combat`);
    const continuer = document.getElementById(`drop-ok`);
    const aide = document.getElementById(`ac-aide`);
    let choisi = null;
    let fini = false;
    const finir = () => {
      if (fini || choisi === null) {
        return;
      }
      fini = true;
      racine?.querySelectorAll(`button`).forEach((bouton) => (bouton.disabled = true));
      resolve(choisi);
    };
    const majContinuer = () => {
      const libelle = libelleContinuer(choisi, offre);
      continuer?.classList.toggle(`ac-attente`, choisi === null);
      continuer?.setAttribute(`aria-disabled`, String(choisi === null));
      continuer?.setAttribute(`aria-label`, libelle);
      continuer?.setAttribute(`title`, libelle);
    };
    const choisir = (valeur) => {
      choisi = valeur;
      racine?.querySelectorAll(`[data-choix], #choix-rec-passer`).forEach((bouton) => {
        const actif =
          bouton.id === `choix-rec-passer`
            ? valeur === `passer`
            : Number(bouton.dataset.choix) === valeur;
        bouton.classList.toggle(`ac-choisi`, actif);
        bouton.setAttribute(`aria-pressed`, String(actif));
      });
      if (aide) {
        aide.hidden = true;
      }
      majContinuer();
      // réglage « Récompense d'un seul appui » : la carte touchée vaut validation
      if (parametres.recompenseDirecte) {
        finir();
      }
    };
    racine
      ?.querySelectorAll(`[data-choix]`)
      .forEach((bouton) =>
        bouton.addEventListener(`click`, () => choisir(Number(bouton.dataset.choix))),
      );
    document.getElementById(`choix-rec-passer`)?.addEventListener(`click`, () => choisir(`passer`));
    continuer?.addEventListener(`click`, () => {
      if (choisi === null) {
        // rien de choisi : on montre les cartes au lieu de quitter l'écran
        if (aide) {
          aide.hidden = false;
        }
        racine
          ?.querySelector(`.choix-rec-liste`)
          ?.scrollIntoView({ block: `center`, behavior: comportementDefilement() });
        return;
      }
      finir();
    });
    majContinuer();
    if (objets.length) {
      brancherEquiperButin(objets, run);
    }
  });
}
