// Fenêtre « Objectifs de succès » en début de combat, façon suivi de succès de DOFUS :
// elle s'ouvre seule, se replie en un bouton 🏆 au bout de quelques secondes et se rouvre au toucher.
import { cheminAsset, echapperHtml } from "./commun.js";

let minuteur = null;

export function retirerObjectifsCombat() {
  clearTimeout(minuteur);
  document.getElementById(`objectifs-combat`)?.remove();
}

export function afficherObjectifsCombat(objectifs, { replierApres = 9000 } = {}) {
  retirerObjectifsCombat();
  if (!objectifs.length) {
    return;
  }
  const boite = document.createElement(`aside`);
  boite.id = `objectifs-combat`;
  boite.className = `objectifs-combat ouvert`;
  boite.setAttribute(`aria-label`, `Objectifs de succès dans ce combat`);
  boite.innerHTML = `
    <button type="button" class="objectifs-pastille" aria-expanded="true" title="Objectifs de succès dans ce combat">
      🏆 <b>${objectifs.length}</b>
    </button>
    <div class="objectifs-panneau">
      <div class="objectifs-tete">
        <span>🏆 Objectif${objectifs.length > 1 ? `s` : ``} dans ce combat</span>
        <button type="button" class="objectifs-fermer" aria-label="Replier">✕</button>
      </div>
      <ul>${objectifs
        .map(
          (o) => `<li>
          <span class="objectif-img">${o.img ? `<img src="${cheminAsset(o.img)}" alt="" onerror="this.remove()" />` : `🏆`}</span>
          <span class="objectif-texte">
            <b>${echapperHtml(o.quete)}</b>
            <span class="objectif-consigne">${echapperHtml(o.consigne)}</span>
            ${o.succes ? `<small>${echapperHtml(o.dofus ? `Succès « ${o.succes} » → ${o.dofus}` : `Succès « ${o.succes} »`)}</small>` : ``}
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
  if (replierApres) {
    minuteur = setTimeout(() => basculer(false), replierApres);
  }
}
