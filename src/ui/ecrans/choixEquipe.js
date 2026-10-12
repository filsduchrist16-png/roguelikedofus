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
  const copie = [...choisies];
  const indice = copie.indexOf(classe);
  if (indice >= 0) {
    copie.splice(indice, 1);
  } else {
    if (copie.length >= max) {
      copie.shift();
    }
    copie.push(classe);
  }
  return copie;
}
export function ecranChoixEquipe() {
  return new Promise((resolve) => {
    // le dernier départ est présélectionné
    const jouables = classesJouables();
    let selection = (parametres.dernierDepart?.classes ?? [])
      .filter((classe) => jouables.includes(classe))
      .slice(0, 2);
    let afficher = (focus) => {
      afficherEcran(`
        <h1>Compose ton équipe de départ</h1>
        <p class="sous-titre">Choisis <b>2 classes</b> pour commencer. Tu pourras en recruter d'autres dans les tavernes (équipe de 4 max).</p>
        <div class="choix-grille">${jouables
          .map((classe) => htmlCarteClasse(classe, selection.includes(classe), `data-classe`))
          .join(``)}</div>
        <div class="boutons-ecran">
          <button id="choix-retour" class="aside-icone btn-retour" title="Retour à l'accueil"><img src="${IMG_MENU}" alt="Accueil" onerror="this.remove()" /></button>
          <button id="choix-go" class="btn-jouer" title="Jouer" ${selection.length === 2 ? `` : `disabled`}><img src="${IMG_JOUER}" alt="Jouer" onerror="this.remove()" /></button>
          <span class="choix-compte">${selection
            .map(
              (classe) =>
                `<img class="choix-compte-sym" src="${imgSymboleClasse(classe)}" alt="" onerror="this.remove()" />`,
            )
            .join(``)}<span>${selection.length}/2</span></span>
        </div>
      `);
      racine.querySelectorAll(`.classe-carte`).forEach((carte) => {
        carte.addEventListener(`click`, () => {
          selection = basculerClasse(selection, carte.dataset.classe);
          afficher(carte.dataset.classe);
        });
      });
      document.getElementById(`choix-go`)?.addEventListener(`click`, () => {
        if (selection.length === 2) {
          resolve([...selection]);
        }
      });
      document.getElementById(`choix-retour`)?.addEventListener(`click`, () => resolve(null));
      if (focus) {
        racine.querySelector(`[data-classe="${focus}"]`)?.focus({ preventScroll: true });
      }
    };
    afficher();
  });
}
