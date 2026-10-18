import { DOFUS, SUCCES } from "../../data/index.js";
import {
  contexteMeta,
  dofusDeSucces,
  etatQuete,
  nouvelEtatQuetes,
  progressionSucces,
  trouverQuete,
} from "../../jeu/quetes.js";
import { decrireQuete, mondeDuDofus } from "../../jeu/obtention.js";
import {
  comportementDefilement,
  afficherEcran,
  brancherSectionsRepliables,
  htmlSectionRepliable,
  barreContinuer,
  barreRetour,
  cheminAsset,
  echapperHtml,
  parametres,
} from "../commun.js";
import {
  CLES_TUTO,
  normaliserVuTuto,
  sauverParametres,
  tutoVu,
} from "../../sauvegarde/parametres.js";
import { dofusAPortee } from "../prochainDofus.js";
const ECRAN_ETROIT = `(max-width: 900px)`;
function succesParDofus() {
  let parDofus = new Map();
  for (let [succesId, succes] of Object.entries(SUCCES)) {
    let dofusId = dofusDeSucces(succes);
    if (dofusId) {
      parDofus.set(dofusId, succesId);
    }
  }
  return parDofus;
}
// Succès sans Dofus, regroupés par rubrique (Général, puis les donjons de chaque monde).
function rubriques(ids) {
  const groupes = new Map();
  for (const id of ids) {
    const titre = SUCCES[id].categorie?.rubrique ?? `Général`;
    groupes.set(titre, [...(groupes.get(titre) ?? []), id]);
  }
  return [...groupes].sort(([titreA], [titreB]) =>
    titreA === `Général` ? -1 : titreB === `Général` ? 1 : titreA.localeCompare(titreB),
  );
}
// Clé de section repliable tirée d'un titre (lettres, chiffres, tirets).
const cleSection = (titre) =>
  titre
    .normalize(`NFD`)
    .replace(/[^\w]+/g, `-`)
    .slice(0, 30);
