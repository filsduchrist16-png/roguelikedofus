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
    let classeChoisie = classesJouables()[0];
    let htmlFiche = (classeId) => {
      let classe = CLASSES[classeId];
      let cid = classeId;
      let htmlSorts = classe.sorts
        .map((sortId) => {
          let sort = SORTS[sortId];
          if (sort) {
            return `<div class="ency-sort">
            <span class="ency-sort-icone"${attrElementSort(sort, null, CLASSES[cid].elements)}><img src="${iconeSort(sortId)}" alt="" loading="lazy" onerror="this.remove()" /></span>
            <div class="ency-sort-detail">${infobulleSort(sort, null)}</div>
          </div>`;
          }
          return ``;
        })
        .join(``);
      return `
        <div class="ency-fiche">
          <div class="ency-tete">
            <img class="ency-portrait" src="${imgClasse(classeId)}" alt="" onerror="this.remove()" />
            <div>
              <h2>${echapperHtml(classe.nom)}</h2>
              <p class="ency-role">${echapperHtml(ROLES_CLASSES[classeId] ?? ``)}</p>
              <p class="ency-archetype">${htmlElementsClasse(classeId, {
                icone: true,
              })}</p>
              <p class="ency-bases muet">PV ${classe.pvBase} · PA ${classe.pa} · Initiative ${classe.initiative}</p>
            </div>
          </div>
          <div class="ency-sorts">${htmlSorts}</div>
        </div>`;
    };
    let afficher = () => {
      afficherEcran(`
        <h1>Encyclopédie des classes</h1>
        <p class="sous-titre">Les classes jouables et leurs sorts : les dégâts affichés sont les jets de base, avant caractéristiques.</p>
        <div class="ency-onglets">${classesJouables()
          .map(
            (classeId) => `
          <button class="ency-onglet${classeId === classeChoisie ? ` actif` : ``}" data-classe="${classeId}" title="${echapperHtml(CLASSES[classeId].nom)}">
            <img src="${imgSymboleClasse(classeId)}" alt="" onerror="this.src='${imgClasse(classeId)}'" />
          </button>`,
          )
          .join(``)}</div>
        ${htmlFiche(classeChoisie)}
        ${barreRetour(`retour`)}
      `);
      racine.querySelectorAll(`.ency-onglet`).forEach((onglet) => {
        onglet.addEventListener(`click`, () => {
          classeChoisie = onglet.dataset.classe;
          afficher();
        });
      });
      racine.querySelector(`#retour`)?.addEventListener(`click`, () => resolve());
    };
    afficher();
  });
}
