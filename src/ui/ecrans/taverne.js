import { CLASSES } from "../../data/index.js";
import { afficherEcran, echapperHtml, htmlCarteClasse, racine } from "../commun.js";
export function ecranTaverne(e, t, n, r = false, i = false) {
  return new Promise((resolve) => {
    let classeId = null;
    let s = e.length >= 4;
    let c = i && !s && e.length === 3;
    let l = () => {
      if (classeId) {
        let t = e.map((e) => htmlCarteClasse(e.classeId, false, `data-remplace`)).join(``);
        afficherEcran(`
          <h1>Recruter ${echapperHtml(CLASSES[classeId].nom)}</h1>
          <p class="sous-titre">L'équipe est pleine. Choisis le membre à remplacer.</p>
          <div class="choix-grille">${t}</div>
          <div class="boutons-ecran"><button id="tav-annuler" class="secondaire">Annuler</button></div>
        `);
        racine.querySelectorAll(`.classe-carte`).forEach((e) => {
          e.addEventListener(`click`, () =>
            resolve({
              type: `recrue`,
              classeId,
              remplace: e.dataset.remplace,
            }),
          );
        });
        document.getElementById(`tav-annuler`)?.addEventListener(`click`, () => {
          classeId = null;
          l();
        });
        return;
      }
      let i = t.length
        ? `<h3>Recruter (2 candidats)</h3>
           <div class="choix-grille">${t.map((e) => htmlCarteClasse(e, false, `data-recrue`)).join(``)}</div>`
        : `<p class="muet">Aucune classe à recruter (toutes déjà dans l'équipe).</p>`;
      let length = e.filter((e) => e.pvActuels <= 0).length;
      afficherEcran(`
        <h1>Taverne</h1>
        <p class="sous-titre">Soigne ton équipe, ou recrute un nouveau membre.</p>
        ${r && length > 0 ? `<p class="asc-avertissement">☠ ${length === 1 ? `Un héros tombé ne se relèvera pas` : `${length} héros tombés ne se relèveront pas`}. Il faut le${length > 1 ? `s` : ``} remplacer.</p>` : ``}
        ${c && t.length ? `<p class="asc-avertissement">⚠ Recruter maintenant complète l'équipe : les tavernes (et tout soin hors combat) disparaissent du reste de la run.</p>` : ``}
        <div class="boutons-ecran">
          <button id="tav-soin" class="primaire">Soigner (+${Math.round(n * 100)} % PV)</button>
        </div>
        ${i}
      `);
      document.getElementById(`tav-soin`)?.addEventListener(`click`, () =>
        resolve({
          type: `soin`,
        }),
      );
      racine.querySelectorAll(`.classe-carte`).forEach((e) => {
        e.addEventListener(`click`, () => {
          let recrue = e.dataset.recrue;
          if (s) {
            classeId = recrue;
            l();
          } else {
            resolve({
              type: `recrue`,
              classeId: recrue,
            });
          }
        });
      });
    };
    l();
  });
}
