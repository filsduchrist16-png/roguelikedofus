import { MONDES } from "../../data/index.js";
import { DIFFICULTES, DIFFICULTE_MAX, reliquesDuMonde } from "../../jeu/config.js";
import { progressionArchisMonde } from "../../jeu/quetes.js";
import { BENEDICTIONS } from "../../jeu/rencontres.js";
import { benedictionDuJour, cleRecordJour, dateDuJour } from "../../jeu/runDuJour.js";
import { IDOLES_DEPART, idolesDepartValides } from "../../jeu/idolesDepart.js";
import {
  ascensionMonde,
  mondeJouable,
  mondePrecedentTermine,
  recordMonde,
  statsMonde,
} from "../../sauvegarde/meta.js";
import { sauverParametres } from "../../sauvegarde/parametres.js";
import {
  comportementDefilement,
  IMG_ABANDONNER,
  IMG_ARMURERIE,
  IMG_BESTIAIRE,
  IMG_DOFUS,
  IMG_ENCYCLOPEDIE,
  IMG_ETOILE,
  IMG_JOUER,
  IMG_LOGO,
  IMG_PARAMETRES,
  IMG_SUCCES,
  afficherEcran,
  demanderConfirmation,
  echapperHtml,
  ecranTactile,
  etoilesDifficulte,
  imgMonde,
  parametres,
  racine,
} from "../commun.js";
import { ecranParametres } from "./parametres.js";
import { ecranEncyclopedie } from "./encyclopedie.js";
import { ecranBestiaire } from "./bestiaire.js";
import { ecranArmurerie } from "./armurerie.js";
import { afficherBandeau, ecranSucces } from "./succes.js";
import { ecranRegles } from "./regles.js";
import { ecranMentionsLegales } from "./mentions.js";
import { ecranDofus } from "./dofus.js";
import { htmlProchainDofus } from "../prochainDofus.js";
import {
  envoyerNuage,
  nuagePlusRecent,
  raisonEchecNuage,
  recupererNuage,
} from "../../sauvegarde/nuage.js";
import { resumePartieLocale, texteResume } from "../../sauvegarde/export.js";
import { dateLisible } from "./parametres.js";
import { CONDITION_SONGES, recordSonges, songesDebloques } from "../../jeu/songes.js";
import { IMG_SONGES } from "./songes.js";
import { VERSION } from "../../version.js";
import { htmlAlmanax } from "../almanax.js";
const LIEN_DISCORD = `https://discord.gg/jxfWpRB7Rp`;
const numeroMonde = (id) => MONDES.findIndex((monde) => monde.id === id) + 1;
// Plus haute difficulté ouverte dans ce monde (une run gagnée débloque la suivante).
function palierDebloque(meta, trancheId) {
  const ascensionMax = ascensionMonde(meta, trancheId);
  return ascensionMax === undefined ? 0 : Math.min(ascensionMax + 1, DIFFICULTE_MAX);
}
const mondeOuvert = (meta, id) =>
  MONDES.some((monde) => monde.id === id) &&
  mondePrecedentTermine(meta, id) &&
  mondeJouable(meta, id);
