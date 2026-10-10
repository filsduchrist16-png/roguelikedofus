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
export function ecranFormation(e) {
  return new Promise((resolve) => {
    let n = -1;
    let r = -1;
    // vrai dès qu'un déplacement a eu lieu : sinon, rien à sauver en quittant
    let modifie = false;
    let i = (t) => e.find((e) => e.position === t);
    // On fusionne : les préréglages des classes absentes de l'équipe sont conservés.
    let a = () => {
      parametres.formation = {
        ...parametres.formation,
        ...Object.fromEntries(e.map((p) => [p.classeId, p.position < 4 ? `avant` : `arriere`])),
      };
      sauverParametres(parametres);
    };
    let o = (e) => {
      let t = i(e);
      let r = n === e ? `sel` : ``;
      let a = t
        ? `<img src="${imgSymboleClasse(t.classeId)}" alt="" onerror="this.remove()" /><span>${echapperHtml(CLASSES[t.classeId].nom)}</span>${pastillesElementsPerso(t)}`
        : `<span class="form-vide">+</span>`;
      return `<button class="form-cell ${t ? `` : `vide`} ${r}" data-cell="${e}" ${t ? `draggable="true"` : ``}>${a}</button>`;
    };
    let s = (e) => e.map(o).join(``);
    let c = (e, t) =>
      !!e && t >= 4 && Object.values(e.equipement).some((e) => e && EQUIPEMENTS[e.id]?.ligneAvant);
    let l = (e, t) => {
      if (e === t) {
        return;
      }
      let r = i(e);
      let o = i(t);
      if (c(r, t) || c(o, e)) {
        let e = document.getElementById(`form-msg`);
        if (e) {
          e.textContent = `⛔ La Cape Edepee exige la ligne avant : dépose-la avant de reculer.`;
          e.style.display = ``;
        }
        return;
      }
      if (r) {
        r.position = t;
      }
      if (o) {
        o.position = e;
      }
      n = -1;
      modifie = true;
      a();
      f();
    };
    let d = (t, n) => {
      if (t === n || t < 0 || n < 0 || t >= e.length || n >= e.length) {
        return;
      }
      let [i] = e.splice(t, 1);
      e.splice(n, 0, i);
      r = -1;
      modifie = true;
      a();
      f();
    };
    let f = () => {
      afficherEcran(`
        <h1>Formation</h1>
        <p class="sous-titre">Touche deux cases pour les échanger (ou glisse-dépose). <b>Ligne avant</b> : encaisse les sorts de ligne ennemis. <b>Ligne arrière</b> : protégée.</p>
        <p id="form-msg" class="muet settings-sous" style="display:none"></p>
        <div class="formation-grille">
          <div class="form-rangee"><span class="form-ligne-lbl">Ligne avant</span><div class="form-cells">${s(
            [0, 1, 2, 3],
          )}</div></div>
          <div class="form-rangee arriere"><span class="form-ligne-lbl">Ligne arrière</span><div class="form-cells">${s(
            [4, 5, 6, 7],
          )}</div></div>
        </div>
        <h2 class="settings-titre">Ordre de jeu</h2>
        <p class="muet settings-sous">Glisse-dépose pour choisir qui joue en premier. Le camp qui ouvre le combat reste décidé par la moyenne d'initiative des deux équipes : ton ordre ne la change pas.</p>
        <div class="ordre-bande">
          ${e
            .map(
              (e, t) => `
            <button class="ordre-jeton ${r === t ? `sel` : ``}" data-ordre="${t}" draggable="true" title="${echapperHtml(CLASSES[e.classeId].nom)}, position ${t + 1}">
              <span class="ordre-rang">${t + 1}</span>
              <img src="${imgSymboleClasse(e.classeId)}" alt="" onerror="this.remove()" />
              <span class="ordre-nom">${echapperHtml(CLASSES[e.classeId].nom)}</span>
            </button>`,
            )
            .join(``)}
        </div>
        ${barreRetour(`form-retour`, `Retour au plateau`)}
      `);
      racine.querySelectorAll(`.form-cell`).forEach((e) => {
        let t = Number(e.dataset.cell);
        e.addEventListener(`click`, () => {
          n < 0 ? i(t) && ((n = t), f()) : n === t ? ((n = -1), f()) : l(n, t);
        });
        e.addEventListener(`dragstart`, (n) => {
          if (!i(t)) {
            n.preventDefault();
            return;
          }
          n.dataTransfer.setData(`text/plain`, `cell:${t}`);
          n.dataTransfer.setData(`roguefus/cell`, String(t));
          n.dataTransfer.effectAllowed = `move`;
          e.classList.add(`drag-src`);
        });
        e.addEventListener(`dragend`, () => e.classList.remove(`drag-src`));
        e.addEventListener(`dragover`, (t) => {
          if (t.dataTransfer?.types.includes(`roguefus/cell`)) {
            t.preventDefault();
            e.classList.add(`drop-cible`);
          }
        });
        e.addEventListener(`dragleave`, () => e.classList.remove(`drop-cible`));
        e.addEventListener(`drop`, (n) => {
          n.preventDefault();
          e.classList.remove(`drop-cible`);
          let r = n.dataTransfer.getData(`text/plain`);
          if (!r.startsWith(`cell:`)) {
            return;
          }
          let i = Number(r.slice(5));
          if (!Number.isNaN(i)) {
            l(i, t);
          }
        });
      });
      racine.querySelectorAll(`.ordre-jeton`).forEach((e) => {
        let t = Number(e.dataset.ordre);
        e.addEventListener(`click`, () => {
          if (r < 0) {
            r = t;
            f();
          } else if (r === t) {
            r = -1;
            f();
          } else {
            d(r, t);
          }
        });
        e.addEventListener(`dragstart`, (n) => {
          n.dataTransfer.setData(`text/plain`, `ordre:${t}`);
          n.dataTransfer.setData(`roguefus/ordre`, String(t));
          n.dataTransfer.effectAllowed = `move`;
          e.classList.add(`drag-src`);
        });
        e.addEventListener(`dragend`, () => e.classList.remove(`drag-src`));
        e.addEventListener(`dragover`, (t) => {
          if (t.dataTransfer?.types.includes(`roguefus/ordre`)) {
            t.preventDefault();
            e.classList.add(`drop-cible`);
          }
        });
        e.addEventListener(`dragleave`, () => e.classList.remove(`drop-cible`));
        e.addEventListener(`drop`, (n) => {
          n.preventDefault();
          e.classList.remove(`drop-cible`);
          let r = n.dataTransfer.getData(`text/plain`);
          if (!r.startsWith(`ordre:`)) {
            return;
          }
          let i = Number(r.slice(6));
          if (!Number.isNaN(i)) {
            d(i, t);
          }
        });
      });
      document.getElementById(`form-retour`)?.addEventListener(`click`, () => {
        if (modifie) {
          a();
        }
        resolve();
      });
    };
    f();
  });
}
