import { CLASSES, EQUIPEMENTS } from "../../data/index.js";
import { sauverParametres } from "../../sauvegarde/parametres.js";
import {
  afficherEcran,
  barreRetour,
  echapperHtml,
  imgSymboleClasse,
  parametres,
  pastillesElementsPerso,
  racine,
} from "../commun.js";
export function ecranFormation(persos) {
  return new Promise((resolve) => {
    let celluleChoisie = -1;
    let jetonChoisi = -1;
    // vrai dès qu'un déplacement a eu lieu : sinon, rien à sauver en quittant
    let modifie = false;
    let persoEn = (position) => persos.find((perso) => perso.position === position);
    // On fusionne : les préréglages des classes absentes de l'équipe sont conservés.
    let sauverFormation = () => {
      parametres.formation = {
        ...parametres.formation,
        ...Object.fromEntries(
          persos.map((perso) => [perso.classeId, perso.position < 4 ? `avant` : `arriere`]),
        ),
      };
      sauverParametres(parametres);
    };
    let htmlCase = (position) => {
      let perso = persoEn(position);
      let classeSel = celluleChoisie === position ? `sel` : ``;
      let contenu = perso
        ? `<img src="${imgSymboleClasse(perso.classeId)}" alt="" onerror="this.remove()" /><span>${echapperHtml(CLASSES[perso.classeId].nom)}</span>${pastillesElementsPerso(perso)}`
        : `<span class="form-vide">+</span>`;
      return `<button class="form-cell ${perso ? `` : `vide`} ${classeSel}" data-cell="${position}" aria-pressed="${celluleChoisie === position}"${perso ? ` draggable="true"` : ` aria-label="Case libre"`}>${contenu}</button>`;
    };
    let htmlCases = (positions) => positions.map(htmlCase).join(``);
    let reculeInterdit = (perso, position) =>
      !!perso &&
      position >= 4 &&
      Object.values(perso.equipement).some((objet) => objet && EQUIPEMENTS[objet.id]?.ligneAvant);
    let echanger = (positionA, positionB) => {
      if (positionA === positionB) {
        return;
      }
      let persoA = persoEn(positionA);
      let persoB = persoEn(positionB);
      if (reculeInterdit(persoA, positionB) || reculeInterdit(persoB, positionA)) {
        let message = document.getElementById(`form-msg`);
        if (message) {
          message.textContent = `⛔ La Cape Edepee exige la ligne avant : dépose-la avant de reculer.`;
          message.style.display = ``;
        }
        return;
      }
      if (persoA) {
        persoA.position = positionB;
      }
      if (persoB) {
        persoB.position = positionA;
      }
      celluleChoisie = -1;
      modifie = true;
      sauverFormation();
      afficher();
    };
    let deplacerJeton = (depart, arrivee) => {
      if (
        depart === arrivee ||
        depart < 0 ||
        arrivee < 0 ||
        depart >= persos.length ||
        arrivee >= persos.length
      ) {
        return;
      }
      let [perso] = persos.splice(depart, 1);
      persos.splice(arrivee, 0, perso);
      jetonChoisi = -1;
      modifie = true;
      sauverFormation();
      afficher();
    };
    let afficher = () => {
      afficherEcran(`
        <h1>Formation</h1>
        <p class="sous-titre">Touche deux cases pour les échanger (ou glisse-dépose). <b>Ligne avant</b> : encaisse les sorts de ligne ennemis. <b>Ligne arrière</b> : protégée.</p>
        <p id="form-msg" class="muet settings-sous" style="display:none"></p>
        <div class="formation-grille">
          <div class="form-rangee"><span class="form-ligne-lbl">Ligne avant</span><div class="form-cells">${htmlCases(
            [0, 1, 2, 3],
          )}</div></div>
          <div class="form-rangee arriere"><span class="form-ligne-lbl">Ligne arrière</span><div class="form-cells">${htmlCases(
            [4, 5, 6, 7],
          )}</div></div>
        </div>
        <h2 class="settings-titre">Ordre de jeu</h2>
        <p class="muet settings-sous">Glisse-dépose, ou touche deux jetons (le premier prend la place du second), pour choisir qui joue en premier. Le camp qui ouvre le combat reste décidé par la moyenne d'initiative des deux équipes : ton ordre ne la change pas.</p>
        <div class="ordre-bande">
          ${persos
            .map(
              (perso, rang) => `
            <button class="ordre-jeton ${jetonChoisi === rang ? `sel` : ``}" data-ordre="${rang}" aria-pressed="${jetonChoisi === rang}" draggable="true" title="${echapperHtml(CLASSES[perso.classeId].nom)}, position ${rang + 1}">
              <span class="ordre-rang">${rang + 1}</span>
              <img src="${imgSymboleClasse(perso.classeId)}" alt="" onerror="this.remove()" />
              <span class="ordre-nom">${echapperHtml(CLASSES[perso.classeId].nom)}</span>
            </button>`,
            )
            .join(``)}
        </div>
        ${barreRetour(`form-retour`, `Retour au plateau`)}
      `);
      racine.querySelectorAll(`.form-cell`).forEach((cellule) => {
        let position = Number(cellule.dataset.cell);
        cellule.addEventListener(`click`, () => {
          celluleChoisie < 0
            ? persoEn(position) && ((celluleChoisie = position), afficher())
            : celluleChoisie === position
              ? ((celluleChoisie = -1), afficher())
              : echanger(celluleChoisie, position);
        });
        cellule.addEventListener(`dragstart`, (evenement) => {
          if (!persoEn(position)) {
            evenement.preventDefault();
            return;
          }
          evenement.dataTransfer.setData(`text/plain`, `cell:${position}`);
          evenement.dataTransfer.setData(`roguefus/cell`, String(position));
          evenement.dataTransfer.effectAllowed = `move`;
          cellule.classList.add(`drag-src`);
        });
        cellule.addEventListener(`dragend`, () => cellule.classList.remove(`drag-src`));
        cellule.addEventListener(`dragover`, (evenement) => {
          if (evenement.dataTransfer?.types.includes(`roguefus/cell`)) {
            evenement.preventDefault();
            cellule.classList.add(`drop-cible`);
          }
        });
        cellule.addEventListener(`dragleave`, () => cellule.classList.remove(`drop-cible`));
        cellule.addEventListener(`drop`, (evenement) => {
          evenement.preventDefault();
          cellule.classList.remove(`drop-cible`);
          let donnees = evenement.dataTransfer.getData(`text/plain`);
          if (!donnees.startsWith(`cell:`)) {
            return;
          }
          let depart = Number(donnees.slice(5));
          if (!Number.isNaN(depart)) {
            echanger(depart, position);
          }
        });
      });
      racine.querySelectorAll(`.ordre-jeton`).forEach((jeton) => {
        let rang = Number(jeton.dataset.ordre);
        jeton.addEventListener(`click`, () => {
          if (jetonChoisi < 0) {
            jetonChoisi = rang;
            afficher();
          } else if (jetonChoisi === rang) {
            jetonChoisi = -1;
            afficher();
          } else {
            deplacerJeton(jetonChoisi, rang);
          }
        });
        jeton.addEventListener(`dragstart`, (evenement) => {
          evenement.dataTransfer.setData(`text/plain`, `ordre:${rang}`);
          evenement.dataTransfer.setData(`roguefus/ordre`, String(rang));
          evenement.dataTransfer.effectAllowed = `move`;
          jeton.classList.add(`drag-src`);
        });
        jeton.addEventListener(`dragend`, () => jeton.classList.remove(`drag-src`));
        jeton.addEventListener(`dragover`, (evenement) => {
          if (evenement.dataTransfer?.types.includes(`roguefus/ordre`)) {
            evenement.preventDefault();
            jeton.classList.add(`drop-cible`);
          }
        });
        jeton.addEventListener(`dragleave`, () => jeton.classList.remove(`drop-cible`));
        jeton.addEventListener(`drop`, (evenement) => {
          evenement.preventDefault();
          jeton.classList.remove(`drop-cible`);
          let donnees = evenement.dataTransfer.getData(`text/plain`);
          if (!donnees.startsWith(`ordre:`)) {
            return;
          }
          let depart = Number(donnees.slice(6));
          if (!Number.isNaN(depart)) {
            deplacerJeton(depart, rang);
          }
        });
      });
      document.getElementById(`form-retour`)?.addEventListener(`click`, () => {
        if (modifie) {
          sauverFormation();
        }
        resolve();
      });
    };
    afficher();
  });
}