// Ce qu'il faut faire pour débloquer la difficulté n dans ce monde (palier : plus haute ouverte).
// Une victoire n'ouvre que le palier suivant : au-delà, on rappelle par où commencer.
export function conditionVerrou(trancheId, palier, cran) {
  const monde = `Monde ${numeroMonde(trancheId)}`;
  if (cran <= palier + 1) {
    return `🔒 Gagne une run du ${monde} en ${DIFFICULTES[cran - 1].nom} pour débloquer ${DIFFICULTES[cran].nom}.`;
  }
  return `🔒 Gagne une run du ${monde} en ${DIFFICULTES[cran - 1].nom} pour débloquer ${DIFFICULTES[cran].nom}. Les paliers s'ouvrent un à un : commence par gagner en ${DIFFICULTES[palier].nom}.`;
}
export function ecranAccueil(meta, onReset, reprise = null) {
  return new Promise((resolve) => {
    // dernier départ retenu (monde et difficulté), s'il est encore possible
    const depart = parametres.dernierDepart;
    let trancheId =
      reprise?.trancheId ??
      (depart?.trancheId && mondeOuvert(meta, depart.trancheId) ? depart.trancheId : `t1`);
    let ascension = reprise
      ? 0
      : Math.max(0, Math.min(Math.trunc(depart?.ascension) || 0, palierDebloque(meta, trancheId)));
    // idoles de départ cochées (cumulables) et section dépliée ou non
    const idoles = new Set(idolesDepartValides(parametres.idolesChoisies));
    let idolesOuvert = false;
    // élément à refocaliser après un nouveau rendu (navigation au clavier)
    let focusApres = null;
    let afficher = () => {
      let meilleurPalier = ascensionMonde(meta, trancheId);
      let diff = DIFFICULTES[ascension] ?? DIFFICULTES[0];
      let recap = reprise
        ? reprise.songes
          ? `Reprendre · Songes infinis, étage ${reprise.etage}`
          : `Reprendre · Zone ${reprise.zoneNum}/${reprise.nbZones} : ${reprise.zoneNom}`
        : `Monde ${numeroMonde(trancheId)} · ${`★`.repeat(ascension + 1)} ${diff.nom}`;
      let htmlBoutons = reprise
        ? `<button id="btn-reprendre" class="btn-jouer btn-reprendre" aria-label="${echapperHtml(recap)}"><img src="${IMG_JOUER}" alt="Reprendre" onerror="this.remove()" /></button>
           <button id="btn-abandon" class="btn-jouer btn-abandon" title="Abandonner la run"><img src="${IMG_ABANDONNER}" alt="Abandonner la run" onerror="this.replaceWith(this.alt)" /></button>`
        : `<button id="btn-start" class="btn-jouer" aria-label="${echapperHtml(`Jouer : ${recap}`)}"><img src="${IMG_JOUER}" alt="Jouer" onerror="this.remove()" /></button>`;
      // run du jour : mêmes cartes pour tous aujourd'hui, une bénédiction imposée, record du jour
      const jourDate = dateDuJour();
      const benediction = BENEDICTIONS[benedictionDuJour(jourDate)];
      const recordJour = recordMonde(meta, cleRecordJour(jourDate, trancheId));
      const htmlJour = reprise
        ? ``
        : `<div class="run-du-jour">
          <button id="btn-jour" class="secondaire btn-run-jour" aria-label="${echapperHtml(`Run du jour, Monde ${numeroMonde(trancheId)}`)}">📅 Run du jour</button>
          <p class="run-du-jour-info">Mêmes cartes pour tous aujourd'hui · ${echapperHtml(benediction.nom)} imposée (${echapperHtml(benediction.desc)})${recordJour ? ` · Record du jour : ${recordJour.score} points` : ``}</p>
        </div>`;
      // Songes infinis : ouverts après une run du Monde 5 gagnée ; record sous le bouton
      const songesOuverts = songesDebloques(meta);
      const recordSonge = recordSonges(meta);
      const songesBloques = !songesOuverts || !!reprise;
      const conditionSonges = !songesOuverts
        ? CONDITION_SONGES
        : `Termine ou abandonne la partie en cours pour entrer dans les Songes.`;
      const htmlSonges = `<div class="songes-accueil">
          <button id="btn-songes" class="secondaire btn-songes${songesBloques ? ` verrou` : ``}"${songesBloques ? ` aria-disabled="true" data-tip="${echapperHtml(conditionSonges)}"` : ``}><img src="${IMG_SONGES}" alt="" onerror="this.remove()" /><span>${songesOuverts ? `` : `🔒 `}Songes infinis</span></button>
          <p class="songes-accueil-info">${songesOuverts ? `Combats sans fin, de plus en plus durs.${recordSonge ? ` Record : <b>${recordSonge} étage${recordSonge > 1 ? `s` : ``}</b>` : ``}` : echapperHtml(CONDITION_SONGES)}</p>
        </div>`;
      htmlBoutons += `<p class="jouer-recap${diff.effets.mortDefinitive && !reprise ? ` mort-definitive` : ``}">${echapperHtml(recap)}</p>`;
      let htmlEtoiles = (mondeId) => {
        let palier = palierDebloque(meta, mondeId);
        let actif = mondeId === trancheId;
        return DIFFICULTES.map((difficulte, indice) => {
          let verrouille = indice > palier;
          let classes = [
            `asc-etoile`,
            actif && indice <= ascension ? `pleine` : ``,
            verrouille ? `verrou` : ``,
          ]
            .filter(Boolean)
            .join(` `);
          return `<button class="${classes}" ${verrouille ? `aria-disabled="true" data-verrou="${indice}" data-palier="${palier}"` : `data-asc="${indice}"`} data-asc-tranche="${mondeId}" aria-label="${echapperHtml(verrouille ? `${difficulte.nom} (verrouillé)` : difficulte.nom)}"${actif && indice === ascension ? ` aria-pressed="true"` : ``}>
            <img src="${IMG_ETOILE}" alt="" onerror="this.parentElement.textContent='★'" />
          </button>`;
        }).join(``);
      };
      const record = recordMonde(meta, trancheId);
      let htmlDifficultes = reprise
        ? ``
        : `<div class="asc-section">
          <div class="asc-textes">${DIFFICULTES.map(
            (
              difficulte,
              indice,
            ) => `<div class="asc-texte${indice === ascension ? ` visible` : ``}" data-asc-texte="${indice}">
            <p class="asc-nom">${echapperHtml(difficulte.nom)}</p>
            <p class="asc-desc" data-desc="${echapperHtml(difficulte.desc)}">${echapperHtml(difficulte.desc)}</p>
          </div>`,
          ).join(``)}</div>
          ${meilleurPalier !== undefined && meilleurPalier >= 1 ? `<p class="asc-record">Meilleur palier : ${etoilesDifficulte(meilleurPalier)} ${echapperHtml(DIFFICULTES[meilleurPalier].nom)}</p>` : ``}
          ${
            record
              ? `<p class="asc-record">Record du monde : ${record.score} points${record.idoles.length ? ` (${record.idoles.map((id) => echapperHtml(IDOLES_DEPART[id].nom)).join(`, `)})` : ``}</p>`
              : ``
          }
          <details class="idoles-depart"${idolesOuvert ? ` open` : ``}>
            <summary>🗿 Idoles de départ${idoles.size ? ` (${idoles.size})` : ``}</summary>
            <p>Des malus pour toute la run contre des bonus : cumulables, le score du monde augmente.</p>
            ${Object.entries(IDOLES_DEPART)
              .map(
                ([id, idole]) => `<label class="idole-depart">
              <input type="checkbox" data-idole="${id}"${idoles.has(id) ? ` checked` : ``} />
              <span><b>${echapperHtml(idole.nom)}</b> : ${echapperHtml(idole.malus)} · ${echapperHtml(idole.bonus)}</span>
            </label>`,
              )
              .join(``)}
          </details>
        </div>`;
      afficherEcran(
        `
        <div class="coin-gauche">
          <h1 class="sr-only">Roguefus Lite</h1>
          <button id="btn-regles" class="btn-regles">Règles</button>
          <a class="btn-discord" href="${LIEN_DISCORD}" target="_blank" rel="noopener noreferrer" title="Rejoindre le Discord du jeu">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M20.32 4.37A19.8 19.8 0 0 0 15.39 2.8a13.7 13.7 0 0 0-.63 1.3 18.4 18.4 0 0 0-5.5 0 13.7 13.7 0 0 0-.64-1.3 19.7 19.7 0 0 0-4.93 1.53C.53 9.05-.32 13.6.1 18.1a19.9 19.9 0 0 0 6.04 3.05 14.6 14.6 0 0 0 1.29-2.1 12.9 12.9 0 0 1-2.04-.97l.5-.39a14.2 14.2 0 0 0 12.2 0l.5.39c-.65.39-1.33.71-2.04.98.37.74.8 1.44 1.29 2.1a19.8 19.8 0 0 0 6.04-3.06c.5-5.2-.84-9.7-3.56-13.73ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.95-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.95-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.94 2.42-2.16 2.42Z"/></svg>
            <span>Discord</span>
          </a>
        </div>
        <div class="coin-menu">
          <button id="btn-dofus" class="coin-param" data-lbl="Dofus" title="Dofus"><img src="${IMG_DOFUS}" alt="Dofus" onerror="this.remove()" /></button>
          <button id="btn-bestiaire" class="coin-param" data-lbl="Bestiaire" title="Bestiaire"><img src="${IMG_BESTIAIRE}" alt="Bestiaire" onerror="this.remove()" /></button>
          <button id="btn-encyclopedie" class="coin-param" data-lbl="Classes" title="Encyclopédie des classes"><img src="${IMG_ENCYCLOPEDIE}" alt="Encyclopédie" onerror="this.parentElement.textContent='📖'" /></button>
          <button id="btn-armurerie" class="coin-param" data-lbl="Armurerie" title="Armurerie"><img src="${IMG_ARMURERIE}" alt="Armurerie" onerror="this.parentElement.textContent='🛡️'" /></button>
          <button id="btn-succes" class="coin-param" data-lbl="Succès" title="Succès"><img src="${IMG_SUCCES}" alt="Succès" onerror="this.remove()" /></button>
          <button id="btn-settings" class="coin-param" data-lbl="Paramètres" title="Paramètres"><img src="${IMG_PARAMETRES}" alt="Paramètres" onerror="this.remove()" /></button>
        </div>
        <img class="logo-accueil" src="${IMG_LOGO}" alt="Roguefus Lite" onerror="this.remove()" />
        <div class="mondes-rack">
          ${MONDES.map((monde, indice) => {
            let precedentTermine = mondePrecedentTermine(meta, monde.id);
            let jouable = mondeJouable(meta, monde.id);
            let classes = [
              `monde-carte`,
              monde.id === trancheId ? `active` : ``,
              precedentTermine ? `` : `locked`,
              precedentTermine && !jouable ? `chantier` : ``,
              precedentTermine && jouable ? `jouable` : ``,
            ]
              .filter(Boolean)
              .join(` `);
            let badge = precedentTermine
              ? jouable
                ? reprise && monde.id === reprise.trancheId
                  ? `Run en cours`
                  : ``
                : `Bientôt`
              : `🔒 Finis le monde ${indice}`;
            let tipRun = reprise?.songes
              ? `Songes infinis en cours
Étage ${reprise.etage}`
              : reprise
                ? `Run en cours
Zone ${reprise.zoneNum}/${reprise.nbZones} : ${reprise.zoneNom}
Difficulté : ${DIFFICULTES[reprise.ascension]?.nom ?? `Normal`}`
                : ``;
            let etoilesMonde =
              precedentTermine && jouable && !reprise
                ? `<span class="asc-rangee monde-etoiles" data-rangee="${monde.id}">${htmlEtoiles(monde.id)}</span>`
                : ``;
            let stats = statsMonde(meta, monde.id);
            let [archisFaits, archisTotal] = progressionArchisMonde(meta.archis, monde.id);
            let reliques = reliquesDuMonde(monde.id);
            let nbReliques = reliques.filter((id) => meta.reliques?.includes(id)).length;
            let lignesStats = monde.zones.length
              ? [
                  [
                    `Zone max atteinte`,
                    stats.toileMax ? `${stats.toileMax}/${monde.zones.length}` : `—`,
                  ],
                  [`Runs réussies`, String(stats.victoires)],
                  [`Archimonstres`, archisTotal ? `${archisFaits}/${archisTotal}` : `—`],
                  [`Reliques`, reliques.length ? `${nbReliques}/${reliques.length}` : `—`],
                ]
              : [
                  [`Zone max atteinte`, `—`],
                  [`Runs réussies`, `—`],
                  [`Archimonstres`, `—`],
                  [`Reliques`, `—`],
                ];
            let choisissable = jouable && !reprise;
            return `<div class="${classes}" ${choisissable ? `data-tranche="${monde.id}" role="button" tabindex="0" aria-pressed="${monde.id === trancheId}"` : ``}${monde.id === reprise?.trancheId ? ` data-tip="${echapperHtml(tipRun)}"` : ``}>
              <div class="monde-medaillon">
                <img class="monde-img" src="${imgMonde(indice + 1)}" alt="" onerror="this.remove()" />
                ${etoilesMonde}${badge ? `<span class="monde-badge">${badge}</span>` : ``}
              </div>
              <span class="monde-nom">Monde ${indice + 1}</span>
              <span class="monde-niveaux">Niveau ${monde.niveaux[0]}${monde.niveaux[1] === monde.niveaux[0] ? `` : ` - ${monde.niveaux[1]}`}</span>
              <span class="monde-stats">${lignesStats.map(([libelle, valeur]) => `<span>${libelle} : <b>${valeur}</b></span>`).join(``)}</span>
            </div>`;
          }).join(``)}
        </div>
        ${htmlDifficultes}
        ${htmlProchainDofus(meta)}
        <div class="boutons-ecran">
          ${htmlBoutons}
        </div>
        ${htmlJour}
        ${htmlAlmanax(meta)}
        ${htmlSonges}
        <div class="accueil-mentions">
          <p class="mention-ankama">Fangame non officiel. Les illustrations DOFUS appartiennent à Ankama. <button id="btn-disclaimer" class="btn-lien">Mentions légales</button> · Fait avec passion par Cora, Daaye et T. · <span class="version-jeu">Version ${VERSION}</span></p>
          <p class="bandeau-credits">🎨 Crédits : illustrations, icônes de sorts et symboles de classe © <b>Ankama Games</b> — DOFUS (<a href="https://www.dofus.com" target="_blank" rel="noopener noreferrer">dofus.com</a>), icônes récupérées via <a href="https://dofusdb.fr" target="_blank" rel="noopener noreferrer">DofusDB</a>.</p>
        </div>
      `,
        `ecran-accueil`,
      );
      document.getElementById(`btn-disclaimer`)?.addEventListener(`click`, async () => {
        await ecranMentionsLegales();
        afficher();
      });
      document.getElementById(`btn-settings`)?.addEventListener(`click`, async () => {
        await ecranParametres({
          nb: () => meta.dofus.length,
          onReset,
        });
        afficher();
      });
      document.getElementById(`btn-regles`)?.addEventListener(`click`, async () => {
        await ecranRegles();
        afficher();
      });
      document.getElementById(`btn-succes`)?.addEventListener(`click`, async () => {
        await ecranSucces(meta);
        afficher();
      });
      document.getElementById(`btn-bestiaire`)?.addEventListener(`click`, async () => {
        await ecranBestiaire(meta);
        afficher();
      });
      document.getElementById(`btn-encyclopedie`)?.addEventListener(`click`, async () => {
        await ecranEncyclopedie();
        afficher();
      });
      document.getElementById(`btn-armurerie`)?.addEventListener(`click`, async () => {
        await ecranArmurerie(meta);
        afficher();
      });
      // l'encart « Dofus à portée » ouvre les Succès sur le Dofus touché
      document.querySelector(`.prochain-dofus`)?.addEventListener(`click`, async (ev) => {
        // au toucher, une quête ouvre son indice (« où la faire ») au lieu de quitter l'écran
        if (ecranTactile() && ev.target.closest(`.pd-quetes li[data-tip]`)) {
          return;
        }
        const id = ev.target.closest(`[data-dofus]`)?.dataset.dofus;
        await ecranSucces(meta, id ? `d:${id}` : undefined);
        afficher();
      });
      // une partie plus récente envoyée depuis l'autre appareil (sauvegarde en ligne)
      nuagePlusRecent()
        .then((info) => {
          const ecran = document.querySelector(`.ecran-accueil`);
          if (!info || !ecran || ecran.querySelector(`.nuage-bandeau`)) {
            return;
          }
          const div = document.createElement(`div`);
          div.className = `nuage-bandeau`;
          div.innerHTML = htmlBandeauNuage(info);
          ecran.prepend(div);
          brancherBandeauNuage(div, info);
        })
        .catch(() => {});
      document.getElementById(`btn-dofus`)?.addEventListener(`click`, async () => {
        await ecranDofus(meta);
        afficher();
      });
      let textes = [...racine.querySelectorAll(`[data-asc-texte]`)];
      // texte de difficulté affiché ; condition : message de déblocage à la place de la description
      let afficherTexte = (cran, condition = null) => {
        textes.forEach((texte) => {
          let visible = Number(texte.dataset.ascTexte) === cran;
          texte.classList.toggle(`visible`, visible);
          let desc = texte.querySelector(`.asc-desc`);
          if (desc) {
            desc.textContent = visible && condition ? condition : desc.dataset.desc;
            desc.classList.toggle(`asc-condition`, visible && !!condition);
          }
        });
      };
      // message de déblocage affiché : seul un autre survol ou clic l'efface (pas le mouseleave)
      let conditionAffichee = false;
      // pendant le défilement qui suit le clic, un survol « subi » ne doit pas l'effacer
      let conditionDepuis = 0;
      let survolerRangee = (rangee, cran, texte = true) => {
        rangee.querySelectorAll(`.asc-etoile`).forEach((etoile, indice) => {
          if (!etoile.classList.contains(`verrou`)) {
            etoile.classList.toggle(`pleine`, indice <= cran);
          }
        });
        if (texte) {
          afficherTexte(Math.max(0, cran));
        }
      };
      // fait remonter la section au-dessus de la barre « Jouer » collante
      let montrerSection = () => {
        let section = racine.querySelector(`.asc-section`);
        if (!section) {
          return;
        }
        let barre = racine.querySelector(`.ecran-accueil > .boutons-ecran`);
        let bas = barre ? barre.getBoundingClientRect().top : window.innerHeight;
        bas = Math.min(bas, window.innerHeight) - 8;
        let cadre = section.getBoundingClientRect();
        let delta = cadre.bottom > bas ? cadre.bottom - bas : cadre.top < 0 ? cadre.top - 8 : 0;
        if (delta) {
          window.scrollBy({ top: delta, behavior: comportementDefilement() });
        }
      };
      racine.querySelectorAll(`[data-rangee]`).forEach((rangee) => {
        rangee.querySelectorAll(`.asc-etoile[data-asc]`).forEach((etoile) => {
          let cran = Number(etoile.dataset.asc);
          etoile.addEventListener(`click`, (evenement) => {
            evenement.stopPropagation();
            trancheId = etoile.dataset.ascTranche;
            ascension = cran;
            focusApres = `.asc-etoile[data-asc="${cran}"][data-asc-tranche="${trancheId}"]`;
            afficher();
          });
          etoile.addEventListener(`mouseenter`, () => {
            if (ecranTactile() || performance.now() - conditionDepuis < 900) {
              return;
            }
            conditionAffichee = false;
            survolerRangee(rangee, cran);
          });
        });
        // étoile verrouillée : dire comment la débloquer plutôt que ne rien faire
        rangee.querySelectorAll(`.asc-etoile[data-verrou]`).forEach((etoile) => {
          etoile.addEventListener(`click`, (ev) => {
            ev.stopPropagation();
            let cran = Number(etoile.dataset.verrou);
            afficherTexte(
              cran,
              conditionVerrou(etoile.dataset.ascTranche, Number(etoile.dataset.palier), cran),
            );
            conditionAffichee = true;
            conditionDepuis = performance.now();
            montrerSection();
          });
        });
        // survol à la souris seulement : au toucher, le défilement ne doit pas effacer le message
        rangee.addEventListener(`mouseleave`, () => {
          if (ecranTactile()) {
            return;
          }
          survolerRangee(rangee, rangee.dataset.rangee === trancheId ? ascension : -1, false);
          if (!conditionAffichee) {
            afficherTexte(ascension);
          }
        });
      });
      racine.querySelector(`.idoles-depart`)?.addEventListener(`toggle`, (ev) => {
        idolesOuvert = ev.target.open;
      });
      racine.querySelectorAll(`input[data-idole]`).forEach((caseIdole) => {
        caseIdole.addEventListener(`change`, () => {
          if (caseIdole.checked) {
            idoles.add(caseIdole.dataset.idole);
          } else {
            idoles.delete(caseIdole.dataset.idole);
          }
          // le choix est mémorisé pour la prochaine run
          parametres.idolesChoisies = [...idoles];
          sauverParametres(parametres);
          focusApres = `input[data-idole="${caseIdole.dataset.idole}"]`;
          afficher();
        });
      });
      racine.querySelectorAll(`[data-tranche]`).forEach((carte) => {
        carte.addEventListener(`click`, () => {
          // un appui à côté d'une étoile sur le monde déjà choisi ne remet pas la difficulté à zéro
          if (carte.dataset.tranche !== trancheId) {
            trancheId = carte.dataset.tranche;
            ascension = 0;
          }
          focusApres = document.activeElement === carte ? `[data-tranche="${trancheId}"]` : null;
          afficher();
        });
        carte.addEventListener(`keydown`, (ev) => {
          if ((ev.key === `Enter` || ev.key === ` `) && ev.target === carte) {
            ev.preventDefault();
            carte.click();
          }
        });
      });
      if (focusApres) {
        racine.querySelector(focusApres)?.focus({ preventScroll: true });
        focusApres = null;
      }
      document.getElementById(`btn-start`)?.addEventListener(`click`, async () => {
        if (
          DIFFICULTES[ascension]?.effets.mortDefinitive &&
          !(await demanderConfirmation(
            `Mort définitive : un héros tombé est perdu pour la run. Lancer ?`,
            `Lancer`,
          ))
        ) {
          return;
        }
        resolve({
          action: `nouvelle`,
          ascension,
          trancheId,
          idoles: [...idoles],
        });
      });
      document.getElementById(`btn-jour`)?.addEventListener(`click`, async () => {
        if (
          DIFFICULTES[ascension]?.effets.mortDefinitive &&
          !(await demanderConfirmation(
            `Mort définitive : un héros tombé est perdu pour la run. Lancer ?`,
            `Lancer`,
          ))
        ) {
          return;
        }
        resolve({ action: `nouvelle`, ascension, trancheId, idoles: [], jour: true });
      });
      document.getElementById(`btn-songes`)?.addEventListener(`click`, () => {
        if (songesBloques) {
          // verrouillé : la condition s'affiche sous le bouton (le toucher n'ouvre pas de bulle)
          const info = racine.querySelector(`.songes-accueil-info`);
          if (info) {
            info.textContent = conditionSonges;
            info.classList.add(`songes-condition`);
          }
          return;
        }
        resolve({ action: `songes` });
      });
      document.getElementById(`btn-reprendre`)?.addEventListener(`click`, () =>
        resolve({
          action: `reprendre`,
          ascension: 0,
          trancheId: reprise.trancheId,
        }),
      );
      document.getElementById(`btn-abandon`)?.addEventListener(`click`, async () => {
        if (
          await demanderConfirmation(
            `Abandonner la run en cours ? Elle sera comptée comme perdue.`,
            `Abandonner`,
          )
        ) {
          resolve({
            action: `abandonner`,
            ascension: 0,
            trancheId: reprise.trancheId,
          });
        }
      });
    };
    afficher();
  });
}

