import { CLASSES } from "../../data/index.js";
import { nomTouche, rangOrdre, sauverParametres } from "../../sauvegarde/parametres.js";
import { classesJouables } from "../../jeu/run.js";
import { exporterSauvegarde, importerSauvegarde } from "../../sauvegarde/export.js";
import { telechargerTexte } from "../../sauvegarde/telechargement.js";
import {
  afficherEcran,
  barreRetour,
  echapperHtml,
  htmlElementsClasse,
  imgSymboleClasse,
  parametres,
  racine,
} from "../commun.js";
export function ecranParametres(e) {
  return new Promise((resolve) => {
    let n = false;
    // écouteur de la touche en cours de saisie (retiré si on quitte l'écran)
    let captureTouche = null;
    let r = false;
    let i = () => {
      afficherEcran(`
        <h1>Paramètres</h1>
        <div class="settings">
          <div class="setting-ligne">
            <span class="setting-lbl">Touche « Terminer le tour »</span>
            <button id="set-touche" class="secondaire">${n ? `Appuie sur une touche…` : `<kbd>${echapperHtml(nomTouche(parametres.toucheFinTour))}</kbd>`}</button>
          </div>
          <div class="setting-ligne">
            <span class="setting-lbl">Passer le tour automatiquement<br><small class="muet">quand aucune action n'est possible</small></span>
            <button id="set-auto" class="secondaire ${parametres.autoFinTour ? `on` : ``}">${parametres.autoFinTour ? `Activé` : `Désactivé`}</button>
          </div>
          <div class="setting-ligne">
            <span class="setting-lbl">Tours des monstres rapides<br><small class="muet">les ennemis jouent sans temps mort</small></span>
            <button id="set-rapide" class="secondaire ${parametres.combatRapide ? `on` : ``}">${parametres.combatRapide ? `Activé` : `Désactivé`}</button>
          </div>
          <div class="setting-ligne">
            <span class="setting-lbl">Sauvegarde<br><small class="muet">Dofus, succès, réglages et run en cours, pour changer de PC</small></span>
            <span class="setting-actions">
              <button id="set-export" class="secondaire">Exporter</button>
              <button id="set-import" class="secondaire">Importer…</button>
              <button id="set-texte" class="secondaire" title="Copier ou coller la sauvegarde sous forme de texte">Texte…</button>
              <input id="set-import-file" type="file" accept=".json,application/json" style="display:none" />
            </span>
          </div>
          <p id="set-import-msg" class="muet settings-sous" style="display:none"></p>
          <div id="set-texte-zone" class="sauvegarde-texte" style="display:none">
            <p class="muet">Copie ce texte et garde-le (notes, mail…) ; pour récupérer ta partie, colle-le ici puis « Importer le texte ».</p>
            <textarea id="set-texte-champ" rows="6" spellcheck="false" aria-label="Sauvegarde en texte"></textarea>
            <span class="setting-actions">
              <button id="set-texte-copier" class="secondaire">Copier</button>
              <button id="set-texte-importer" class="secondaire">Importer le texte</button>
            </span>
          </div>
          ${
            e
              ? (() => {
                  let t = e.nb();
                  let n =
                    t > 0
                      ? `Efface définitivement les ${t} Dofus collectés. Succès, réglages et run en cours sont conservés.`
                      : `Aucun Dofus collecté pour l'instant.`;
                  return `<div class="setting-ligne ${t > 0 ? `setting-danger` : ``}">
            <span class="setting-lbl">Réinitialiser les Dofus<br><small class="muet">${n}</small></span>
            <button id="set-reset-dofus" class="secondaire ${r ? `danger-arme` : ``}" ${t > 0 ? `` : `disabled`}>${r ? `Confirmer l'effacement` : `Réinitialiser`}</button>
          </div>`;
                })()
              : ``
          }
        </div>
        <h2 class="settings-titre">Préréglages des héros</h2>
        <p class="muet settings-sous">Position et ordre de jeu par défaut, appliqués au début de chaque run. Glisse-dépose les cartes pour changer l'ordre ; pendant une run, la vue Formation le règle sans toucher à cette préférence.</p>
        <div class="presets">
          ${[...classesJouables()]
            .sort((e, t) => rangOrdre(parametres.ordre, e) - rangOrdre(parametres.ordre, t))
            .map((e, t) => {
              let n = parametres.formation[e] === `arriere` ? `arriere` : `avant`;
              return `<div class="preset-carte" draggable="true" data-classe-ordre="${e}">
              <span class="ordre-rang">${t + 1}</span>
              <img class="preset-sym" src="${imgSymboleClasse(e)}" alt="" onerror="this.remove()" />
              <span class="preset-nom">${echapperHtml(CLASSES[e].nom)}</span>
              ${htmlElementsClasse(e)}
              <span class="preset-pos">
                <button class="form-el-btn ${n === `avant` ? `sel` : ``}" draggable="false" data-classe="${e}" data-rangee="avant" title="Ligne avant (les héros s'y empilent)">Avant</button>
                <button class="form-el-btn ${n === `arriere` ? `sel` : ``}" draggable="false" data-classe="${e}" data-rangee="arriere" title="Ligne arrière (les héros s'y empilent)">Arrière</button>
              </span>
            </div>`;
            })
            .join(``)}
        </div>
        ${barreRetour(`set-retour`)}
      `);
      racine.querySelectorAll(`.preset-pos [data-rangee]`).forEach((e) => {
        e.addEventListener(`click`, () => {
          parametres.formation[e.dataset.classe] = e.dataset.rangee;
          sauverParametres(parametres);
          i();
        });
      });
      let a = (e, classeOrdre) => {
        if (e === classeOrdre) {
          return;
        }
        let n = [...classesJouables()].sort(
          (e, t) => rangOrdre(parametres.ordre, e) - rangOrdre(parametres.ordre, t),
        );
        let r = n.indexOf(e);
        let a = n.indexOf(classeOrdre);
        if (!(r < 0 || a < 0)) {
          n.splice(a, 0, n.splice(r, 1)[0]);
          n.forEach((e, t) => {
            parametres.ordre[e] = t + 1;
          });
          Object.keys(parametres.ordre)
            .filter((e) => !n.includes(e))
            .sort((e, t) => rangOrdre(parametres.ordre, e) - rangOrdre(parametres.ordre, t))
            .forEach((e, t) => {
              parametres.ordre[e] = n.length + t + 1;
            });
          sauverParametres(parametres);
          i();
        }
      };
      racine.querySelectorAll(`[data-classe-ordre]`).forEach((e) => {
        let classeOrdre = e.dataset.classeOrdre;
        e.addEventListener(`dragstart`, (n) => {
          n.dataTransfer.setData(`text/plain`, classeOrdre);
          e.classList.add(`drag-src`);
        });
        e.addEventListener(`dragend`, () => e.classList.remove(`drag-src`));
        e.addEventListener(`dragover`, (t) => {
          t.preventDefault();
          e.classList.add(`drop-cible`);
        });
        e.addEventListener(`dragleave`, () => e.classList.remove(`drop-cible`));
        e.addEventListener(`drop`, (n) => {
          n.preventDefault();
          e.classList.remove(`drop-cible`);
          a(n.dataTransfer.getData(`text/plain`), classeOrdre);
        });
      });
      document.getElementById(`set-touche`)?.addEventListener(`click`, () => {
        n = true;
        i();
        let e = (t) => {
          // touches réservées : Échap annule, les chiffres choisissent les sorts
          if ([`Shift`, `Control`, `Alt`, `Meta`, `Tab`].includes(t.key) || t.repeat) {
            return;
          }
          t.preventDefault();
          t.stopPropagation();
          document.removeEventListener(`keydown`, e, true);
          captureTouche = null;
          if (t.key !== `Escape` && !/^(?:Digit|Numpad)[1-9]$/.test(t.code)) {
            parametres.toucheFinTour = t.key;
            sauverParametres(parametres);
          }
          n = false;
          i();
        };
        captureTouche = e;
        document.addEventListener(`keydown`, e, true);
      });
      document.getElementById(`set-rapide`)?.addEventListener(`click`, () => {
        parametres.combatRapide = !parametres.combatRapide;
        sauverParametres(parametres);
        i();
      });
      document.getElementById(`set-auto`)?.addEventListener(`click`, () => {
        parametres.autoFinTour = !parametres.autoFinTour;
        sauverParametres(parametres);
        i();
      });
      let message = (texte) => {
        let m = document.getElementById(`set-import-msg`);
        if (m) {
          m.textContent = texte;
          m.style.display = ``;
        }
      };
      let zoneTexte = () => {
        let z = document.getElementById(`set-texte-zone`);
        let champ = document.getElementById(`set-texte-champ`);
        if (z && champ) {
          z.style.display = ``;
          champ.value = exporterSauvegarde();
          champ.focus();
          champ.select();
        }
      };
      document.getElementById(`set-export`)?.addEventListener(`click`, async () => {
        let nom = `roguefus-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
        let r = await telechargerTexte(nom, exporterSauvegarde());
        if (r === `saved`) {
          message(`✓ Sauvegarde exportée (${nom}).`);
        } else if (r === `declined`) {
          message(`Export annulé.`);
        } else {
          message(
            `Le téléchargement n'est pas possible ici : copie plutôt la sauvegarde en texte ci-dessous.`,
          );
          zoneTexte();
        }
      });
      document.getElementById(`set-texte`)?.addEventListener(`click`, zoneTexte);
      document.getElementById(`set-texte-copier`)?.addEventListener(`click`, async () => {
        let champ = document.getElementById(`set-texte-champ`);
        try {
          await navigator.clipboard.writeText(champ.value);
          message(`✓ Sauvegarde copiée dans le presse-papiers.`);
        } catch {
          champ.select();
          message(`Sélectionne le texte et copie-le (appui long ou Ctrl+C).`);
        }
      });
      document.getElementById(`set-texte-importer`)?.addEventListener(`click`, () => {
        let champ = document.getElementById(`set-texte-champ`);
        if (importerSauvegarde(champ.value)) {
          message(`✓ Sauvegarde importée, rechargement…`);
          setTimeout(() => location.reload(), 600);
        } else {
          message(`✗ Ce texte n'est pas une sauvegarde Roguefus Lite.`);
        }
      });
      let o = document.getElementById(`set-import-file`);
      document.getElementById(`set-import`)?.addEventListener(`click`, () => o?.click());
      o?.addEventListener(`change`, async () => {
        let e = o.files?.[0];
        if (!e) {
          return;
        }
        let t = document.getElementById(`set-import-msg`);
        if (importerSauvegarde(await e.text())) {
          if (t) {
            t.textContent = `✓ Sauvegarde importée, rechargement…`;
            t.style.display = ``;
          }
          setTimeout(() => location.reload(), 600);
        } else if (t) {
          t.textContent = `✗ Fichier invalide : ce n'est pas une sauvegarde Roguefus Lite.`;
          t.style.display = ``;
        }
      });
      document.getElementById(`set-reset-dofus`)?.addEventListener(`click`, () => {
        if (!r) {
          r = true;
          i();
          return;
        }
        e.onReset();
        r = false;
        i();
      });
      document.getElementById(`set-retour`)?.addEventListener(`click`, () => {
        if (captureTouche) {
          document.removeEventListener(`keydown`, captureTouche, true);
          captureTouche = null;
        }
        resolve();
      });
    };
    i();
  });
}
