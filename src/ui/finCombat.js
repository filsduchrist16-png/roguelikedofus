// Pause de fin de combat : « Victoire ! » ou « Défaite… » par-dessus l'écran de combat,
// puis nettoyage de la couche d'effets (dégâts flottants, animations restées à l'écran).
import { BONUS_DEFI } from "../jeu/defis.js";
import { echapperHtml, parametres } from "./commun.js";

// Texte du bilan d'une victoire (XP, kamas, défi, montées de niveau). L'XP est omise si nulle.
export function texteBilan({
  xp = 0,
  kamas = 0,
  defiOk = false,
  niveaux = 0,
  libelleDefi = `défi +${Math.round(BONUS_DEFI * 100)} %`,
}) {
  return [
    xp ? `+${xp} XP` : ``,
    `+${kamas} k${defiOk ? ` (${libelleDefi})` : ``}`,
    niveaux ? `⬆ ${niveaux} niveau${niveaux > 1 ? `x` : ``}` : ``,
  ]
    .filter(Boolean)
    .join(` · `);
}

/**
 * @param {boolean} gagne
 * @param {string} [ligneDefi] texte du défi (réussi ou raté), facultatif
 * @returns {Promise<void>} résolue quand le voile est retiré
 */
export function afficherFinCombat(gagne, ligneDefi = ``) {
  return new Promise((resolve) => {
    const voile = document.createElement(`div`);
    voile.className = `fin-combat-voile ${gagne ? `victoire` : `defaite`}`;
    voile.setAttribute(`role`, `status`);
    voile.innerHTML = `<div class="fin-combat-boite">
        <p class="fin-combat-titre">${gagne ? `Victoire !` : `Défaite…`}</p>
        ${ligneDefi ? `<p class="fin-combat-defi">${echapperHtml(ligneDefi)}</p>` : ``}
      </div>`;
    let fini = false;
    const fermer = () => {
      if (fini) {
        return;
      }
      fini = true;
      clearTimeout(minuteur);
      document.removeEventListener(`keydown`, clavier, true);
      voile.remove();
      document.querySelectorAll(`.fx-layer`).forEach((couche) => couche.replaceChildren());
      resolve();
    };
    const clavier = (evenement) => {
      if (evenement.key === `Enter` || evenement.key === ` `) {
        evenement.preventDefault();
        evenement.stopPropagation();
        fermer();
      }
    };
    voile.addEventListener(`click`, fermer);
    document.addEventListener(`keydown`, clavier, true);
    document.body.appendChild(voile);
    const minuteur = setTimeout(fermer, parametres.combatRapide ? 400 : 900);
  });
}
