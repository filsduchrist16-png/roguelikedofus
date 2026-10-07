import { classesJouables } from "../../jeu/run.js";
import { IMG_JOUER, IMG_MENU, afficherEcran, htmlCarteClasse, racine } from "../commun.js";
export function ecranChoixEquipe() {
  return new Promise((resolve) => {
    let t = [];
    let n = () => {
      afficherEcran(`
        <h1>Compose ton équipe de départ</h1>
        <p class="sous-titre">Choisis <b>2 classes</b> pour commencer. Tu pourras en recruter d'autres dans les tavernes (équipe de 4 max).</p>
        <div class="choix-grille">${classesJouables()
          .map((e) => htmlCarteClasse(e, t.includes(e), `data-classe`))
          .join(``)}</div>
        <div class="boutons-ecran">
          <button id="choix-retour" class="aside-icone" title="Retour à l'accueil"><img src="${IMG_MENU}" alt="Accueil" onerror="this.remove()" /></button>
          <button id="choix-go" class="btn-jouer" title="Jouer" ${t.length === 2 ? `` : `disabled`}><img src="${IMG_JOUER}" alt="Jouer" onerror="this.remove()" /></button>
          <span class="choix-compte">${t.length}/2</span>
        </div>
      `);
      racine.querySelectorAll(`.classe-carte`).forEach((e) => {
        e.addEventListener(`click`, () => {
          let classe = e.dataset.classe;
          let i = t.indexOf(classe);
          if (i >= 0) {
            t.splice(i, 1);
          } else if (t.length < 2) {
            t.push(classe);
          }
          n();
        });
      });
      document.getElementById(`choix-go`)?.addEventListener(`click`, () => {
        if (t.length === 2) {
          resolve([...t]);
        }
      });
      document.getElementById(`choix-retour`)?.addEventListener(`click`, () => resolve(null));
    };
    n();
  });
}
