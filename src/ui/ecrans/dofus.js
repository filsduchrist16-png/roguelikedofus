import { DOFUS } from "../../data/index.js";
import { mondeDuDofus, succesDuDofus, texteObtentionDofus } from "../../jeu/obtention.js";
import { progressionSucces } from "../../jeu/quetes.js";
import { afficherEcran, barreRetour, echapperHtml, htmlRackDofus } from "../commun.js";
import { ecranSucces } from "./succes.js";

// Détail d'un Dofus touché dans la collection : effet, où il s'obtient, avancement des quêtes.
function htmlDetailDofus(meta, id) {
  const d = DOFUS[id];
  const possede = meta.dofus.some((x) => x.id === id);
  const succes = succesDuDofus(id);
  const monde = mondeDuDofus(id);
  const p = succes ? progressionSucces(meta.quetes ?? { faites: [], compteurs: {} }, succes) : null;
  return `<h2>${echapperHtml(d.nom)}${possede ? ` <small class="dofus-possede">✓ obtenu</small>` : ``}</h2>
    <p class="dofus-detail-effet">${echapperHtml(d.desc)}</p>
    <p class="dofus-detail-niv muet">Niveau ${d.niveau}${monde ? ` · ${echapperHtml(monde.nom)}` : ``}${p && !possede ? ` · ${p.faites}/${p.total} quêtes faites` : ``}</p>
    ${possede ? `` : `<p class="dofus-detail-obt">${echapperHtml(texteObtentionDofus(id))}</p>`}
    ${succes ? `<button type="button" class="secondaire dofus-voir" data-dofus="${echapperHtml(id)}">🏆 Voir ${possede ? `le succès` : `les quêtes`}</button>` : ``}`;
}

export function ecranDofus(e) {
  return new Promise((resolve) => {
    let size = new Set(e.dofus.map((e) => e.id)).size;
    let choisi = null;
    const afficher = () => {
      afficherEcran(`
      <h1>Dofus</h1>
      <p class="sous-titre">${size} / ${Object.keys(DOFUS).length} Dofus collectés. Ils survivent à la mort ; seule la possession compte, pas le nombre d'exemplaires.</p>
      ${htmlRackDofus(e)}
      <section class="dofus-detail" aria-live="polite">${
        choisi
          ? htmlDetailDofus(e, choisi)
          : `<p class="muet">Touche un Dofus pour voir son effet et comment l'obtenir.</p>`
      }</section>
      ${barreRetour(`dofus-retour`)}
    `);
      document.querySelectorAll(`.dofus-slot`).forEach((slot) => {
        const id = Object.keys(DOFUS).find((k) => DOFUS[k].nom === slot.dataset.nom);
        slot.tabIndex = 0;
        slot.setAttribute(`role`, `button`);
        if (id === choisi) {
          slot.classList.add(`choisi`);
        }
        const ouvrir = () => {
          choisi = id;
          afficher();
          document
            .querySelector(`.dofus-detail`)
            ?.scrollIntoView({ block: `nearest`, behavior: `smooth` });
        };
        slot.addEventListener(`click`, ouvrir);
        slot.addEventListener(`keydown`, (ev) => {
          if (ev.key === `Enter` || ev.key === ` `) {
            ev.preventDefault();
            ouvrir();
          }
        });
      });
      document.querySelector(`.dofus-voir`)?.addEventListener(`click`, async (ev) => {
        await ecranSucces(e, `d:${ev.currentTarget.dataset.dofus}`);
        afficher();
      });
      document.getElementById(`dofus-retour`)?.addEventListener(`click`, () => resolve());
    };
    afficher();
  });
}
