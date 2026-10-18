import { CLASSES } from "../../data/index.js";
import {
  CLES_TUTO,
  MODES_AUTO,
  TAILLES_POLICE,
  appliquerAccessibilite,
  nomTouche,
  rangOrdre,
  sauverParametres,
} from "../../sauvegarde/parametres.js";
import { reinitialiserAstuces } from "./succes.js";
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
  avertissementNuage,
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
import { definirSons } from "../../son.js";
import { telechargerTexte } from "../../sauvegarde/telechargement.js";
import {
  afficherEcran,
  barreRetour,
  brancherSectionsRepliables,
  demanderConfirmation,
  echapperHtml,
  ecranTactile,
  htmlElementsClasse,
  htmlSectionRepliable,
  imgSymboleClasse,
  parametres,
  racine,
} from "../commun.js";
// Résumé de la copie de secours (les valeurs y sont gardées telles que stockées, en texte).
function resumeSecours(secours) {
  const donnees = {};
  for (const [cle, valeur] of Object.entries(secours.donnees ?? {})) {
    try {
      donnees[cle] = JSON.parse(valeur);
    } catch {}
  }
  return resumeSauvegarde({ date: secours.date, donnees });
}
export function ecranParametres(meta) {
  return new Promise((resolve) => {
    let saisieEnCours = false;
    // écouteur de la touche en cours de saisie (retiré si on quitte l'écran)
    let captureTouche = null;
    // sauvegarde en ligne : le réseau n'est interrogé qu'une fois, à l'ouverture de l'écran ;
    // les redessins (interrupteurs, préréglages) relisent ce cache
    const nuage = { dispo: false, info: null, plusRecent: null };
    let messageNuage = ``;
    // redessine l'état en ligne dans l'écran courant (défini à chaque rendu)
    let rafraichirNuage = () => {};
    let nuageOccupe = false;
    let inutilise = false;
    let afficher = () => {
      afficherEcran(`
        <h1>Paramètres</h1>
        <div class="settings">
          ${
            ecranTactile()
              ? ``
              : `<div class="setting-ligne">
            <span class="setting-lbl">Touche « Terminer le tour »</span>
            <button id="set-touche" class="secondaire">${saisieEnCours ? `Appuie sur une touche…` : `<kbd>${echapperHtml(nomTouche(parametres.toucheFinTour))}</kbd>`}</button>
          </div>`
          }
          <div class="setting-ligne">
            <span class="setting-lbl">Passer le tour automatiquement<br><small class="muet">quand aucune action n'est possible</small></span>
            <button id="set-auto" class="secondaire ${parametres.autoFinTour ? `on` : ``}" aria-pressed="${!!parametres.autoFinTour}">${parametres.autoFinTour ? `Activé` : `Désactivé`}</button>
          </div>
          <div class="setting-ligne">
            <span class="setting-lbl">Tours des monstres rapides<br><small class="muet">les ennemis jouent sans temps mort</small></span>
            <button id="set-rapide" class="secondaire ${parametres.combatRapide ? `on` : ``}" aria-pressed="${!!parametres.combatRapide}">${parametres.combatRapide ? `Activé` : `Désactivé`}</button>
          </div>
          ${htmlSectionRepliable(
            `param-confort`,
            `<span class="setting-lbl">⚡ Confort de jeu<br><small class="muet">re-sélection du sort, cible unique, bouton 🤖, butin</small></span>`,
            `<div class="settings-groupe-corps">
          ${[
            [
              `reselectionSort`,
              `Re-sélectionner le dernier sort`,
              `après un lancer, le même sort reste choisi tant que le héros peut le relancer`,
            ],
            [
              `cibleUniqueDirecte`,
              `Lancer direct sur la seule cible`,
              `un appui sur un sort qui n'a qu'une cible possible le lance tout de suite`,
            ],
          ]
            .map(
              ([cle, libelle, aide]) => `<div class="setting-ligne">
            <span class="setting-lbl">${libelle}<br><small class="muet">${aide}</small></span>
            <button class="secondaire set-bascule ${parametres[cle] ? `on` : ``}" data-bascule="${cle}" aria-pressed="${!!parametres[cle]}">${parametres[cle] ? `Activé` : `Désactivé`}</button>
          </div>`,
            )
            .join(``)}
          <div class="setting-ligne">
            <span class="setting-lbl" id="set-auto-jeu-lbl">Bouton 🤖 de combat<br><small class="muet">joue avec une règle simple (attaque, ou soin si le héros en a un) ; ⏹ reprend la main</small></span>
            <span class="setting-actions" role="group" aria-labelledby="set-auto-jeu-lbl">
              ${MODES_AUTO.map((mode) => `<button class="secondaire set-mode-auto ${parametres.modeAuto === mode ? `on` : ``}" data-mode-auto="${mode}" aria-pressed="${parametres.modeAuto === mode}">${{ heros: `Tour du héros`, combat: `Tout le combat`, cache: `Masqué` }[mode]}</button>`).join(``)}
            </span>
          </div>
          <div class="setting-ligne">
            <span class="setting-lbl">Butin : équiper le meilleur d'office<br><small class="muet">à l'écran du butin, « ⚡ Équiper » est appliqué tout de suite (annulable)</small></span>
            <button class="secondaire set-bascule ${parametres.butinAutoEquiper ? `on` : ``}" data-bascule="butinAutoEquiper" aria-pressed="${!!parametres.butinAutoEquiper}">${parametres.butinAutoEquiper ? `Activé` : `Désactivé`}</button>
          </div>
          </div>`,
            false,
            `setting-groupe`,
          )}
          <div class="setting-ligne">
            <span class="setting-lbl" id="set-taille-lbl">Taille du texte<br><small class="muet">agrandit tous les textes du jeu</small></span>
            <span class="setting-actions" role="group" aria-labelledby="set-taille-lbl">
              ${TAILLES_POLICE.map((taille) => `<button class="secondaire set-taille ${parametres.taillePolice === taille ? `on` : ``}" data-taille="${taille}" aria-pressed="${parametres.taillePolice === taille}">${taille} %</button>`).join(``)}
            </span>
          </div>
          <div class="setting-ligne">
            <span class="setting-lbl">Couleurs adaptées<br><small class="muet">la rareté est écrite sur les emplacements, les barres de PV ennemies ont un motif</small></span>
            <button id="set-couleurs" class="secondaire ${parametres.couleursAdaptees ? `on` : ``}" aria-pressed="${!!parametres.couleursAdaptees}">${parametres.couleursAdaptees ? `Activé` : `Désactivé`}</button>
          </div>
          <div class="setting-ligne">
            <span class="setting-lbl">Réduire les animations<br><small class="muet">effets de combat atténués, défilements instantanés</small></span>
            <button id="set-animations" class="secondaire ${parametres.reduireAnimations ? `on` : ``}" aria-pressed="${!!parametres.reduireAnimations}">${parametres.reduireAnimations ? `Activé` : `Désactivé`}</button>
          </div>
          <div class="setting-ligne">
            <span class="setting-lbl">Sons<br><small class="muet">petits bruitages (clic, coup, soin, victoire, défaite), volume discret</small></span>
            <button id="set-sons" class="secondaire ${parametres.sons ? `on` : ``}" aria-pressed="${!!parametres.sons}">${parametres.sons ? `Activé` : `Désactivé`}</button>
          </div>
          <div class="setting-ligne">
            <span class="setting-lbl">Astuces de première partie<br><small class="muet">${parametres.vuTuto && CLES_TUTO.every((cle) => parametres.vuTuto[cle]) ? `déjà toutes vues` : `affichées une fois, au fil de la partie`}</small></span>
            <button id="set-astuces" class="secondaire">Revoir les astuces</button>
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
          <p id="set-import-msg" class="muet settings-sous" role="status" style="display:none"></p>
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
              <button id="set-nuage-auto" class="secondaire ${syncAuto() ? `on` : ``}" aria-pressed="${syncAuto()}" title="Envoie la partie quelques secondes après chaque sauvegarde">Auto : ${syncAuto() ? `activé` : `désactivé`}</button>
            </span>
          </div>
          <p id="set-nuage-msg" class="muet settings-sous" role="status"></p>
          <div id="set-texte-zone" class="sauvegarde-texte" style="display:none">
            <p class="muet">Copie ce texte et garde-le (notes, mail…) ; pour récupérer ta partie, colle-le ici puis « Importer le texte ».</p>
            <textarea id="set-texte-champ" rows="6" spellcheck="false" aria-label="Sauvegarde en texte"></textarea>
            <span class="setting-actions">
              <button id="set-texte-copier" class="secondaire">Copier</button>
              <button id="set-texte-importer" class="secondaire">Importer le texte</button>
            </span>
          </div>
          ${
            meta
              ? (() => {
                  let nbDofus = meta.nb();
                  let texte =
                    nbDofus > 0
                      ? `Efface les ${nbDofus} Dofus collectés et les quêtes de leurs succès (les autres succès, les réglages et la run en cours sont conservés).`
                      : `Aucun Dofus collecté pour l'instant.`;
                  return `<div class="setting-ligne ${nbDofus > 0 ? `setting-danger` : ``}">
            <span class="setting-lbl">Réinitialiser les Dofus<br><small class="muet">${texte}</small></span>
            <button id="set-reset-dofus" class="secondaire" ${nbDofus > 0 ? `` : `disabled`}>Réinitialiser</button>
          </div>`;
                })()
              : ``
          }
        </div>
        <h2 class="settings-titre">Préréglages des héros</h2>
        <p class="muet settings-sous">Position et ordre de jeu par défaut, appliqués au début de chaque run. Glisse-dépose les cartes pour changer l'ordre ; pendant une run, la vue Formation le règle sans toucher à cette préférence.</p>
        <div class="presets">
          ${[...classesJouables()]
            .sort(
              (premier, second) =>
                rangOrdre(parametres.ordre, premier) - rangOrdre(parametres.ordre, second),
            )
            .map((classeId, indice) => {
              let rangee = parametres.formation[classeId] === `arriere` ? `arriere` : `avant`;
              return `<div class="preset-carte" draggable="true" data-classe-ordre="${classeId}">
              <span class="ordre-rang">${indice + 1}</span>
              <img class="preset-sym" src="${imgSymboleClasse(classeId)}" alt="" onerror="this.remove()" />
              <span class="preset-nom">${echapperHtml(CLASSES[classeId].nom)}</span>
              ${htmlElementsClasse(classeId)}
              <span class="preset-pos">
                <button class="form-el-btn ${rangee === `avant` ? `sel` : ``}" draggable="false" data-classe="${classeId}" data-rangee="avant" aria-pressed="${rangee === `avant`}" title="Ligne avant (les héros s'y empilent)">Avant</button>
                <button class="form-el-btn ${rangee === `arriere` ? `sel` : ``}" draggable="false" data-classe="${classeId}" data-rangee="arriere" aria-pressed="${rangee === `arriere`}" title="Ligne arrière (les héros s'y empilent)">Arrière</button>
              </span>
            </div>`;
            })
            .join(``)}
        </div>
        ${barreRetour(`set-retour`)}
      `);
      racine.querySelectorAll(`.preset-pos [data-rangee]`).forEach((bouton) => {
        bouton.addEventListener(`click`, () => {
          parametres.formation[bouton.dataset.classe] = bouton.dataset.rangee;
          sauverParametres(parametres);
          afficher();
        });
      });
      let deplacerClasse = (classeId, classeOrdre) => {
        if (classeId === classeOrdre) {
          return;
        }
        let classes = [...classesJouables()].sort(
          (premier, second) =>
            rangOrdre(parametres.ordre, premier) - rangOrdre(parametres.ordre, second),
        );
        let depart = classes.indexOf(classeId);
        let arrivee = classes.indexOf(classeOrdre);
        if (!(depart < 0 || arrivee < 0)) {
          classes.splice(arrivee, 0, classes.splice(depart, 1)[0]);
          classes.forEach((idClasse, indice) => {
            parametres.ordre[idClasse] = indice + 1;
          });
          Object.keys(parametres.ordre)
            .filter((idClasse) => !classes.includes(idClasse))
            .sort(
              (premier, second) =>
                rangOrdre(parametres.ordre, premier) - rangOrdre(parametres.ordre, second),
            )
            .forEach((idClasse, indice) => {
              parametres.ordre[idClasse] = classes.length + indice + 1;
            });
          sauverParametres(parametres);
          afficher();
        }
      };
      racine.querySelectorAll(`[data-classe-ordre]`).forEach((carte) => {
        let classeOrdre = carte.dataset.classeOrdre;
        carte.addEventListener(`dragstart`, (evenement) => {
          evenement.dataTransfer.setData(`text/plain`, classeOrdre);
          carte.classList.add(`drag-src`);
        });
        carte.addEventListener(`dragend`, () => carte.classList.remove(`drag-src`));
        carte.addEventListener(`dragover`, (evenement) => {
          evenement.preventDefault();
          carte.classList.add(`drop-cible`);
        });
        carte.addEventListener(`dragleave`, () => carte.classList.remove(`drop-cible`));
        carte.addEventListener(`drop`, (evenement) => {
          evenement.preventDefault();
          carte.classList.remove(`drop-cible`);
          deplacerClasse(evenement.dataTransfer.getData(`text/plain`), classeOrdre);
        });
      });
      document.getElementById(`set-touche`)?.addEventListener(`click`, () => {
        // un second appui annule la saisie en cours (jamais deux écouteurs en même temps)
        if (captureTouche) {
          document.removeEventListener(`keydown`, captureTouche, true);
          captureTouche = null;
          saisieEnCours = false;
          afficher();
          return;
        }
        saisieEnCours = true;
        afficher();
        let surTouche = (evenement) => {
          // touches réservées : Échap annule, les chiffres choisissent les sorts
          if (
            [`Shift`, `Control`, `Alt`, `Meta`, `Tab`].includes(evenement.key) ||
            evenement.repeat
          ) {
            return;
          }
          evenement.preventDefault();
          evenement.stopPropagation();
          document.removeEventListener(`keydown`, surTouche, true);
          captureTouche = null;
          if (evenement.key !== `Escape` && !/^(?:Digit|Numpad)[1-9]$/.test(evenement.code)) {
            parametres.toucheFinTour = evenement.key;
            sauverParametres(parametres);
          }
          saisieEnCours = false;
          afficher();
        };
        captureTouche = surTouche;
        document.addEventListener(`keydown`, surTouche, true);
      });
      racine.querySelectorAll(`.set-taille`).forEach((bouton) =>
        bouton.addEventListener(`click`, () => {
          parametres.taillePolice = Number(bouton.dataset.taille);
          sauverParametres(parametres);
          appliquerAccessibilite(parametres);
          afficher();
        }),
      );
      document.getElementById(`set-couleurs`)?.addEventListener(`click`, () => {
        parametres.couleursAdaptees = !parametres.couleursAdaptees;
        sauverParametres(parametres);
        appliquerAccessibilite(parametres);
        afficher();
      });
      document.getElementById(`set-animations`)?.addEventListener(`click`, () => {
        parametres.reduireAnimations = !parametres.reduireAnimations;
        sauverParametres(parametres);
        appliquerAccessibilite(parametres);
        afficher();
      });
      document.getElementById(`set-sons`)?.addEventListener(`click`, () => {
        parametres.sons = !parametres.sons;
        sauverParametres(parametres);
        // ce clic est un geste du joueur : il autorise l'audio
        definirSons(parametres.sons);
        afficher();
      });
      document.getElementById(`set-astuces`)?.addEventListener(`click`, () => {
        reinitialiserAstuces();
        afficher();
      });
      brancherSectionsRepliables();
      racine.querySelectorAll(`[data-bascule]`).forEach((bouton) =>
        bouton.addEventListener(`click`, () => {
          const cle = bouton.dataset.bascule;
          parametres[cle] = !parametres[cle];
          sauverParametres(parametres);
          afficher();
        }),
      );
      racine.querySelectorAll(`[data-mode-auto]`).forEach((bouton) =>
        bouton.addEventListener(`click`, () => {
          parametres.modeAuto = bouton.dataset.modeAuto;
          sauverParametres(parametres);
          afficher();
        }),
      );
      document.getElementById(`set-rapide`)?.addEventListener(`click`, () => {
        parametres.combatRapide = !parametres.combatRapide;
        sauverParametres(parametres);
        afficher();
      });
      document.getElementById(`set-auto`)?.addEventListener(`click`, () => {
        parametres.autoFinTour = !parametres.autoFinTour;
        sauverParametres(parametres);
        afficher();
      });
      let message = (texte) => {
        let element = document.getElementById(`set-import-msg`);
        if (element) {
          element.textContent = texte;
          element.style.display = ``;
        }
      };
      let zoneTexte = () => {
        let conteneur = document.getElementById(`set-texte-zone`);
        let champ = document.getElementById(`set-texte-champ`);
        if (conteneur && champ) {
          conteneur.style.display = ``;
          champ.value = exporterSauvegarde();
          champ.focus();
          champ.select();
        }
      };
      document.getElementById(`set-export`)?.addEventListener(`click`, async () => {
        let nom = `roguefus-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
        let issue = await telechargerTexte(nom, exporterSauvegarde());
        if (issue === `saved`) {
          message(`✓ Sauvegarde exportée (${nom}).`);
        } else if (issue === `declined`) {
          message(`Export annulé.`);
        } else {
          message(
            `Le téléchargement n'est pas possible ici : copie plutôt la sauvegarde en texte ci-dessous.`,
          );
          zoneTexte();
        }
      });
      document.getElementById(`set-texte`)?.addEventListener(`click`, zoneTexte);
      // sauvegarde en ligne : visible seulement quand elle est disponible (état lu une fois, en cache)
      const resumeIci = () => {
        try {
          return texteResume(resumePartieLocale());
        } catch {
          return `—`;
        }
      };
      const resumeEnLigne = (info) =>
        info?.resume ? texteResume(info.resume) : `contenu inconnu (ancien envoi)`;
      const msgNuage = (texte) => {
        messageNuage = texte;
        const el = document.getElementById(`set-nuage-msg`);
        if (el) {
          el.textContent = texte;
        }
      };
      const brancherPause = (info) => {
        const ici = resumeIci();
        const enLigne = resumeEnLigne(info);
        // un même bouton n'est branché qu'une fois, même si l'état en ligne est redessiné
        const brancher = (id, action) => {
          const bouton = document.getElementById(id);
          if (bouton && !bouton.dataset.branche) {
            bouton.dataset.branche = `1`;
            bouton.addEventListener(`click`, action);
          }
        };
        brancher(`set-pause-recuperer`, async (ev) => {
          const bouton = ev.currentTarget;
          if (
            !(await demanderConfirmation(
              `Récupérer la partie en ligne (${enLigne}) ? Elle remplacera celle d'ici (${ici}), qui reste récupérable avec « Annuler le dernier import ».`,
              `Récupérer`,
            ))
          ) {
            return;
          }
          bouton.disabled = true;
          bouton.textContent = `Récupération…`;
          if (await recupererNuage().catch(() => false)) {
            msgNuage(
              `✓ Partie récupérée, rechargement…${avertissementNuage() ? ` ${avertissementNuage()}` : ``}`,
            );
            setTimeout(() => location.reload(), 600);
          } else {
            bouton.disabled = false;
            bouton.textContent = `Récupérer`;
            msgNuage(
              `✗ Récupération impossible : ${raisonEchecNuage() || `erreur inconnue`}. Réessaie dans un moment.`,
            );
          }
        });
        brancher(`set-pause-garder`, async (ev) => {
          const bouton = ev.currentTarget;
          if (
            !(await demanderConfirmation(
              `Garder la partie d'ici (${ici}) ? Elle sera envoyée en ligne et remplacera celle de l'autre appareil (${enLigne}).`,
              `Garder celle d'ici`,
            ))
          ) {
            return;
          }
          bouton.disabled = true;
          bouton.textContent = `Envoi…`;
          try {
            await envoyerNuage();
            nuage.plusRecent = null;
            nuage.info = await infoNuage().catch(() => nuage.info);
            msgNuage(`✓ Partie d'ici envoyée en ligne : la synchro auto reprend.`);
            majNuage();
          } catch {
            bouton.disabled = false;
            bouton.textContent = `Garder celle d'ici`;
            msgNuage(`✗ Envoi impossible pour l'instant, réessaie dans un moment.`);
          }
        });
      };
      // dessine l'état du cache dans le DOM courant (aucun appel réseau)
      const majNuage = () => {
        const ligne = document.getElementById(`set-nuage`);
        if (ligne && nuage.dispo) {
          ligne.style.display = ``;
          const el = document.getElementById(`set-nuage-etat`);
          if (el) {
            el.textContent = nuage.info
              ? `En ligne : partie envoyée depuis ${nuage.info.appareil} le ${dateLisible(nuage.info.date)}.`
              : `Aucune partie en ligne pour l'instant.`;
          }
        }
        const pause = document.getElementById(`set-nuage-pause`);
        if (pause) {
          const info = nuage.plusRecent;
          pause.style.display = info ? `` : `none`;
          if (info) {
            document.getElementById(`set-nuage-pause-detail`).textContent =
              `Ici : ${resumeIci()} · En ligne (${info.appareil ?? `autre appareil`}, ${dateLisible(info.date)}) : ${resumeEnLigne(info)}`;
            brancherPause(info);
          }
        }
        const element = document.getElementById(`set-nuage-msg`);
        if (element) {
          element.textContent = messageNuage;
        }
      };
      // compte (hors claude.ai) : connexion, création, déconnexion ; on recharge pour tout rebrancher
      const msgCompte = (texte) => {
        const el = document.getElementById(`set-compte-msg`);
        if (el) {
          el.textContent = texte;
        }
      };
      const entrerCompte = async (creer) => {
        const email = document.getElementById(`set-compte-email`)?.value ?? ``;
        const mdp = document.getElementById(`set-compte-mdp`)?.value ?? ``;
        if (!email.includes(`@`) || mdp.length < 6) {
          msgCompte(`Entre un email valide et un mot de passe d'au moins 6 caractères.`);
          return;
        }
        document
          .querySelectorAll(`#set-compte-form button`)
          .forEach((bouton) => (bouton.disabled = true));
        msgCompte(creer ? `Création du compte…` : `Connexion…`);
        try {
          if (creer) {
            const compte = await creerCompte(email, mdp);
            if (!compte.connecte) {
              msgCompte(
                `Compte créé. Ouvre le courriel de confirmation reçu, puis reviens ici et touche « Se connecter ».`,
              );
              document
                .querySelectorAll(`#set-compte-form button`)
                .forEach((bouton) => (bouton.disabled = false));
              return;
            }
          } else {
            await seConnecter(email, mdp);
          }
          msgCompte(`✓ Connecté, rechargement…`);
          setTimeout(() => location.reload(), 500);
        } catch (erreur) {
          msgCompte(`✗ ${erreur.message}`);
          document
            .querySelectorAll(`#set-compte-form button`)
            .forEach((bouton) => (bouton.disabled = false));
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
      rafraichirNuage = majNuage;
      majNuage();
      document.getElementById(`set-nuage-envoyer`)?.addEventListener(`click`, async (ev) => {
        if (nuageOccupe) {
          return;
        }
        const bouton = ev.currentTarget;
        const enLigne = nuage.info
          ? `${resumeEnLigne(nuage.info)}, envoyée depuis ${nuage.info.appareil ?? `un autre appareil`} le ${dateLisible(nuage.info.date)}`
          : `aucune partie pour l'instant`;
        if (
          !(await demanderConfirmation(
            `Envoyer la partie d'ici (${resumeIci()}) ? Elle remplacera celle qui est en ligne (${enLigne}).`,
            `Envoyer`,
          ))
        ) {
          msgNuage(`Envoi annulé.`);
          return;
        }
        nuageOccupe = true;
        bouton.disabled = true;
        bouton.textContent = `Envoi…`;
        try {
          await envoyerNuage();
          nuage.plusRecent = null;
          nuage.info = await infoNuage().catch(() => nuage.info);
          msgNuage(
            `✓ Partie envoyée en ligne : ouvre l'artefact sur ton autre appareil et touche « Récupérer ».`,
          );
        } catch {
          msgNuage(`✗ Envoi impossible pour l'instant, réessaie dans un moment.`);
        }
        nuageOccupe = false;
        bouton.disabled = false;
        bouton.textContent = `Envoyer cette partie`;
        majNuage();
      });
      document.getElementById(`set-nuage-recuperer`)?.addEventListener(`click`, async (ev) => {
        if (nuageOccupe) {
          return;
        }
        const bouton = ev.currentTarget;
        const enLigne = nuage.info
          ? `${resumeEnLigne(nuage.info)}, envoyée depuis ${nuage.info.appareil ?? `un autre appareil`} le ${dateLisible(nuage.info.date)}`
          : `aucune partie pour l'instant`;
        if (
          !(await demanderConfirmation(
            `Récupérer la partie en ligne (${enLigne}) ? Elle remplacera celle d'ici (${resumeIci()}), qui reste récupérable avec « Annuler le dernier import ».`,
            `Récupérer`,
          ))
        ) {
          msgNuage(`Récupération annulée.`);
          return;
        }
        nuageOccupe = true;
        bouton.disabled = true;
        bouton.textContent = `Récupération…`;
        if (await recupererNuage().catch(() => false)) {
          msgNuage(
            `✓ Partie récupérée, rechargement…${avertissementNuage() ? ` ${avertissementNuage()}` : ``}`,
          );
          setTimeout(() => location.reload(), 600);
        } else {
          msgNuage(
            `✗ Récupération impossible : ${raisonEchecNuage() || `erreur inconnue`}. Réessaie dans un moment.`,
          );
          nuageOccupe = false;
          bouton.disabled = false;
          bouton.textContent = `Récupérer`;
        }
      });
      document.getElementById(`set-nuage-auto`)?.addEventListener(`click`, () => {
        changerSyncAuto(!syncAuto());
        afficher();
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
        if (
          !sauvegardeDeSecours() &&
          !(await demanderConfirmation(
            `Le navigateur n'a pas assez de place pour garder une copie de ta partie actuelle : si tu continues, elle ne sera pas récupérable. Importer quand même ?`,
            `Importer quand même`,
          ))
        ) {
          message(`Import annulé.`);
          return;
        }
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
      let champFichier = document.getElementById(`set-import-file`);
      document.getElementById(`set-import`)?.addEventListener(`click`, () => champFichier?.click());
      champFichier?.addEventListener(`change`, async () => {
        let fichier = champFichier.files?.[0];
        if (!fichier) {
          return;
        }
        champFichier.value = ``;
        importer(
          await fichier.text(),
          `✗ Fichier invalide : ce n'est pas une sauvegarde Roguefus Lite.`,
        );
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
      document.getElementById(`set-reset-dofus`)?.addEventListener(`click`, async () => {
        const nb = meta.nb();
        if (
          !(await demanderConfirmation(
            `Effacer définitivement tes Dofus${nb ? ` (${nb})` : ``} et les quêtes de leurs succès ? Une copie de ta partie est gardée : « Annuler le dernier import » la remet.`,
            `Effacer`,
          ))
        ) {
          return;
        }
        sauvegardeDeSecours();
        meta.onReset();
        inutilise = false;
        afficher();
      });
      document.getElementById(`set-retour`)?.addEventListener(`click`, () => {
        if (captureTouche) {
          document.removeEventListener(`keydown`, captureTouche, true);
          captureTouche = null;
        }
        resolve();
      });
    };
    afficher();
    // appels réseau : une seule fois à l'ouverture, puis on redessine depuis le cache
    (async () => {
      nuage.dispo = await nuageDisponible().catch(() => false);
      if (nuage.dispo) {
        nuage.info = await infoNuage().catch(() => null);
        nuage.plusRecent = await nuagePlusRecent().catch(() => null);
      }
      rafraichirNuage();
    })();
  });
}
