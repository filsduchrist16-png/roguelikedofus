import { CLASSES } from "../../data/index.js";
import { nomTouche, rangOrdre, sauverParametres } from "../../sauvegarde/parametres.js";
import { classesJouables } from "../../jeu/run.js";
import {
  exporterSauvegarde,
  importerSauvegarde,
  infoSecours,
  lireSauvegarde,
  restaurerSecours,
  resumePartieLocale,
  resumeSauvegarde,
  sauvegardeDeSecours,
  texteResume,
} from "../../sauvegarde/export.js";
import {
  changerSyncAuto,
  envoyerNuage,
  infoNuage,
  nuageDisponible,
  nuagePlusRecent,
  raisonEchecNuage,
  recupererNuage,
  syncAuto,
} from "../../sauvegarde/nuage.js";
import {
  compteConfigure,
  compteConnecte,
  creerCompte,
  seConnecter,
  seDeconnecter,
} from "../../sauvegarde/compte.js";

export const dateLisible = (iso) => {
  try {
    return new Date(iso).toLocaleString(`fr-FR`, { dateStyle: `short`, timeStyle: `short` });
  } catch {
    return iso;
  }
};
import { telechargerTexte } from "../../sauvegarde/telechargement.js";
import {
  afficherEcran,
  barreRetour,
  demanderConfirmation,
  echapperHtml,
  htmlElementsClasse,
  imgSymboleClasse,
  parametres,
  racine,
} from "../commun.js";
// Résumé de la copie de secours (les valeurs y sont gardées telles que stockées, en texte).
function resumeSecours(secours) {
  const donnees = {};
  for (const [k, v] of Object.entries(secours.donnees ?? {})) {
    try {
      donnees[k] = JSON.parse(v);
    } catch {}
  }
  return resumeSauvegarde({ date: secours.date, donnees });
}
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
          ${(() => {
            const secours = infoSecours();
            return secours
              ? `<div class="setting-ligne">
            <span class="setting-lbl">Partie d'avant le dernier import<br><small class="muet">copie gardée le ${echapperHtml(dateLisible(secours.date))} : ${echapperHtml(texteResume(resumeSecours(secours)))}</small></span>
            <span class="setting-actions"><button id="set-annuler-import" class="secondaire">Annuler le dernier import</button></span>
          </div>`
              : ``;
          })()}
          ${(() => {
            // compte pour la sauvegarde en ligne, seulement hors de claude.ai
            if (typeof globalThis.claude?.use === `function` || !compteConfigure()) {
              return ``;
            }
            const compte = compteConnecte();
            return compte
              ? `<div class="setting-ligne compte-ligne">
            <span class="setting-lbl">👤 Compte<br><small class="muet">connecté : ${echapperHtml(compte.email)}</small></span>
            <span class="setting-actions"><button id="set-compte-sortir" class="secondaire">Se déconnecter</button></span>
          </div>`
              : `<form id="set-compte-form" class="setting-ligne compte-ligne" autocomplete="on">
            <span class="setting-lbl">👤 Compte pour la sauvegarde en ligne<br><small class="muet">crée un compte (email + mot de passe) pour retrouver ta partie sur tous tes appareils</small>
              <input id="set-compte-email" type="email" autocomplete="username" inputmode="email" placeholder="Email" aria-label="Email" required />
              <input id="set-compte-mdp" type="password" autocomplete="current-password" placeholder="Mot de passe (6 caractères min.)" aria-label="Mot de passe" minlength="6" required />
              <small id="set-compte-msg" class="muet" role="status"></small>
            </span>
            <span class="setting-actions">
              <button id="set-compte-entrer" type="submit" class="primaire">Se connecter</button>
              <button id="set-compte-creer" type="button" class="secondaire">Créer un compte</button>
            </span>
          </form>`;
          })()}
          <div id="set-nuage-pause" class="setting-ligne nuage-pause-ligne" style="display:none">
            <span class="setting-lbl">⚠ Synchro auto en pause : une partie plus récente attend ton choix<br><small id="set-nuage-pause-detail" class="muet"></small></span>
            <span class="setting-actions">
              <button id="set-pause-recuperer" class="primaire">Récupérer</button>
              <button id="set-pause-garder" class="secondaire">Garder celle d'ici</button>
            </span>
          </div>
          <div id="set-nuage" class="setting-ligne nuage-ligne" style="display:none">
            <span class="setting-lbl">☁️ Sauvegarde en ligne<br><small class="muet">${typeof globalThis.claude?.use === `function` ? `liée à ton compte claude.ai : ouvre ce même artefact sur PC ou sur mobile pour reprendre ta partie, sans mot de passe` : `liée à ton compte : connecte-toi avec le même email sur tes autres appareils pour reprendre ta partie`}</small><br><small id="set-nuage-etat" class="muet"></small></span>
            <span class="setting-actions">
              <button id="set-nuage-envoyer" class="secondaire">Envoyer cette partie</button>
              <button id="set-nuage-recuperer" class="secondaire">Récupérer</button>
              <button id="set-nuage-auto" class="secondaire ${syncAuto() ? `on` : ``}" title="Envoie la partie quelques secondes après chaque sauvegarde">Auto : ${syncAuto() ? `activé` : `désactivé`}</button>
            </span>
          </div>
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
      // sauvegarde en ligne : visible seulement dans l'artefact claude.ai
      const etatNuage = async () => {
        const ligne = document.getElementById(`set-nuage`);
        if (!ligne || !(await nuageDisponible())) {
          return;
        }
        ligne.style.display = ``;
        const info = await infoNuage().catch(() => null);
        const el = document.getElementById(`set-nuage-etat`);
        if (el) {
          el.textContent = info
            ? `En ligne : partie envoyée depuis ${info.appareil} le ${dateLisible(info.date)}.`
            : `Aucune partie en ligne pour l'instant.`;
        }
      };
      // compte (hors claude.ai) : connexion, création, déconnexion ; on recharge pour tout rebrancher
      const msgCompte = (t) => {
        const el = document.getElementById(`set-compte-msg`);
        if (el) {
          el.textContent = t;
        }
      };
      const entrerCompte = async (creer) => {
        const email = document.getElementById(`set-compte-email`)?.value ?? ``;
        const mdp = document.getElementById(`set-compte-mdp`)?.value ?? ``;
        if (!email.includes(`@`) || mdp.length < 6) {
          msgCompte(`Entre un email valide et un mot de passe d'au moins 6 caractères.`);
          return;
        }
        document.querySelectorAll(`#set-compte-form button`).forEach((b) => (b.disabled = true));
        msgCompte(creer ? `Création du compte…` : `Connexion…`);
        try {
          if (creer) {
            const r = await creerCompte(email, mdp);
            if (!r.connecte) {
              msgCompte(
                `Compte créé. Ouvre le courriel de confirmation reçu, puis reviens ici et touche « Se connecter ».`,
              );
              document
                .querySelectorAll(`#set-compte-form button`)
                .forEach((b) => (b.disabled = false));
              return;
            }
          } else {
            await seConnecter(email, mdp);
          }
          msgCompte(`✓ Connecté, rechargement…`);
          setTimeout(() => location.reload(), 500);
        } catch (e) {
          msgCompte(`✗ ${e.message}`);
          document.querySelectorAll(`#set-compte-form button`).forEach((b) => (b.disabled = false));
        }
      };
      document.getElementById(`set-compte-form`)?.addEventListener(`submit`, (ev) => {
        ev.preventDefault();
        entrerCompte(false);
      });
      document
        .getElementById(`set-compte-creer`)
        ?.addEventListener(`click`, () => entrerCompte(true));
      document.getElementById(`set-compte-sortir`)?.addEventListener(`click`, () => {
        seDeconnecter();
        location.reload();
      });
      etatNuage();
      document.getElementById(`set-nuage-envoyer`)?.addEventListener(`click`, async (ev) => {
        const b = ev.currentTarget;
        if (b.dataset.confirme !== `1`) {
          b.dataset.confirme = `1`;
          b.textContent = `Confirmer (remplace celle en ligne)`;
          return;
        }
        b.disabled = true;
        try {
          await envoyerNuage();
          message(
            `✓ Partie envoyée en ligne : ouvre l'artefact sur ton autre appareil et touche « Récupérer ».`,
          );
        } catch {
          message(`✗ Envoi impossible pour l'instant, réessaie dans un moment.`);
        }
        b.disabled = false;
        b.dataset.confirme = ``;
        b.textContent = `Envoyer cette partie`;
        etatNuage();
      });
      document.getElementById(`set-nuage-recuperer`)?.addEventListener(`click`, async (ev) => {
        const b = ev.currentTarget;
        if (b.dataset.confirme !== `1`) {
          b.dataset.confirme = `1`;
          b.textContent = `Confirmer (remplace celle d'ici)`;
          return;
        }
        b.disabled = true;
        if (await recupererNuage().catch(() => false)) {
          message(`✓ Partie récupérée, rechargement…`);
          setTimeout(() => location.reload(), 600);
        } else {
          message(
            `✗ Récupération impossible : ${raisonEchecNuage() || `erreur inconnue`}. Réessaie dans un moment.`,
          );
          b.disabled = false;
          b.dataset.confirme = ``;
          b.textContent = `Récupérer`;
        }
      });
      document.getElementById(`set-nuage-auto`)?.addEventListener(`click`, () => {
        changerSyncAuto(!syncAuto());
        i();
      });
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
      // Import : résumé de ce qu'on importe et de ce qu'on remplace, puis copie de secours.
      const importer = async (texte, invalide) => {
        const objet = lireSauvegarde(texte);
        if (!objet) {
          message(invalide);
          return;
        }
        const nouvelle = resumeSauvegarde(objet);
        let ici = `—`;
        try {
          ici = texteResume(resumePartieLocale());
        } catch {}
        const date = nouvelle.date ? `Sauvegarde du ${dateLisible(nouvelle.date)}` : `Sauvegarde`;
        if (
          !(await demanderConfirmation(
            `${date} : ${texteResume(nouvelle)}. Elle remplacera ta partie actuelle (${ici}), qui restera récupérable avec « Annuler le dernier import ».`,
            `Importer`,
          ))
        ) {
          message(`Import annulé.`);
          return;
        }
        sauvegardeDeSecours();
        if (importerSauvegarde(texte)) {
          message(`✓ Sauvegarde importée, rechargement…`);
          setTimeout(() => location.reload(), 600);
        } else {
          message(invalide);
        }
      };
      document.getElementById(`set-texte-importer`)?.addEventListener(`click`, () => {
        let champ = document.getElementById(`set-texte-champ`);
        importer(champ.value, `✗ Ce texte n'est pas une sauvegarde Roguefus Lite.`);
      });
      let o = document.getElementById(`set-import-file`);
      document.getElementById(`set-import`)?.addEventListener(`click`, () => o?.click());
      o?.addEventListener(`change`, async () => {
        let e = o.files?.[0];
        if (!e) {
          return;
        }
        o.value = ``;
        importer(await e.text(), `✗ Fichier invalide : ce n'est pas une sauvegarde Roguefus Lite.`);
      });
      document.getElementById(`set-annuler-import`)?.addEventListener(`click`, async () => {
        const secours = infoSecours();
        if (
          !secours ||
          !(await demanderConfirmation(
            `Revenir à la partie d'avant le dernier import (${texteResume(resumeSecours(secours))}) ? La partie actuelle sera remplacée.`,
            `Revenir`,
          ))
        ) {
          return;
        }
        if (restaurerSecours()) {
          message(`✓ Partie d'avant l'import remise, rechargement…`);
          setTimeout(() => location.reload(), 600);
        } else {
          message(`✗ Impossible de remettre la partie d'avant.`);
        }
      });
      // synchro auto en pause : une partie plus récente venue de l'autre appareil attend un choix
      nuagePlusRecent()
        .then((info) => {
          const ligne = document.getElementById(`set-nuage-pause`);
          if (!info || !ligne) {
            return;
          }
          let ici = `—`;
          try {
            ici = texteResume(resumePartieLocale());
          } catch {}
          const enLigne = info.resume ? texteResume(info.resume) : `contenu inconnu (ancien envoi)`;
          ligne.style.display = ``;
          document.getElementById(`set-nuage-pause-detail`).textContent =
            `Ici : ${ici} · En ligne (${info.appareil ?? `autre appareil`}, ${dateLisible(info.date)}) : ${enLigne}`;
          document.getElementById(`set-pause-recuperer`)?.addEventListener(`click`, async (ev) => {
            const b = ev.currentTarget;
            if (
              !(await demanderConfirmation(
                `Récupérer la partie en ligne (${enLigne}) ? Elle remplacera celle d'ici (${ici}), qui reste récupérable avec « Annuler le dernier import ».`,
                `Récupérer`,
              ))
            ) {
              return;
            }
            b.disabled = true;
            if (await recupererNuage().catch(() => false)) {
              message(`✓ Partie récupérée, rechargement…`);
              setTimeout(() => location.reload(), 600);
            } else {
              b.disabled = false;
              message(
                `✗ Récupération impossible : ${raisonEchecNuage() || `erreur inconnue`}. Réessaie dans un moment.`,
              );
            }
          });
          document.getElementById(`set-pause-garder`)?.addEventListener(`click`, async () => {
            if (
              !(await demanderConfirmation(
                `Garder la partie d'ici (${ici}) ? Elle sera envoyée en ligne et remplacera celle de l'autre appareil (${enLigne}).`,
                `Garder celle d'ici`,
              ))
            ) {
              return;
            }
            ligne.style.display = `none`;
            try {
              await envoyerNuage();
              message(`✓ Partie d'ici envoyée en ligne : la synchro auto reprend.`);
            } catch {
              message(`✗ Envoi impossible pour l'instant, réessaie dans un moment.`);
            }
            etatNuage();
          });
        })
        .catch(() => {});
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
