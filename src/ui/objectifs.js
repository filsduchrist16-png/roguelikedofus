// Objectifs de succès du combat, façon suivi de succès de DOFUS : un panneau qui s'ouvre au début du
// combat, se replie en pastille 🏆 et se rouvre au toucher. Chaque objectif montre son état en
// direct (en cours, ✔ validé si tu gagnes, ✖ raté) et sa progression (ronde 2/4, 12/25…).
import { etatObjectif } from "../jeu/objectifs.js";
import { cheminAsset, echapperHtml } from "./commun.js";

let minuteur = null;
let objectifsCourants = [];
// replie la boîte (posé par afficherObjectifsCombat, appelé par la vue de combat)
let replier = null;
const ICONES = { en_cours: `○`, assure: `✔`, rate: `✖` };

export function retirerObjectifsCombat() {
  clearTimeout(minuteur);
  objectifsCourants = [];
  replier = null;
  document.getElementById(`objectifs-combat`)?.remove();
}

function htmlEtat(info) {
  return `<span class="objectif-etat etat-${info.etat}">${ICONES[info.etat]}${info.detail ? ` ${echapperHtml(info.detail)}` : ``}</span>`;
}

function htmlPastille() {
  const ok = objectifsCourants.filter((objectif) => objectif.etat?.etat === `assure`).length;
  return `🏆 <b>${ok ? `${ok}/` : ``}${objectifsCourants.length}</b>`;
}

export function afficherObjectifsCombat(objectifs, { replierApres = 9000 } = {}) {
  retirerObjectifsCombat();
  if (!objectifs.length) {
    return;
  }
  objectifsCourants = objectifs.map((objectif) => ({
    ...objectif,
    etat: {
      etat: `en_cours`,
      detail:
        objectif.suivi?.type === `compteur`
          ? `${objectif.suivi.base}/${objectif.suivi.seuil}`
          : undefined,
    },
  }));
  // Sur téléphone, la boîte ouverte cachait le défi et l'ordre de jeu : elle démarre repliée
  // (pastille qui pulse). Partout, un simple compteur cumulé ne mérite pas d'ouverture d'office.
  const mobile = window.matchMedia?.(`(max-width: 700px)`).matches ?? false;
  const ouvrir =
    !mobile && objectifsCourants.some((objectif) => objectif.suivi?.type !== `compteur`);
  const boite = document.createElement(`aside`);
  boite.id = `objectifs-combat`;
  boite.className = `objectifs-combat${ouvrir ? ` ouvert` : ` pulse`}`;
  boite.setAttribute(`aria-label`, `Objectifs de succès dans ce combat`);
  boite.innerHTML = `
    <button type="button" class="objectifs-pastille" aria-expanded="${ouvrir}" title="Objectifs de succès dans ce combat">${htmlPastille()}</button>
    <div class="objectifs-panneau">
      <div class="objectifs-tete">
        <span>🏆 Objectif${objectifs.length > 1 ? `s` : ``} dans ce combat</span>
        <button type="button" class="objectifs-fermer" aria-label="Replier">✕</button>
      </div>
      <ul>${objectifsCourants
        .map(
          (objectif, indice) => `<li data-objectif="${indice}">
          <span class="objectif-img">${objectif.img ? `<img src="${cheminAsset(objectif.img)}" alt="" onerror="this.remove()" />` : `🏆`}</span>
          <span class="objectif-texte">
            <span class="objectif-ligne1"><b>${echapperHtml(objectif.quete)}</b>${htmlEtat(objectif.etat)}</span>
            <span class="objectif-consigne">${echapperHtml(objectif.consigne)}</span>
            ${objectif.succes ? `<small>${echapperHtml(objectif.dofus ? `Succès « ${objectif.succes} » → ${objectif.dofus}` : `Succès « ${objectif.succes} »`)}</small>` : ``}
          </span>
        </li>`,
        )
        .join(``)}</ul>
    </div>`;
  document.body.appendChild(boite);
  const pastille = boite.querySelector(`.objectifs-pastille`);
  const basculer = (ouvert) => {
    clearTimeout(minuteur);
    boite.classList.toggle(`ouvert`, ouvert);
    pastille.setAttribute(`aria-expanded`, String(ouvert));
  };
  pastille.addEventListener(`click`, () => basculer(!boite.classList.contains(`ouvert`)));
  boite.querySelector(`.objectifs-fermer`).addEventListener(`click`, () => basculer(false));
  replier = () => boite.classList.contains(`ouvert`) && basculer(false);
  if (!ouvrir) {
    setTimeout(() => boite.classList.remove(`pulse`), 2000);
  } else if (replierApres) {
    minuteur = setTimeout(() => basculer(false), replierApres);
  }
}

/** Replie la boîte des objectifs si elle est ouverte (première action du joueur). */
export function replierObjectifsCombat() {
  replier?.();
}

/** Met à jour l'état des objectifs après un évènement du combat. */
export function majObjectifsCombat(suivi, combattants) {
  const boite = document.getElementById(`objectifs-combat`);
  if (!boite || !objectifsCourants.length) {
    return;
  }
  let change = false;
  objectifsCourants.forEach((objectif, indice) => {
    const etat = etatObjectif(objectif, suivi, combattants);
    if (etat.etat === objectif.etat?.etat && etat.detail === objectif.etat?.detail) {
      return;
    }
    const nouveau = etat.etat !== objectif.etat?.etat;
    objectif.etat = etat;
    change = true;
    const li = boite.querySelector(`[data-objectif="${indice}"]`);
    const ligne = li?.querySelector(`.objectif-ligne1`);
    if (ligne) {
      ligne.querySelector(`.objectif-etat`)?.remove();
      ligne.insertAdjacentHTML(`beforeend`, htmlEtat(etat));
      li.classList.toggle(`fait`, etat.etat === `assure`);
      li.classList.toggle(`rate`, etat.etat === `rate`);
      if (nouveau && etat.etat !== `en_cours`) {
        li.classList.add(`flash`);
        setTimeout(() => li.classList.remove(`flash`), 900);
      }
    }
  });
  if (change) {
    boite.querySelector(`.objectifs-pastille`).innerHTML = htmlPastille();
  }
}