// Dofus regroupés par monde d'obtention, dans l'ordre d'affichage (« Autres » pour les autres).
function groupesDofus(ordre) {
  const groupes = new Map();
  for (const id of ordre) {
    const nom = mondeDuDofus(id)?.nom ?? `Autres`;
    groupes.set(nom, [...(groupes.get(nom) ?? []), id]);
  }
  return [...groupes];
}
// selection (facultatif) : « d:<id du Dofus> » ou « g:<id du succès> » à ouvrir directement.
export function ecranSucces(meta, selection) {
  const metaJoueur = meta;
  return new Promise((resolve) => {
    let quetes = meta.quetes ?? nouvelEtatQuetes();
    let contexte = contexteMeta(meta);
    let succesDuDofus = succesParDofus();
    let dofusIds = Object.keys(DOFUS);
    let ordreDofus = [
      ...dofusIds.filter((dofusId) => succesDuDofus.has(dofusId)),
      ...dofusIds.filter((dofusId) => !succesDuDofus.has(dofusId)),
    ];
    let succesGeneraux = Object.keys(SUCCES)
      .filter((succesId) => dofusDeSucces(SUCCES[succesId]) === undefined)
      .sort();
    let possede = (dofusId) => meta.dofus.some((dofus) => dofus.id === dofusId);
    let nbQuetes = Object.values(SUCCES).reduce((acc, item) => acc + item.quetes.length, 0);
    let succesAvecDofus = [...succesDuDofus.values()];
    let nbComplets = succesAvecDofus.filter(
      (succesId) => progressionSucces(quetes, SUCCES[succesId]).complet,
    ).length;
    // par défaut, le Dofus non obtenu le plus avancé
    let valide = (sel) =>
      typeof sel === `string` &&
      ((sel.startsWith(`d:`) && DOFUS[sel.slice(2)]) ||
        (sel.startsWith(`g:`) && SUCCES[sel.slice(2)]));
    let vise = dofusAPortee(meta)[0];
    let selectionCourante = valide(selection)
      ? selection
      : vise
        ? `d:${vise.id}`
        : ordreDofus.length
          ? `d:${ordreDofus[0]}`
          : `g:${succesGeneraux[0]}`;
    let htmlBarre = (faites, total) => {
      let pct = total ? Math.round((faites / total) * 100) : 0;
      return `<span class="succes-barre"><span class="${pct >= 100 ? `pleine` : ``}" style="width:${pct}%"></span></span>`;
    };
    let htmlCarteDofus = (dofusId) => {
      let succesId = succesDuDofus.get(dofusId);
      let progression = succesId ? progressionSucces(quetes, SUCCES[succesId]) : undefined;
      let classes = [
        `succes-carte`,
        selectionCourante === `d:${dofusId}` ? `actif` : ``,
        progression ? `` : `a-venir`,
        progression?.complet ? `complet` : ``,
      ]
        .filter(Boolean)
        .join(` `);
      let img = DOFUS[dofusId].img;
      return `<button class="${classes}" data-sel="d:${dofusId}" aria-pressed="${selectionCourante === `d:${dofusId}`}">
        <span class="succes-halo">${img ? `<img src="${cheminAsset(img)}" alt="" onerror="this.remove()" />` : ``}</span>
        <span class="succes-carte-nom">${echapperHtml(DOFUS[dofusId].nom)}</span>
        ${progression ? htmlBarre(progression.faites, progression.total) : ``}
        <span class="succes-carte-progres">${possede(dofusId) ? `✓ Obtenu` : progression ? (progression.complet ? `⏳ En attente` : `${progression.faites} / ${progression.total} quêtes`) : `Bientôt`}</span>
        ${mondeDuDofus(dofusId) ? `<span class="succes-carte-monde">${echapperHtml(mondeDuDofus(dofusId).nom)} · niv. ${DOFUS[dofusId].niveau}</span>` : ``}
      </button>`;
    };
    let htmlCarteGenerale = (succesId) => {
      let progression = progressionSucces(quetes, SUCCES[succesId]);
      return `<button class="${[
        `succes-carte-general`,
        selectionCourante === `g:${succesId}` ? `actif` : ``,
        progression.complet ? `complet` : ``,
      ]
        .filter(Boolean)
        .join(
          ` `,
        )}" data-sel="g:${succesId}" aria-pressed="${selectionCourante === `g:${succesId}`}">
        <span class="succes-general-tete"><span>${echapperHtml(SUCCES[succesId].nom)}</span><b>${progression.complet ? `✓` : `${progression.faites}/${progression.total}`}</b></span>
        ${htmlBarre(progression.faites, progression.total)}
      </button>`;
    };
    let htmlQuetes = (succes) =>
      `<ul class="quete-liste">${succes.quetes
        .map((quete) => {
          let etat = etatQuete(quetes, quete, contexte);
          let htmlCompteur = etat.compteur
            ? `<span class="quete-compteur">${etat.compteur[0]}/${etat.compteur[1]}</span>`
            : ``;
          const description = decrireQuete(quete);
          const aide = etat.faite
            ? ``
            : `<span class="quete-aide">${description.lignes.map(([etiq, texte]) => `<span class="quete-ligne-aide"><b>${echapperHtml(etiq)}</b> ${echapperHtml(texte)}</span>`).join(``)}</span>`;
          return `<li class="quete-ligne${etat.faite ? ` faite` : ``}">
        <span class="quete-coche" aria-hidden="true">${etat.faite ? `✓` : ``}</span><span class="sr-only">${etat.faite ? `Quête faite : ` : `Quête à faire : `}</span>
        <span class="quete-nom"><span class="quete-titre">${echapperHtml(description.titre)}</span>${description.lore ? `<em class="quete-lore">« ${echapperHtml(description.lore)} »</em>` : ``}${aide}</span>${htmlCompteur}
      </li>`;
        })
        .join(``)}</ul>`;
    let htmlPanneau = () => {
      if (selectionCourante.startsWith(`d:`)) {
        let dofusId = selectionCourante.slice(2);
        let dofus = DOFUS[dofusId];
        let succesId = succesDuDofus.get(dofusId);
        let succesDofus = succesId ? SUCCES[succesId] : undefined;
        let tete = `<div class="succes-panneau-tete">
          ${dofus.img ? `<img class="${succesDofus ? `` : `a-venir`}" src="${cheminAsset(dofus.img)}" alt="" onerror="this.remove()" />` : ``}
          <div><h2>${echapperHtml(dofus.nom)}</h2><p class="succes-effet">${echapperHtml(dofus.desc)}</p>
          ${mondeDuDofus(dofusId) ? `<p class="succes-niveau">Niveau ${dofus.niveau} dans Dofus · s'obtient dans le ${echapperHtml(mondeDuDofus(dofusId).nom)}${succesDofus ? ` · succès « ${echapperHtml(succesDofus.nom)} »` : ``}</p>` : ``}</div>
        </div>`;
        if (!succesDofus) {
          return `${tete}<p class="succes-a-venir">Ce Dofus n'a pas encore de groupe de quêtes.</p>`;
        }
        let progressionDofus = progressionSucces(quetes, succesDofus);
        let prerequis = ``;
        return `${tete}${possede(dofusId) ? `<span class="succes-statut obtenu">Dofus obtenu</span>` : `<span class="succes-statut">${progressionDofus.faites} / ${progressionDofus.total} quêtes pour l'obtenir</span>`}${prerequis}${htmlQuetes(succesDofus)}`;
      }
      let succes = SUCCES[selectionCourante.slice(2)];
      let progression = progressionSucces(quetes, succes);
      return `<div class="succes-panneau-tete"><div><h2>${echapperHtml(succes.nom)}</h2></div></div>
        <span class="succes-statut">${progression.faites} / ${progression.total} quêtes · ${echapperHtml(succes.recompense ?? `sans récompense`)}</span>
        ${htmlQuetes(succes)}`;
    };
    let afficher = () => {
      afficherEcran(`
        <h1>Succès</h1>
        <p class="sous-titre">${quetes.faites.filter((queteId) => trouverQuete(queteId)).length} / ${nbQuetes} quêtes · ${nbComplets} / ${succesAvecDofus.length} Dofus</p>
        <div class="succes-vue">
          <div class="succes-galerie">
            ${groupesDofus(ordreDofus)
              .map(([nom, ids]) => {
                const obtenus = ids.filter(possede).length;
                // le monde du Dofus choisi (par défaut, le plus avancé) est ouvert d'office
                const contientSelection = ids.some((id) => selectionCourante === `d:${id}`);
                return htmlSectionRepliable(
                  `succes-d-${cleSection(nom)}`,
                  `<h2 class="succes-rubrique">Dofus · ${echapperHtml(nom)} <small>${obtenus} / ${ids.length}</small></h2>`,
                  `<div class="succes-cartes">${ids.map(htmlCarteDofus).join(``)}</div>`,
                  contientSelection,
                );
              })
              .join(``)}
            ${rubriques(succesGeneraux)
              .map(([titre, ids]) => {
                const faits = ids.filter(
                  (id) => progressionSucces(quetes, SUCCES[id]).complet,
                ).length;
                // la rubrique de la sélection reste ouverte ; les donjons sont repliés d'office
                const contientSelection = ids.some((id) => selectionCourante === `g:${id}`);
                return htmlSectionRepliable(
                  `succes-${cleSection(titre)}`,
                  `<h2 class="succes-rubrique">${echapperHtml(titre)} <small>${faits} / ${ids.length}</small></h2>`,
                  `<div class="succes-generaux">${ids.map(htmlCarteGenerale).join(``)}</div>`,
                  titre === `Général` || contientSelection,
                );
              })
              .join(``)}
          </div>
          <aside class="succes-panneau"><button type="button" class="succes-vers-liste secondaire">↑ Liste</button>${htmlPanneau()}</aside>
        </div>
        ${barreRetour(`succes-retour`)}
      `);
      document.querySelectorAll(`[data-sel]`).forEach((element) =>
        element.addEventListener(`click`, () => {
          let scrollGalerie = document.querySelector(`.succes-galerie`)?.scrollTop ?? 0;
          selectionCourante = element.dataset.sel;
          afficher();
          let galerieCourante = document.querySelector(`.succes-galerie`);
          if (galerieCourante) {
            galerieCourante.scrollTop = scrollGalerie;
          }
          // Sur téléphone, le détail est sous la galerie : on l'amène à l'écran.
          if (window.matchMedia(ECRAN_ETROIT).matches) {
            document
              .querySelector(`.succes-panneau`)
              ?.scrollIntoView({ behavior: comportementDefilement(), block: `start` });
          }
        }),
      );
      // téléphone : retour à la carte active dans la liste
      document.querySelector(`.succes-vers-liste`)?.addEventListener(`click`, () => {
        const carteActive = document.querySelector(`.succes-galerie .actif`);
        carteActive?.scrollIntoView({ behavior: comportementDefilement(), block: `center` });
        carteActive?.focus({ preventScroll: true });
      });
      document.getElementById(`succes-retour`)?.addEventListener(`click`, () => resolve());
      brancherSectionsRepliables();
    };
    afficher();
    // la carte active est visible dans la galerie (PC : la galerie défile seule) ; sur téléphone,
    // un Dofus demandé depuis l'accueil ouvre directement son détail
    const galerie = document.querySelector(`.succes-galerie`);
    const carte = galerie?.querySelector(`.actif`);
    if (window.matchMedia(ECRAN_ETROIT).matches) {
      if (valide(selection)) {
        document.querySelector(`.succes-panneau`)?.scrollIntoView({ block: `start` });
      }
    } else if (galerie && carte) {
      const cadreGalerie = galerie.getBoundingClientRect();
      const cadreCarte = carte.getBoundingClientRect();
      if (cadreCarte.top < cadreGalerie.top || cadreCarte.bottom > cadreGalerie.bottom) {
        galerie.scrollTop +=
          cadreCarte.top - cadreGalerie.top - (cadreGalerie.height - cadreCarte.height) / 2;
      }
    }
  });
}
export function ecranSuccesObtenu(succes, complet, meta) {
  return new Promise((resolve) => {
    let dofusId = dofusDeSucces(succes);
    let nomDofus = dofusId && complet ? DOFUS[dofusId]?.nom : undefined;
    let texte = nomDofus
      ? `Tu obtiens le ${echapperHtml(nomDofus)}.`
      : `Toutes ses quêtes sont accomplies.`;
    afficherEcran(`
      <h1>🏆 Succès : ${echapperHtml(succes.nom)}</h1>
      ${nomDofus ? `<img class="succes-dofus-img" src="${cheminAsset(DOFUS[dofusId].img)}" alt="" onerror="this.remove()" />` : ``}
      <p class="sous-titre">${texte}</p>
      ${barreContinuer(`succes-ok`)}
    `);
    document.getElementById(`succes-ok`)?.addEventListener(`click`, () => resolve());
  });
}
// Un Dofus dont le succès était déjà terminé arrive (ancienne sauvegarde).
export function ecranDofusDebloque(id) {
  return new Promise((resolve) => {
    afficherEcran(`
      <h1>🥚 ${echapperHtml(DOFUS[id].nom)}</h1>
      <img class="succes-dofus-img" src="${cheminAsset(DOFUS[id].img)}" alt="" onerror="this.remove()" />
      <p class="sous-titre">Son succès est terminé : le ${echapperHtml(DOFUS[id].nom)} rejoint ta collection. ${echapperHtml(DOFUS[id].desc)}</p>
      ${barreContinuer(`succes-ok`)}
    `);
    document.getElementById(`succes-ok`)?.addEventListener(`click`, () => resolve());
  });
}
// Durée d'affichage d'un bandeau (ms) : doublée quand le texte dépasse 60 caractères.
export const dureeBandeau = (texte) => (String(texte ?? ``).length > 60 ? 8000 : 4000);
// Bandeau temporaire (quête accomplie, défi…) : 3 au plus à l'écran, les plus anciens partent.
// Le survol (ou le toucher maintenu) met le décompte en pause.
export function afficherBandeau(texte, classe = ``) {
  let conteneur = document.getElementById(`bandeaux-quete`);
  if (!conteneur) {
    conteneur = document.createElement(`div`);
    conteneur.id = `bandeaux-quete`;
    conteneur.setAttribute(`role`, `status`);
    document.body.appendChild(conteneur);
  }
  let bandeau = document.createElement(`div`);
  bandeau.className = classe ? `bandeau-quete ${classe}` : `bandeau-quete`;
  bandeau.textContent = texte;
  conteneur.appendChild(bandeau);
  while (conteneur.children.length > 3) {
    conteneur.firstElementChild.remove();
  }
  let reste = dureeBandeau(texte);
  let debut = 0;
  let minuteur = null;
  const lancer = () => {
    debut = Date.now();
    minuteur = setTimeout(
      () => {
        bandeau.classList.add(`sortie`);
        minuteur = setTimeout(() => bandeau.remove(), 400);
      },
      Math.max(0, reste - 400),
    );
  };
  bandeau.addEventListener(`pointerenter`, () => {
    clearTimeout(minuteur);
    reste = Math.max(1500, reste - (Date.now() - debut));
    bandeau.classList.remove(`sortie`);
  });
  bandeau.addEventListener(`pointerleave`, lancer);
  lancer();
}
// Retire les astuces encore affichées (elles masqueraient le bas d'un écran d'action).
export function retirerAstuces() {
  document.querySelectorAll(`#bandeaux-quete .astuce`).forEach((b) => b.remove());
}
// Astuce de première partie : un bandeau non bloquant, une seule fois par moment clé (`cle`).
export function afficherAstuce(cle, texte) {
  if (!parametres.vuTuto || tutoVu(parametres.vuTuto, cle)) {
    return;
  }
  parametres.vuTuto = { ...normaliserVuTuto(parametres.vuTuto), [cle]: true };
  sauverParametres(parametres);
  afficherBandeau(`💡 ${texte}`, `astuce`);
}
// « Revoir les astuces » (Paramètres) : toutes les astuces redeviennent disponibles.
export function reinitialiserAstuces() {
  parametres.vuTuto = Object.fromEntries(CLES_TUTO.map((cle) => [cle, false]));
  sauverParametres(parametres);
}
export function afficherBandeauQuete(texte) {
  afficherBandeau(`✓ Quête accomplie : ${texte}`);
}
