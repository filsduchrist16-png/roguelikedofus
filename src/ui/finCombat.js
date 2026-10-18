// Pause de fin de combat : « Victoire ! » ou « Défaite… » par-dessus l'écran de combat,
// puis nettoyage de la couche d'effets (dégâts flottants, animations restées à l'écran).
import { BONUS_DEFI } from "../jeu/defis.js";
import { echapperHtml, parametres } from "./commun.js";
import { etatVueCombat } from "./combat.js";

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

// Résumé lisible d'un combat terminé : rondes jouées, ennemis vaincus, état de chaque héros.
// Les invocations (créatures, tourelles, Lance, Égide) ne comptent pas.
export function resumeFinCombat(combattants = [], rondes = 0) {
  const vrai = (combattant) =>
    !combattant.creature &&
    !combattant.tourelle &&
    !combattant.estLance &&
    !combattant.estEgide &&
    !combattant.estInvocation &&
    !combattant.invoquePar;
  const ennemis = combattants.filter(
    (combattant) => combattant.camp === `ennemi` && vrai(combattant),
  );
  const heros = combattants
    .filter((combattant) => combattant.camp === `joueur` && vrai(combattant))
    .map((combattant) => ({
      nom: combattant.nom,
      pv: Math.max(0, Math.round(combattant.pvActuels)),
      pvMax: combattant.pvMax,
      ko: combattant.pvActuels <= 0,
    }));
  return {
    rondes,
    vaincus: ennemis.filter((ennemi) => ennemi.pvActuels <= 0).length,
    ennemis: ennemis.length,
    heros,
    ko: heros.filter((hero) => hero.ko).length,
  };
}
function htmlResume(resume) {
  if (!resume?.heros?.length) {
    return ``;
  }
  const infos = [
    resume.rondes ? `${resume.rondes} ronde${resume.rondes > 1 ? `s` : ``}` : ``,
    resume.ennemis
      ? `${resume.vaincus}/${resume.ennemis} ennemi${resume.ennemis > 1 ? `s` : ``} vaincu${resume.ennemis > 1 ? `s` : ``}`
      : ``,
    resume.ko ? `☠ ${resume.ko} héros K.O.` : `aucun héros K.O.`,
  ].filter(Boolean);
  return `<p class="fin-combat-infos">${infos.map(echapperHtml).join(` · `)}</p>
    <ul class="fin-combat-heros">${resume.heros
      .map(
        (hero) =>
          `<li class="${hero.ko ? `ko` : ``}"><b>${echapperHtml(hero.nom)}</b> ${hero.ko ? `K.O.` : `${hero.pv}/${hero.pvMax}`}</li>`,
      )
      .join(``)}</ul>`;
}

/**
 * @param {boolean} gagne
 * @param {string} [ligneDefi] texte du défi (réussi ou raté), facultatif
 * @param {ReturnType<typeof resumeFinCombat>} [resume] bilan affiché sous le titre (facultatif)
 * @returns {Promise<void>} résolue quand le voile est retiré
 */
export function afficherFinCombat(
  gagne,
  ligneDefi = ``,
  resume = resumeFinCombat(...etatVueCombat()),
) {
  return new Promise((resolve) => {
    const voile = document.createElement(`div`);
    voile.className = `fin-combat-voile ${gagne ? `victoire` : `defaite`}`;
    voile.setAttribute(`role`, `status`);
    voile.innerHTML = `<div class="fin-combat-boite">
        <p class="fin-combat-titre">${gagne ? `Victoire !` : `Défaite…`}</p>
        ${ligneDefi ? `<p class="fin-combat-defi">${echapperHtml(ligneDefi)}</p>` : ``}
        ${htmlResume(resume)}
        <p class="fin-combat-suite">Touche pour continuer</p>
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
    // le bilan reste le temps d'être lu ; un appui le ferme plus tôt
    const lisible = resume?.heros?.length ? 900 : 0;
    const minuteur = setTimeout(fermer, (parametres.combatRapide ? 400 : 900) + lisible);
  });
}
