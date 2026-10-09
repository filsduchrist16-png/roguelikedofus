import { classesJouables } from "../../jeu/run.js";
import {
  IMG_JOUER,
  IMG_MENU,
  afficherEcran,
  htmlCarteClasse,
  imgSymboleClasse,
  parametres,
  racine,
} from "../commun.js";
// Sélection de 2 classes : un appui sur une 3e remplace la plus ancienne.
export function basculerClasse(choisies, classe, max = 2) {
  const t = [...choisies];
  const i = t.indexOf(classe);
  if (i >= 0) {
    t.splice(i, 1);
  } else {
    if (t.length >= max) {
      t.shift();
    }
    t.push(classe);
  }
  return t;
}
export function ecranChoixEquipe() {
  return new Promise((resolve) => {
    // le dernier départ est présélectionné
    const jouables = classesJouables();
    let t = (parametres.dernierDepart?.classes ?? [])
      .filter((c) => jouables.includes(c))
      .slice(0, 2);
    let n = (focus) => {
      afficherEcran(`
        <h1>Compose ton équipe de départ</h1>
        <p class="sous-titre">Choisis <b>2 classes</b> pour commencer. Tu pourras en recruter d'autres dans les tavernes (équipe de 4 max).</p>
        <div class="choix-grille">${jouables
          .map((e) => htmlCarteClasse(e, t.includes(e), `data-classe`))
          .join(``)}</div>
        <div class="boutons-ecran">
          <button id="choix-retour" class="aside-icone btn-retour" title="Retour à l'accueil"><img src="${IMG_MENU}" alt="Accueil" onerror="this.remove()" /></button>
          <button id="choix-go" class="btn-jouer" title="Jouer" ${t.length === 2 ? `` : `disabled`}><img src="${IMG_JOUER}" alt="Jouer" onerror="this.remove()" /></button>
          <span class="choix-compte">${t
            .map(
              (c) =>
                `<img class="choix-compte-sym" src="${imgSymboleClasse(c)}" alt="" onerror="this.remove()" />`,
            )
            .join(``)}<span>${t.length}/2</span></span>
        </div>
      `);
      racine.querySelectorAll(`.classe-carte`).forEach((e) => {
        e.addEventListener(`click`, () => {
          t = basculerClasse(t, e.dataset.classe);
          n(e.dataset.classe);
        });
      });
      document.getElementById(`choix-go`)?.addEventListener(`click`, () => {
        if (t.length === 2) {
          resolve([...t]);
        }
      });
      document.getElementById(`choix-retour`)?.addEventListener(`click`, () => resolve(null));
      if (focus) {
        racine.querySelector(`[data-classe="${focus}"]`)?.focus({ preventScroll: true });
      }
    };
    n();
  });
}