// Bandeau « partie plus récente en ligne » : ce que contient chaque partie, et confirmation avant
// de remplacer l'une par l'autre.
function htmlBandeauNuage(info) {
  let ici = ``;
  try {
    ici = texteResume(resumePartieLocale());
  } catch {}
  const enLigne = info.resume ? texteResume(info.resume) : `contenu inconnu (ancien envoi)`;
  return `<span>☁️ Une partie plus récente est en ligne (envoyée depuis ${echapperHtml(info.appareil ?? `un autre appareil`)} le ${echapperHtml(dateLisible(info.date))}).
      <small class="nuage-compare"><span>Ici : <b>${echapperHtml(ici || `—`)}</b></span><span>En ligne : <b>${echapperHtml(enLigne)}</b></span></small>
      <small class="nuage-pause">Synchro auto en pause en attendant ton choix.</small></span>
    <span class="setting-actions"><button class="primaire" data-nuage="recuperer">Récupérer</button><button class="secondaire" data-nuage="garder">Garder celle d'ici</button></span>`;
}
function brancherBandeauNuage(div, info) {
  const enLigne = info.resume ? texteResume(info.resume) : `partie en ligne`;
  div.querySelector(`[data-nuage="recuperer"]`).addEventListener(`click`, async (ev) => {
    const bouton = ev.currentTarget;
    if (
      !(await demanderConfirmation(
        `Récupérer la partie en ligne (${enLigne}) ? Elle remplacera celle d'ici, qui reste récupérable dans Paramètres (« Annuler le dernier import »).`,
        `Récupérer`,
      ))
    ) {
      return;
    }
    bouton.disabled = true;
    // recupererNuage garde une copie de secours de la partie d'ici avant d'écrire
    if (await recupererNuage().catch(() => false)) {
      location.reload();
    } else {
      bouton.disabled = false;
      div.firstElementChild.textContent = `Récupération impossible : ${raisonEchecNuage() || `erreur inconnue`}. Réessaie dans un moment.`;
    }
  });
  div.querySelector(`[data-nuage="garder"]`).addEventListener(`click`, async (ev) => {
    const bouton = ev.currentTarget;
    if (
      !(await demanderConfirmation(
        `Garder la partie d'ici ? Elle sera envoyée en ligne et remplacera celle de l'autre appareil (${enLigne}).`,
        `Garder celle d'ici`,
      ))
    ) {
      return;
    }
    bouton.disabled = true;
    try {
      await envoyerNuage();
      div.remove();
    } catch {
      // le bandeau reste : le joueur peut réessayer
      bouton.disabled = false;
      afficherBandeau(
        `✗ Envoi impossible pour l'instant : ta partie n'est pas partie en ligne. Réessaie dans un moment.`,
      );
    }
  });
}
