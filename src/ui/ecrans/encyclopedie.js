import { CLASSES, SORTS } from "../../data/index.js";
import { classesJouables } from "../../jeu/run.js";
import {
  ROLES_CLASSES,
  afficherEcran,
  barreRetour,
  echapperHtml,
  htmlElementsClasse,
  iconeSort,
  imgClasse,
  imgSymboleClasse,
  attrElementSort,
  infobulleSort,
  racine,
} from "../commun.js";
export function ecranEncyclopedie() {
  return new Promise((resolve) => {
    let t = classesJouables()[0];
    let n = (e) => {
      let t = CLASSES[e];
      let cid = e;
      let n = t.sorts
        .map((e) => {
          let t = SORTS[e];
          if (t) {
            return `<div class="ency-sort">
            <span class="ency-sort-icone"${attrElementSort(t, null, CLASSES[cid].elements)}><img src="${iconeSort(e)}" alt="" loading="lazy" onerror="this.remove()" /></span>
            <div class="ency-sort-detail">${infobulleSort(t, null)}</div>
          </div>`;
          }
          return ``;
        })
        .join(``);
      return `
        <div class="ency-fiche">
          <div class="ency-tete">
            <img class="ency-portrait" src="${imgClasse(e)}" alt="" onerror="this.remove()" />
            <div>
              <h2>${echapperHtml(t.nom)}</h2>
              <p class="ency-role">${echapperHtml(ROLES_CLASSES[e] ?? ``)}</p>
              <p class="ency-archetype">${htmlElementsClasse(e, {
                icone: true,
              })}</p>
              <p class="ency-bases muet">PV ${t.pvBase} · PA ${t.pa} · Initiative ${t.initiative}</p>
            </div>
          </div>
          <div class="ency-sorts">${n}</div>
        </div>`;
    };
    let r = () => {
      afficherEcran(`
        <h1>Encyclopédie des classes</h1>
        <p class="sous-titre">Les classes jouables et leurs sorts : les dégâts affichés sont les jets de base, avant caractéristiques.</p>
        <div class="ency-onglets">${classesJouables()
          .map(
            (e) => `
          <button class="ency-onglet${e === t ? ` actif` : ``}" data-classe="${e}" title="${echapperHtml(CLASSES[e].nom)}">
            <img src="${imgSymboleClasse(e)}" alt="" onerror="this.src='${imgClasse(e)}'" />
          </button>`,
          )
          .join(``)}</div>
        ${n(t)}
        ${barreRetour(`retour`)}
      `);
      racine.querySelectorAll(`.ency-onglet`).forEach((e) => {
        e.addEventListener(`click`, () => {
          t = e.dataset.classe;
          r();
        });
      });
      racine.querySelector(`#retour`)?.addEventListener(`click`, () => resolve());
    };
    r();
  });
}
