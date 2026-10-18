import { EMPLACEMENTS, TYPES_OBJETS } from "../jeu/emplacements.js";
import { numeroZoneObjet } from "../jeu/economie.js";
import { descriptionPanoplie } from "../jeu/panoplies.js";
import { texteObtentionDofus, texteObtentionObjet } from "../jeu/obtention.js";
import { CLASSES, DOFUS, EQUIPEMENTS } from "../data/index.js";
import { DIFFICULTES, DIFFICULTE_MAX, DOSSIER_ICONE_SORT, RARETES_INFO } from "../jeu/config.js";
import { iconeEmojiSort } from "./iconesSorts.js";
import {
  GAINS_ARCHETYPE,
  STAT_PAR_ELEMENT,
  bonusDegatsIntelligence,
  multiplicateurSoin,
  multiplicateurStat,
  statElement,
} from "../jeu/progression.js";
import {
  bonusDegatsCritiques,
  chanceCritique,
  coutPA,
  elementsUtilisables,
  meilleurElement,
  multiplicateurRelance,
  statsEffectives,
} from "../combat/stats.js";
import {
  chargerParametres,
  comportementDefilement as choisirDefilement,
  normaliserReplis,
  sauverParametres,
  sectionOuverte,
} from "../sauvegarde/parametres.js";
import { herosAmeliores } from "../jeu/inventaire.js";
import { sortAmeliore, textesAmeliorations } from "../combat/ameliorations.js";
export let racine;
export function definirRacine(element) {
  racine = element;
}
export const parametres = chargerParametres();
// Section repliable des écrans longs (<details>) dont l'état ouvert / replié est mémorisé dans les
// réglages. `ouverteParDefaut` : état tant que le joueur n'y a pas touché.
export function htmlSectionRepliable(cle, titre, contenu, ouverteParDefaut = true, classe = ``) {
  const ouverte = sectionOuverte(parametres, cle, ouverteParDefaut);
  return `<details class="section-repliable${classe ? ` ${classe}` : ``}" data-repli="${echapperHtml(cle)}" data-defaut="${ouverteParDefaut ? 1 : 0}"${ouverte ? ` open` : ``}><summary>${titre}</summary>${contenu}</details>`;
}
// À appeler après afficherEcran : chaque ouverture ou repli est enregistré.
export function brancherSectionsRepliables(conteneur = racine) {
  conteneur?.querySelectorAll(`details[data-repli]`).forEach((section) =>
    section.addEventListener(`toggle`, () => {
      const cle = section.dataset.repli;
      const inverse = section.open !== (section.dataset.defaut === `1`);
      const replis = normaliserReplis(parametres.replis);
      if (inverse) {
        replis[cle] = true;
      } else {
        delete replis[cle];
      }
      parametres.replis = replis;
      sauverParametres(parametres);
    }),
  );
}
// `auto` ou `smooth` pour scrollIntoView / scrollBy : instantané si les animations sont réduites.
export function comportementDefilement() {
  let systeme = false;
  try {
    systeme = !!window.matchMedia?.(`(prefers-reduced-motion: reduce)`).matches;
  } catch {}
  return choisirDefilement(parametres.reduireAnimations, systeme);
}
export function echapperHtml(valeur) {
  return String(valeur).replace(
    /[&<>"']/g,
    (caractere) =>
      ({
        "&": `&amp;`,
        "<": `&lt;`,
        ">": `&gt;`,
        '"': `&quot;`,
        "'": `&#39;`,
      })[caractere],
  );
}
export const elementsAMasquer = [];
export function masquerElements() {
  for (let element of elementsAMasquer) {
    element.style.display = `none`;
  }
}
function definirFond(url) {
  if (url) {
    document.body.classList.add(`avec-fond`);
    document.body.style.setProperty(`--fond-run`, `url("${url}")`);
  } else {
    document.body.classList.remove(`avec-fond`);
    document.body.style.removeProperty(`--fond-run`);
  }
}
// Dernier écran affiché (élément + classe et titre) : un nouvel écran repart en haut avec le focus
// sur son titre ; le même écran réaffiché (choix d'équipe, HDV, paramètres…) garde défilement et focus.
let dernierEcran = { el: null, cle: `` };
export function afficherEcran(html, classeEcran = ``) {
  masquerElements();
  // le combat remplace la racine sans passer par ici : l'écran d'avant n'est alors plus affiché
  const dejaAffiche = !!dernierEcran.el && racine.firstElementChild === dernierEcran.el;
  racine.innerHTML = `<div class="ecran${classeEcran ? ` ${classeEcran}` : ``}">${html}</div>`;
  const el = racine.firstElementChild;
  const titre = el?.querySelector(`h1`);
  const cle = `${classeEcran}|${titre?.textContent.trim() ?? ``}`;
  const nouveau = !dejaAffiche || cle !== dernierEcran.cle;
  dernierEcran = { el, cle };
  if (nouveau) {
    poserSentinelle();
    window.scrollTo(0, 0);
    if (titre) {
      titre.tabIndex = -1;
      titre.focus({ preventScroll: true });
    }
  }
}
// Bouton et geste « retour » du téléphone : une entrée d'historique « sentinelle » reste devant
// l'écran courant. Un retour la consomme (popstate) : on agit dans le jeu puis on la repose, au lieu
// de quitter la page.
let sentinelle = false;
function poserSentinelle() {
  if (sentinelle) {
    return;
  }
  try {
    history.pushState({ rld: true }, ``);
    sentinelle = true;
  } catch {}
}
// Que faire d'un « retour » ? Pure, pour les tests. `etat` : { confirmationOuverte, combat, retour,
// quitterLibre } (accueil et connexion laissent quitter sans confirmation).
export function actionRetour(etat) {
  if (etat.confirmationOuverte) {
    return `ignorer`;
  }
  if (etat.combat) {
    return `confirmer`;
  }
  if (etat.retour) {
    return `cliquer`;
  }
  return etat.quitterLibre ? `quitter` : `confirmer`;
}
export function installerRetourTelephone() {
  poserSentinelle();
  window.addEventListener(`popstate`, async () => {
    sentinelle = false;
    if (!racine) {
      return;
    }
    const retour = racine.querySelector(`.btn-retour:not([disabled])`);
    const combat = !!racine.querySelector(`.combat`);
    const action = actionRetour({
      confirmationOuverte: !!document.querySelector(`.confirm-fond`),
      combat,
      retour: !!retour,
      quitterLibre: !!racine.querySelector(`.ecran-accueil, .connexion`),
    });
    if (action === `quitter`) {
      return;
    }
    poserSentinelle();
    if (action === `cliquer`) {
      retour.click();
    } else if (action === `confirmer`) {
      const ok = await demanderConfirmation(
        combat
          ? `Quitter le jeu ? Le combat en cours sera perdu : la partie reprendra avant ce combat.`
          : `Quitter le jeu ? Ta partie en cours est sauvegardée.`,
        `Quitter`,
      );
      if (ok) {
        // l'entrée sentinelle puis l'entrée d'origine : on sort de la page
        history.go(-2);
      }
    }
  });
}
// Boîte de confirmation (par-dessus l'écran courant). Résout true si le joueur confirme.
export function demanderConfirmation(message, libelleOk = `Confirmer`) {
  return new Promise((resolve) => {
    const fond = document.createElement(`div`);
    fond.className = `confirm-fond`;
    fond.innerHTML = `<div class="confirm-boite" role="alertdialog" aria-modal="true" aria-labelledby="confirm-msg">
        <p id="confirm-msg">${echapperHtml(message)}</p>
        <div class="confirm-boutons">
          <button class="secondaire" data-reponse="non">Annuler</button>
          <button class="primaire danger-arme" data-reponse="oui">${echapperHtml(libelleOk)}</button>
        </div>
      </div>`;
    const fermer = (ok) => {
      document.removeEventListener(`keydown`, clavier, true);
      fond.remove();
      resolve(ok);
    };
    const clavier = (evenement) => {
      if (evenement.key === `Escape`) {
        evenement.preventDefault();
        evenement.stopPropagation();
        fermer(false);
      }
    };
    fond.addEventListener(`click`, (evenement) => {
      const reponse = evenement.target.closest?.(`[data-reponse]`)?.dataset.reponse;
      if (reponse) {
        fermer(reponse === `oui`);
      } else if (evenement.target === fond) {
        fermer(false);
      }
    });
    document.addEventListener(`keydown`, clavier, true);
    document.body.appendChild(fond);
    fond.querySelector(`[data-reponse="non"]`)?.focus();
  });
}
// Entrée valide l'action principale de l'écran (continuer, jouer, reprendre) quand le focus n'est
// pas déjà sur un bouton ; 1 à 4 choisissent une option d'une rencontre. Pas Espace : c'est la touche
// de fin de tour par défaut.
const ACTIONS_PRINCIPALES = [
  `.ecran .boutons-ecran .btn-continuer:not([disabled])`,
  `#choix-go:not([disabled])`,
  `#btn-reprendre`,
  `#btn-start`,
];
function champDeSaisie(el) {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    !!el?.isContentEditable
  );
}
function installerToucheEntree() {
  document.addEventListener(`keydown`, (evenement) => {
    if (
      evenement.defaultPrevented ||
      evenement.repeat ||
      evenement.ctrlKey ||
      evenement.metaKey ||
      evenement.altKey
    ) {
      return;
    }
    const actif = document.activeElement;
    if (
      champDeSaisie(actif) ||
      document.querySelector(`.confirm-fond`) ||
      !racine ||
      racine.querySelector(`.combat`)
    ) {
      return;
    }
    if (evenement.key === `Enter`) {
      // un bouton, un lien ou une carte focalisés réagissent déjà à Entrée
      if (actif?.closest?.(`button, [role="button"], a[href], summary`)) {
        return;
      }
      for (const sel of ACTIONS_PRINCIPALES) {
        const bouton = racine.querySelector(sel);
        if (bouton && !bouton.disabled) {
          evenement.preventDefault();
          bouton.click();
          return;
        }
      }
      return;
    }
    const chiffre = /^(?:Digit|Numpad)([1-4])$/.exec(evenement.code)?.[1];
    if (chiffre) {
      const option = racine.querySelectorAll(`.ecran [data-choix]`)[Number(chiffre) - 1];
      if (option && !option.disabled) {
        evenement.preventDefault();
        option.click();
      }
    }
  });
}
export function installerToucheEchap() {
  installerToucheEntree();
  document.addEventListener(`keydown`, (evenement) => {
    if (evenement.key !== `Escape` || evenement.defaultPrevented) {
      return;
    }
    if (champDeSaisie(document.activeElement)) {
      return;
    }
    let retour = racine?.querySelector(`.ecran .boutons-ecran .btn-retour`);
    if (!(!retour || retour.disabled)) {
      evenement.preventDefault();
      retour.click();
    }
  });
}
export const cheminAsset = (chemin) => `/` + chemin.replace(/^\/+/, ``);
// sorts avancés (sans image) : leur emoji sur une pastille (src/ui/iconesSorts.js)
export const iconeSort = (sortId) =>
  iconeEmojiSort(sortId) ??
  cheminAsset(`/assets/spells/${DOSSIER_ICONE_SORT[sortId] ?? `monstres`}/${sortId}.png`);
export const IMG_ETOILE = cheminAsset(`/assets/divers/etoile.png`);
export const IMG_COEUR = cheminAsset(`/assets/divers/coeur_base.png`);
export const IMG_LOGO = cheminAsset(`/assets/divers/Roguefus_lite.png`);
export const IMG_JOUER = cheminAsset(`/assets/menu/Jouer.png`);
export const IMG_ABANDONNER = cheminAsset(`/assets/menu/abandonner.png`);
const IMG_RETOUR = cheminAsset(`/assets/menu/retour.png`);
const IMG_CONTINUER = cheminAsset(`/assets/menu/continuer.png`);
export const IMG_CARACTERISTIQUES = cheminAsset(`/assets/menu/Caracteristiques.png`);
export const IMG_FORMATION = cheminAsset(`/assets/menu/Formation.png`);
export const IMG_INVENTAIRE = cheminAsset(`/assets/menu/Inventaire.png`);
export const IMG_BESTIAIRE = cheminAsset(`/assets/menu/bestiaires.png`);
export const IMG_ARMURERIE = cheminAsset(`/assets/menu/armurerie.png`);
export const IMG_PARAMETRES = cheminAsset(`/assets/menu/parametres.png`);
export const IMG_SUCCES = cheminAsset(`/assets/menu/succes.png`);
export const IMG_ENCYCLOPEDIE = cheminAsset(`/assets/menu/encyclopedie.png`);
export const IMG_MENU = cheminAsset(`/assets/menu/Menu.png`);
export const IMG_RECOMMENCER = cheminAsset(`/assets/menu/Recommencer.png`);
export const IMG_DEPART = cheminAsset(`/assets/menu/Depart.png`);
export const IMG_RECOMMENCER_AVEC_PERSO = cheminAsset(`/assets/menu/Recommencer_avec_perso.png`);
export const imgMonde = (monde) => cheminAsset(`/assets/menu/Monde_${monde}.png`);
export const IMG_DOFUS = cheminAsset(`/assets/menu/dofus.png`);
const IMG_KAMAS = cheminAsset(`/assets/divers/kamas.png`);
export const imgElement = (element) => cheminAsset(`/assets/elements/${element}.png`);
const imgArchetype = (archetype) =>
  cheminAsset(`/assets/elements/${archetype === `melee` ? `dmgMelee` : `dmgDistance`}.png`);
const FONDS_MONDE = {
  t1: cheminAsset(`/assets/fonds/incarnam.png`),
};
const FOND_ACCUEIL = cheminAsset(`/assets/fonds/accueil.png`);
export const IMG_CRITIQUE = cheminAsset(`/assets/elements/critique.png`);
export const IMG_DMG_CRITIQUE = cheminAsset(`/assets/elements/dmgCritique.png`);
export const IMG_SOIN = cheminAsset(`/assets/elements/soin.png`);
export const IMG_PUISSANCE = cheminAsset(`/assets/elements/puissance.png`);
export const IMG_PP = cheminAsset(`/assets/elements/pp.png`);
export const IMGS_RESISTANCE = {
  terre: cheminAsset(`/assets/elements/resTerre.png`),
  feu: cheminAsset(`/assets/elements/resFeu.png`),
  eau: cheminAsset(`/assets/elements/resEau.png`),
  air: cheminAsset(`/assets/elements/resAir.png`),
};
export const imgClasse = (classeId) =>
  cheminAsset(CLASSES[classeId]?.img ?? `/assets/classes/${classeId}.png`);
export const imgObjet = (objetId) => cheminAsset(`/assets/items/${objetId}.png`);
export function boutonRetour(id, libelle = `Retour`) {
  return `<button id="${id}" class="btn-retour" title="${echapperHtml(libelle)}"><img src="${IMG_RETOUR}" alt="Retour" onerror="this.remove()" /></button>`;
}
// Réaffiche un écran en gardant la position des listes et de la page (HDV, forgemagie…).
export function afficherEnGardantScroll(html) {
  const listes = [...racine.querySelectorAll(`.equip-inv`)].map((liste) => liste.scrollTop);
  const defilement = scrollY;
  afficherEcran(html);
  racine.querySelectorAll(`.equip-inv`).forEach((liste, indice) => {
    liste.scrollTop = listes[indice] ?? 0;
  });
  window.scrollTo(0, defilement);
}
// Photo de l'équipement (inventaire, objets portés, PV) avant une opération en lot comme
// « Équiper le meilleur » : elle permet de tout remettre comme avant (bouton Annuler).
export function photoEquipement(run) {
  return {
    inventaire: run.inventaire.slice(),
    persos: run.persos.map((perso) => ({
      perso,
      equipement: { ...perso.equipement },
      pv: perso.pvActuels,
    })),
  };
}
// Remet l'équipement tel qu'il était sur la photo (l'inventaire est modifié en place).
export function restaurerEquipement(run, photo) {
  run.inventaire.length = 0;
  run.inventaire.push(...photo.inventaire);
  for (const { perso, equipement, pv } of photo.persos) {
    for (const emplacement of Object.keys(perso.equipement)) {
      delete perso.equipement[emplacement];
    }
    Object.assign(perso.equipement, equipement);
    perso.pvActuels = pv;
  }
}
export function barreRetour(id, libelle = `Retour`) {
  return `<div class="boutons-ecran">${boutonRetour(id, libelle)}</div>`;
}
export function boutonContinuer(id) {
  const kbd = ecranTactile() ? `` : `<kbd class="kbd-entree" aria-hidden="true">Entrée</kbd>`;
  return `<button id="${id}" class="btn-continuer" title="Continuer"><img src="${IMG_CONTINUER}" alt="Continuer" onerror="this.remove()" />${kbd}</button>`;
}
export function barreContinuer(id) {
  return `<div class="boutons-ecran">${boutonContinuer(id)}</div>`;
}
export function etoilesDifficulte(cran) {
  let nbEtoiles = Math.max(0, Math.min(Math.trunc(cran) || 0, DIFFICULTE_MAX)) + 1;
  return `★`.repeat(nbEtoiles) + `☆`.repeat(DIFFICULTES.length - nbEtoiles);
}
export function fondDuMonde(mondeId) {
  definirFond((mondeId ? FONDS_MONDE[mondeId] : null) ?? FOND_ACCUEIL);
}
// Élément frappé par un sort de dégâts (null pour un soin, un buff, une invocation…).
export const sortDeDegats = (sort) =>
  (sort?.type === `degats` || sort?.type === `mixte`) && sort.baseMax > 0;
export function elementDuSort(sort, lanceur) {
  if (!sortDeDegats(sort)) {
    return null;
  }
  if (sort.element) {
    return sort.element;
  }
  return lanceur ? meilleurElement(lanceur) : null;
}
// Attributs d'icône : teinte de l'élément (une ou deux couleurs) + pastille.
export function attrElementSort(sort, lanceur, elementsClasse) {
  const el = elementDuSort(sort, lanceur);
  if (el) {
    return ` data-el="${el}" title="Frappe en ${NOMS_ELEMENTS[el]}"`;
  }
  if (sortDeDegats(sort) && elementsClasse?.length) {
    return ` data-el="${elementsClasse[0]}" data-el2="${elementsClasse[1] ?? elementsClasse[0]}"`;
  }
  return ``;
}
export function pastilleElementSort(sort, lanceur) {
  const el = elementDuSort(sort, lanceur);
  return el
    ? `<img class="sort-el" src="${imgElement(el)}" alt="${NOMS_ELEMENTS[el]}" onerror="this.remove()" />`
    : ``;
}
function texteElement(sort, lanceur) {
  if (sort.element) {
    return `toujours en <b>${NOMS_ELEMENTS[sort.element]}</b>`;
  }
  const els = elementsUtilisables(lanceur);
  const meilleur = meilleurElement(lanceur);
  const autres = els
    .filter((element) => element !== meilleur)
    .map((element) => NOMS_ELEMENTS[element]);
  if (sort.elementPire) {
    return `dans l'élément le <b>moins</b> efficace contre la cible`;
  }
  return `en <b>${NOMS_ELEMENTS[meilleur]}</b>${autres.length ? ` (ou ${autres.join(` / `)} si la cible y résiste moins)` : ``}`;
}
export function infobulleSort(sort, lanceur) {
  // améliorations de sort de la run : valeurs, coût et cibles de la copie améliorée
  const ameliorations = textesAmeliorations(lanceur, sort);
  sort = sortAmeliore(lanceur, sort);
  let valeurHtml = ``;
  if (lanceur) {
    let stats = statsEffectives(lanceur);
    if (sort.type === `soin`) {
      if (sort.soinComplet) {
        valeurHtml = `<span class="tip-val soin">♥ Soin complet</span>`;
      } else if (sort.baseMax > 0) {
        let mult = multiplicateurSoin(stats, statElement(stats, meilleurElement(lanceur)));
        valeurHtml = `<span class="tip-val soin">♥ ${Math.round(sort.baseMin * mult)} – ${Math.round(sort.baseMax * mult)}</span><span class="tip-unite">PV rendus</span>`;
      }
    } else if (sort.type === `degats` && sort.baseMax > 0) {
      let mult =
        multiplicateurStat(statElement(stats, meilleurElement(lanceur))) *
        bonusDegatsIntelligence(stats) *
        multiplicateurRelance(sort, lanceur);
      valeurHtml = `<span class="tip-val dgt">⚔ ${Math.round(sort.baseMin * mult)} – ${Math.round(sort.baseMax * mult)}</span><span class="tip-el">${texteElement(sort, lanceur)}</span>`;
    }
  } else {
    if (sort.baseMax > 0) {
      valeurHtml =
        sort.type === `soin`
          ? `<span class="tip-val soin">♥ ${sort.baseMin} – ${sort.baseMax}</span><span class="tip-unite">PV rendus (base)</span>`
          : `<span class="tip-val dgt">⚔ ${sort.baseMin} – ${sort.baseMax}</span><span class="tip-unite">base · élément selon la cible</span>`;
    }
  }
  let details = [];
  if (sort.cooldownTours) {
    details.push(`⏳ recharge ${sort.cooldownTours} tour${sort.cooldownTours > 1 ? `s` : ``}`);
  }
  if (sort.cooldown) {
    details.push(`⏳ recharge ${sort.cooldown} tour${sort.cooldown > 1 ? `s` : ``} par cible`);
  }
  if (sort.maxParTour) {
    details.push(`${sort.maxParTour}×/tour`);
  }
  if (sort.maxParCibleParTour) {
    details.push(`${sort.maxParCibleParTour}×/cible/tour`);
  }
  let recharge = lanceur?.cooldowns[sort.id] ?? 0;
  if (recharge > 0) {
    details.push(`<b class="tip-cd-actif">en recharge (${recharge}t)</b>`);
  }
  return [
    `<div class="tip-nom">${echapperHtml(sort.nom)}<span class="tip-pa">${lanceur ? coutPA(sort, lanceur) : sort.coutPA} PA</span></div>`,
    valeurHtml ? `<div class="tip-stat">${valeurHtml}</div>` : ``,
    sort.desc ? `<div class="tip-effet">${echapperHtml(sort.desc)}</div>` : ``,
    ...ameliorations.map((texte) => `<div class="tip-amelio">⬆ ${echapperHtml(texte)}</div>`),
    `<div class="tip-cible">🎯 ${LIBELLES_CIBLE[sort.cible] ?? sort.cible}${details.length ? ` · ${details.join(` · `)}` : ``}</div>`,
  ]
    .filter(Boolean)
    .join(``);
}
// Écran tactile : pas de survol, les infobulles s'ouvrent au toucher.
export const ecranTactile = () => window.matchMedia?.(`(hover: none)`).matches ?? false;
// Règle des infobulles : data-tip (ou les data-* des Dofus) pour toute vraie information, car elle
// s'ouvre au survol, au toucher et au focus clavier ; title seulement pour un libellé redondant.
function creerBulle(classe, id) {
  const bulle = document.createElement(`div`);
  bulle.className = classe;
  bulle.id = id;
  bulle.setAttribute(`role`, `tooltip`);
  bulle.style.display = `none`;
  document.body.appendChild(bulle);
  elementsAMasquer.push(bulle);
  let cible = null;
  const placer = (el) => {
    if (cible && cible !== el) {
      cible.removeAttribute(`aria-describedby`);
    }
    cible = el;
    el.setAttribute(`aria-describedby`, id);
    bulle.style.display = `block`;
    const cadre = el.getBoundingClientRect();
    const cadreBulle = bulle.getBoundingClientRect();
    let gauche = cadre.left + cadre.width / 2 - cadreBulle.width / 2;
    gauche = Math.max(8, Math.min(gauche, window.innerWidth - cadreBulle.width - 8));
    let haut = cadre.top - cadreBulle.height - 10;
    if (haut < 8) {
      haut = cadre.bottom + 10;
    }
    bulle.style.left = `${gauche}px`;
    bulle.style.top = `${haut}px`;
  };
  const masquer = () => {
    bulle.style.display = `none`;
    cible?.removeAttribute(`aria-describedby`);
    cible = null;
  };
  return { bulle, placer, masquer };
}
// Dernier pointeur utilisé (souris, toucher, stylet) : après un appui au doigt, le navigateur
// émule un survol puis un `mouseout` juste après le `click`, qui refermait aussitôt la bulle.
let dernierPointeur = ``;
const retenirPointeur = (ev) => {
  dernierPointeur = ev.pointerType || dernierPointeur;
};
const auToucher = () => dernierPointeur === `touch` || dernierPointeur === `pen`;
let pointeurSuivi = false;
function suivrePointeur() {
  if (pointeurSuivi) {
    return;
  }
  pointeurSuivi = true;
  document.addEventListener(`pointerdown`, retenirPointeur, { capture: true, passive: true });
  document.addEventListener(`pointermove`, retenirPointeur, { capture: true, passive: true });
}
// Survol (souris seulement : le survol simulé d'un toucher laissait des bulles collées), focus
// clavier et toucher ; Échap et le défilement referment la bulle. Ouverte au toucher, elle reste
// jusqu'au prochain appui ailleurs.
function brancherBulle(selecteur, montrer, masquer) {
  suivrePointeur();
  document.addEventListener(`mouseover`, (ev) => {
    if (ecranTactile() || auToucher()) {
      return;
    }
    const el = ev.target.closest?.(selecteur);
    if (el) {
      montrer(el);
    }
  });
  document.addEventListener(`mouseout`, (ev) => {
    // survol émulé par un toucher : la bulle attend le prochain appui
    if (auToucher()) {
      return;
    }
    const el = ev.target.closest?.(selecteur);
    if (el && !el.contains(ev.relatedTarget)) {
      masquer();
    }
  });
  document.addEventListener(`focusin`, (ev) => {
    const el = ev.target.closest?.(selecteur);
    if (el) {
      montrer(el);
    }
  });
  document.addEventListener(`focusout`, (ev) => {
    if (ev.target.closest?.(selecteur)) {
      masquer();
    }
  });
  document.addEventListener(`keydown`, (ev) => {
    if (ev.key === `Escape`) {
      masquer();
    }
  });
  window.addEventListener(`scroll`, masquer, { capture: true, passive: true });
  ouvrirAuToucher(selecteur, montrer, masquer);
}
function ouvrirAuToucher(selecteur, montrer, masquer) {
  document.addEventListener(
    `click`,
    (ev) => {
      if (!ecranTactile() && !auToucher()) {
        return;
      }
      // en visée, un appui sur une carte ciblable lance le sort : pas de bulle par-dessus
      if (ev.target.closest?.(`.combat.ciblage .carte.ciblable`)) {
        masquer();
        return;
      }
      const cible = ev.target.closest?.(selecteur);
      // Un bouton agit déjà au toucher : on n'ouvre pas sa bulle par-dessus.
      if (cible && !cible.matches(`button:not(.dofus-slot)`)) {
        montrer(cible);
      } else {
        masquer();
      }
    },
    true,
  );
}
export function installerInfobulleDofus() {
  const { bulle, placer, masquer } = creerBulle(`dofus-tip`, `dofus-tip`);
  const montrer = (element) => {
    const etat = element.dataset.possede
      ? `<div class="tip-muet">✓ Obtenu</div>`
      : `<div class="tip-muet">🔒 ${echapperHtml(element.dataset.obtention ?? ``)}</div>`;
    bulle.innerHTML =
      `<div class="tip-nom">${echapperHtml(element.dataset.nom ?? ``)}</div><div class="tip-effet">${echapperHtml(element.dataset.effet ?? ``)}</div>` +
      etat;
    placer(element);
  };
  brancherBulle(`.dofus-slot`, montrer, masquer);
}
const LIBELLES_CIBLE = {
  ennemi_ligne: `Ennemi (ligne avant)`,
  ennemi_tous: `N'importe quel ennemi`,
  allie: `Un allié`,
  allie_tous: `Toute l'équipe`,
  soi: `Soi-même`,
  invocation: `Invocation`,
  mixte: `Allié ou ennemi`,
};
export function installerInfobulleAide() {
  const { bulle, placer, masquer } = creerBulle(`aide-tip`, `aide-tip`);
  const montrer = (element) => {
    const tip = element.dataset.tip;
    if (!tip) {
      return;
    }
    bulle.textContent = tip;
    placer(element);
  };
  brancherBulle(`[data-tip]`, montrer, masquer);
}
export const NOMS_ELEMENTS = {
  terre: `Terre`,
  feu: `Feu`,
  eau: `Eau`,
  air: `Air`,
};
export const htmlKamas = (nombre) =>
  `<span class="kamas"><img src="${IMG_KAMAS}" alt="k" onerror="this.remove()" />${nombre.toLocaleString(`fr-FR`)}</span>`;
function elementsDuPerso(perso) {
  return CLASSES[perso.classeId].elements;
}
export function pastillesElementsPerso(perso) {
  return `<span class="el-pastilles">${(Object.values(perso.equipement).some(
    (objet) => objet && EQUIPEMENTS[objet.id]?.elementLibre,
  )
    ? [`terre`, `feu`, `eau`, `air`]
    : elementsDuPerso(perso)
  )
    .map(
      (element) =>
        `<img class="el-pastille" src="${imgElement(element)}" alt="" title="Élément : ${NOMS_ELEMENTS[element]}" onerror="this.remove()" />`,
    )
    .join(``)}</span>`;
}
export const NOMS_ARCHETYPES = {
  melee: `Mêlée`,
  distance: `Distance`,
};
export function htmlElementsClasse(classeId, options = {}) {
  let classe = CLASSES[classeId];
  let gains = GAINS_ARCHETYPE[classe.archetype];
  let texteArchetype = `${NOMS_ARCHETYPES[classe.archetype]} : +${gains.parElement} dans chacun de ses 2 éléments et +${gains.vitalite} en Vitalité par niveau`;
  return `<span class="classe-elems">
    ${options.icone && !ecranTactile() ? `<img class="archetype-icone" src="${imgArchetype(classe.archetype)}" alt="${NOMS_ARCHETYPES[classe.archetype]}" data-tip="${echapperHtml(texteArchetype)}" onerror="const s=document.createElement('span');s.className='classe-archetype';s.textContent=this.alt;s.dataset.tip=this.dataset.tip;this.replaceWith(s)" />` : `<span class="classe-archetype" data-tip="${echapperHtml(texteArchetype)}">${NOMS_ARCHETYPES[classe.archetype]}</span>`}
    <span class="el-pastilles">${classe.elements.map((element) => `<img class="el-pastille" src="${imgElement(element)}" alt="" title="Élément de la classe : ${NOMS_ELEMENTS[element]}" onerror="this.remove()" />`).join(``)}</span>
  </span>`;
}
export const imgSymboleClasse = (classeId) => cheminAsset(`/assets/class_symbol/${classeId}.png`);
export const pctCritique = (stats) => Math.round(chanceCritique(stats) * 100);
export const pctDegatsCritiques = (stats) => Math.round(bonusDegatsCritiques(stats) * 100);
export const pctSoin = (stats, pointsElement) =>
  Math.round((multiplicateurSoin(stats, pointsElement) - 1) * 100);
export const pctPuissanceIntel = (stats) => Math.round((bonusDegatsIntelligence(stats) - 1) * 100);
export function htmlRackDofus(meta, compact = false) {
  let html = Object.values(DOFUS)
    .map((dofus) => {
      let nbExemplaires = meta.dofus.filter((exemplaire) => exemplaire.id === dofus.id).length;
      let possede = nbExemplaires > 0;
      let attrOcre = dofus.id === `dofus_ocre` ? `data-ocre="1"` : ``;
      return `
        <div class="dofus-slot ${possede ? `` : `locked`}" data-nom="${echapperHtml(dofus.nom)}" data-effet="${echapperHtml(dofus.desc)}" data-obtention="${echapperHtml(texteObtentionDofus(dofus.id))}" data-possede="${possede ? 1 : ``}" ${attrOcre}>
          ${dofus.img ? `<img src="${cheminAsset(dofus.img)}" alt="${echapperHtml(dofus.nom)}" loading="lazy" decoding="async" onerror="this.remove()" />` : ``}
          ${nbExemplaires > 1 ? `<span class="dofus-count">×${nbExemplaires}</span>` : ``}
        </div>`;
    })
    .join(``);
  return `<div class="dofus-rack ${compact ? `compact` : ``}">${html}</div>`;
}
export const ROLES_CLASSES = {
  iop: `Bourrin, frappe de plus en plus fort à mesure qu'il enchaîne`,
  cra: `Archère, ouvre sa ligne de vue et ferme celle d'en face`,
  eniripsa: `Soigneuse, remet debout, protège et redonne des PA`,
  sadida: `Infecteur, sa contagion se propage et sa poupée encaisse`,
  osamodas: `Dompteur, ses créatures se battent à ses côtés`,
  enutrof: `Prospecteur, plus fort à chaque tour et plus riche à chaque combat`,
  sacrieur: `Berserker, plus il saigne plus il frappe, et il se sacrifie pour les autres`,
  pandawa: `Bagarreur, sobre il protège, saoul il cogne`,
  zobal: `Masqué, change de masque pour tenir, frapper ou esquiver`,
  steamer: `Ingénieur, ses tourelles tirent et soignent à sa place`,
  huppermage: `Élémentaliste, combine le Feu et l'Eau pour faire exploser ses cibles`,
  sram: `Assassin, sème des pièges et frappe quand ils ont mordu`,
  feca: `Protecteur, durcit sa rangée et prend les coups à la place des autres`,
  ecaflip: `Flambeur, tout son kit s'emballe au coup critique`,
  ouginak: `Chasseur, s'acharne sur sa Proie et monte en Rage`,
  roublard: `Artificier, colle des bombes et les fait toutes sauter d'un coup`,
  xelor: `Horloger, vole des PA et empile les Téléfrags pour un gros coup`,
  eliotrope: `Portailleur, ses portails dopent toute sa rangée`,
  forgelance: `Lancier, plante sa lance et balaye tout autour d'elle`,
};
export function htmlCarteClasse(classeId, selectionnee, attribut) {
  let classe = CLASSES[classeId];
  return `<button class="classe-carte ${selectionnee ? `sel` : ``}" ${attribut}="${classeId}">
    <img class="classe-portrait" src="${imgClasse(classeId)}" alt="" loading="lazy" decoding="async" onerror="this.remove()" />
    <span class="classe-nom">${echapperHtml(classe.nom)}</span>
    ${htmlElementsClasse(classeId)}
    <span class="classe-role">${echapperHtml(ROLES_CLASSES[classeId] ?? ``)}</span>
  </button>`;
}
// Types d'objets (filtres, tri) et emplacements d'un héros (deux anneaux).
export const SLOTS = TYPES_OBJETS;
export { EMPLACEMENTS };
export const NOMS_SLOTS = {
  arme: `Arme`,
  coiffe: `Coiffe`,
  cape: `Cape`,
  amulette: `Amulette`,
  anneau: `Anneau`,
  ceinture: `Ceinture`,
  bottes: `Bottes`,
};
export const NOMS_EMPLACEMENTS = { ...NOMS_SLOTS, anneau: `Anneau 1`, anneau2: `Anneau 2` };
// Noms complets des caractéristiques d'objets, et ce qu'elles font.
const ABREV_STATS = {
  vitalite: `Vitalité`,
  force: `Force`,
  intelligence: `Intelligence`,
  agilite: `Agilité`,
  chance: `Chance`,
  soin: `Soin`,
  prospection: `Prospection`,
  crit: `% Critique`,
};
const ROLE_STATS = {
  vitalite: `+1 PV max par point`,
  force: `dégâts Terre +3 % par point`,
  intelligence: `dégâts Feu +3 % par point, et tous les dégâts +0,1 % par point`,
  agilite: `dégâts Air +3 % par point, critique et esquive`,
  chance: `dégâts Eau +3 % par point`,
  soin: `soins donnés +0,5 % par point`,
  prospection: `plus de chances de butin`,
  crit: `chance de coup critique en plus`,
};
export const classeRarete = (objet) => {
  if (objet?.rarete) {
    return ` rarete-${objet.rarete}`;
  }
  return ``;
};
// infobulle « où trouver cet objet » (à mettre sur la carte d'un objet)
export const attrTipObjet = (id) => ` data-tip="${echapperHtml(texteObtentionObjet(id))}"`;
// « T13 · Arme · Épique » : le Tier (zone d'obtention) d'abord, bien visible.
export function htmlMetaObjet(inst) {
  const def = EQUIPEMENTS[inst.id];
  return `<b class="ic-tier" data-tip="Tier : numéro de la zone où l'objet tombe, compté depuis le Monde 1. Plus il est haut, plus l'objet est puissant.">T${numeroZoneObjet(inst.id)}</b> · ${NOMS_SLOTS[def.slot]}${inst.rarete ? ` · <span class="inom-${inst.rarete}">${RARETES_INFO[inst.rarete].nom}</span>` : ``}`;
}
export function htmlNomObjet(objet) {
  let def = EQUIPEMENTS[objet.id];
  let nom = echapperHtml(def?.nom ?? objet.id);
  if (objet.rarete) {
    return `<span class="inom-${objet.rarete}" title="${RARETES_INFO[objet.rarete].nom}">${nom}</span>`;
  }
  return nom;
}
// classeId (facultatif) : la classe du porteur, pour dire où va la stat adaptative.
export function htmlChipsObjet(objet, classeId) {
  let def = EQUIPEMENTS[objet.id];
  let pastilles = [];
  let ajouter = (classes, texte, titre) =>
    pastilles.push(
      `<span class="ichip ${classes}"${titre ? ` data-tip="${echapperHtml(titre)}"` : ``}>${texte}</span>`,
    );
  let signe = (nombre) => {
    if (nombre > 0) {
      return `+${nombre}`;
    }
    return `${nombre}`;
  };
  if (objet.adaptatif) {
    let elements = CLASSES[classeId]?.elements;
    if (elements) {
      for (let el of elements) {
        let stat = STAT_PAR_ELEMENT[el];
        pastilles.push(
          `<span class="ichip ichip-${stat}${objet.adaptatif < 0 ? ` malus` : ``}" data-tip="Stat adaptative : s'applique aux 2 caractéristiques d'élément de ta classe">${signe(objet.adaptatif)} ${ABREV_STATS[stat]} ★</span>`,
        );
      }
    } else {
      pastilles.push(
        `<span class="ichip ichip-adapt${objet.adaptatif < 0 ? ` malus` : ``}" data-tip="Stat adaptative : s'applique aux 2 caractéristiques d'élément du porteur (ex. Force et Chance pour un Feca)">${signe(objet.adaptatif)} aux 2 caracs d'élément ★</span>`,
      );
    }
  }
  if (def?.pvBonus) {
    ajouter(`ichip-vitalite`, `+${def.pvBonus} PV`);
  }
  for (let stat of Object.keys(objet.stats)) {
    let valeur = objet.stats[stat];
    if (valeur) {
      ajouter(
        `ichip-${stat}${valeur < 0 ? ` malus` : ``}`,
        `${signe(valeur)} ${ABREV_STATS[stat] ?? stat}`,
        ROLE_STATS[stat] && `${ABREV_STATS[stat]} : ${ROLE_STATS[stat]}`,
      );
    }
  }
  if (objet.pa) {
    ajouter(`ichip-pa`, `+${objet.pa} PA`);
  }
  let resistances = {
    ...(def?.resistances ?? {}),
    ...(objet.resistances ?? {}),
  };
  for (let element of Object.keys(resistances)) {
    let valeur = resistances[element];
    if (valeur) {
      ajouter(
        `ichip-res elem-${element}${valeur < 0 ? ` malus` : ``}`,
        `${signe(Math.round(valeur * 100))}% ${NOMS_ELEMENTS[element]}`,
      );
    }
  }
  let attaque = objet.rarete ? def?.tiers?.[objet.rarete]?.attaque : undefined;
  if (attaque) {
    ajouter(
      `ichip-arme`,
      `⚔ Attaque d'arme : ${attaque.baseMin}–${attaque.baseMax} dégâts, ${attaque.coutPA} PA${attaque.cible === `ennemi_tous` ? ` · atteint la ligne arrière` : ``}${attaque.vampirisme ? ` · rend ${Math.round(attaque.vampirisme * 100)} % en PV` : ``}`,
    );
  }
  if (def?.paGamble) {
    pastilles.push(
      `<span class="ichip ichip-pa" data-tip="À chaque tour : ${Math.round(def.paGamble.pPlus * 100)} % de gagner +${def.paGamble.plus} PA, sinon −${def.paGamble.moins} PA">🎲 ${Math.round(def.paGamble.pPlus * 100)} % +${def.paGamble.plus} PA / −${def.paGamble.moins}</span>`,
    );
  }
  if (def?.ligneAvant) {
    pastilles.push(
      `<span class="ichip malus" data-tip="Équipable uniquement sur un personnage de la ligne avant">Ligne avant uniqt</span>`,
    );
  }
  if (def?.riposteAvant) {
    pastilles.push(
      `<span class="ichip ichip-force" data-tip="Quand le porteur est frappé en ligne avant : ${Math.round(def.riposteAvant * 100)} % de chance de contre-attaquer">↩ ${Math.round(def.riposteAvant * 100)} % riposte (avant)</span>`,
    );
  }
  if (def?.esquiveArriere) {
    pastilles.push(
      `<span class="ichip ichip-agilite" data-tip="Quand le porteur est en ligne arrière : +${Math.round(def.esquiveArriere * 100)} % d'esquive">💨 +${Math.round(def.esquiveArriere * 100)} % esquive (arrière)</span>`,
    );
  }
  if (def?.soinDegatsRecus) {
    pastilles.push(
      `<span class="ichip ichip-soin" data-tip="À chaque coup encaissé, le porteur récupère ${Math.round(def.soinDegatsRecus * 100)} % des dégâts subis">♥ récup. ${Math.round(def.soinDegatsRecus * 100)} % des dégâts subis</span>`,
    );
  }
  if (def?.changeLigne) {
    pastilles.push(
      `<span class="ichip ichip-pa" data-tip="Confère le sort « Changer de ligne » : bascule avant ↔ arrière en combat pour ${def.changeLigne} PA">↕ change de ligne (${def.changeLigne} PA)</span>`,
    );
  }
  if (def?.perceResistances) {
    pastilles.push(
      `<span class="ichip ichip-force" data-tip="L'attaque de cette arme ignore ${Math.round(def.perceResistances * 100)} % des résistances de la cible">⚡ perce ${Math.round(def.perceResistances * 100)} % des rés.</span>`,
    );
  }
  if (def?.frappeDerriere) {
    pastilles.push(
      `<span class="ichip ichip-force" data-tip="L'attaque touche aussi l'ennemi juste derrière la cible">⤈ frappe aussi derrière</span>`,
    );
  }
  if (def?.prospParPvManquant) {
    pastilles.push(
      `<span class="ichip ichip-prospection" data-tip="Au moment du butin : +${def.prospParPvManquant} prospection par PV manquant du porteur">📦 +${def.prospParPvManquant} PP / PV manquant</span>`,
    );
  }
  if (def?.multKamas) {
    pastilles.push(
      `<span class="ichip ichip-adapt" data-tip="Les kamas gagnés en combat sont multipliés par ${def.multKamas}">🪙 kamas ×${def.multKamas}</span>`,
    );
  }
  if (def?.bouclierDebut) {
    pastilles.push(
      `<span class="ichip ichip-vitalite" data-tip="Commence chaque combat avec un bouclier de ${Math.round(def.bouclierDebut * 100)} % des PV max">🛡 bouclier de départ ${Math.round(def.bouclierDebut * 100)} %</span>`,
    );
  }
  if (def?.poisonArme) {
    pastilles.push(
      `<span class="ichip malus" data-tip="L'attaque de cette arme empoisonne la cible (${def.poisonArme.degats} dégâts pendant ${def.poisonArme.duree} tours)">☠ empoisonne (${def.poisonArme.degats}/t · ${def.poisonArme.duree} t)</span>`,
    );
  }
  if (def?.soinAllieBlesse) {
    pastilles.push(
      `<span class="ichip ichip-soin" data-tip="L'attaque soigne l'allié le plus blessé de ${Math.round(def.soinAllieBlesse * 100)} % des dégâts infligés">♥ soigne l'allié blessé (${Math.round(def.soinAllieBlesse * 100)} %)</span>`,
    );
  }
  if (def?.retraitPA) {
    pastilles.push(
      `<span class="ichip ichip-pa" data-tip="L'attaque a 30 % de chance de retirer ${def.retraitPA} PA à la cible">⛓ retrait ${def.retraitPA} PA (30 %)</span>`,
    );
  }
  if (def?.assome) {
    pastilles.push(
      `<span class="ichip malus" data-tip="L'attaque de cette arme a ${Math.round(def.assome * 100)} % de chance d'assommer la cible : elle passe son prochain tour">💫 assomme (${Math.round(def.assome * 100)} %)</span>`,
    );
  }
  if (def?.recupPASort) {
    pastilles.push(
      `<span class="ichip ichip-pa" data-tip="Après chaque sort lancé par le porteur : ${Math.round(def.recupPASort.chance * 100)} % de chance de récupérer ${def.recupPASort.pa} PA immédiatement">↺ ${Math.round(def.recupPASort.chance * 100)} % récup. ${def.recupPASort.pa} PA</span>`,
    );
  }
  if (def?.esquiveBonus) {
    pastilles.push(
      `<span class="ichip ichip-agilite" data-tip="+${Math.round(def.esquiveBonus * 100)} % d'esquive pour le porteur, quelle que soit sa ligne">💨 +${Math.round(def.esquiveBonus * 100)} % esquive</span>`,
    );
  }
  if (def?.esquiveParPiece) {
    pastilles.push(
      `<span class="ichip ichip-agilite" data-tip="Bonus de panoplie : +${Math.round(def.esquiveParPiece * 1000) / 10} % d'esquive par pièce de sa panoplie équipée (s'ajoute aux bonus de panoplie)">💨 +${Math.round(def.esquiveParPiece * 1000) / 10} % esquive / pièce</span>`,
    );
  }
  if (def?.elementLibre) {
    pastilles.push(
      `<span class="ichip ichip-adapt" data-tip="Le porteur peut frapper dans N'IMPORTE quel élément (plus limité à sa paire déclarée)">🌈 élément libre</span>`,
    );
  }
  if (def?.renaissance) {
    pastilles.push(
      `<span class="ichip ichip-adapt" data-tip="À la mort du porteur : renaît UNE fois par combat à ${Math.round(def.renaissance * 100)} % de ses PV">🥚 renaissance (${Math.round(def.renaissance * 100)} % PV)</span>`,
    );
  }
  if (def?.panoplie) {
    pastilles.push(
      `<span class="ichip ichip-pano" data-tip="${echapperHtml(`${def.panoplie} (pièces portées par le même héros) : ${descriptionPanoplie(def.panoplie)}`)}">⬡ ${echapperHtml(def.panoplie)}</span>`,
    );
  }
  return `<span class="ichips">${pastilles.join(``)}</span>`;
}
export const NOMS_STATS = {
  force: `Force`,
  intelligence: `Intelligence`,
  agilite: `Agilité`,
  chance: `Chance`,
  vitalite: `Vitalité`,
  soin: `Soin`,
  prospection: `Prospection`,
  crit: `Critique`,
};
const STATS_NULLES = {
  force: 0,
  intelligence: 0,
  agilite: 0,
  vitalite: 0,
};
const arrondiPct = (ratio) => String(Math.round(ratio * 1000) / 10).replace(`.`, `,`);
const PCT_INTEL_PAR_POINT = arrondiPct(
  bonusDegatsIntelligence({
    ...STATS_NULLES,
    intelligence: 1,
  }) - 1,
);
const PCT_INTEL_MAX = arrondiPct(
  bonusDegatsIntelligence({
    ...STATS_NULLES,
    intelligence: 1000000,
  }) - 1,
);
const PCT_CRIT_BASE = arrondiPct(chanceCritique(STATS_NULLES));
const PCT_CRIT_PAR_AGI = arrondiPct(
  chanceCritique({
    ...STATS_NULLES,
    agilite: 1,
  }) - chanceCritique(STATS_NULLES),
);
const PCT_CRIT_MAX = arrondiPct(
  chanceCritique({
    ...STATS_NULLES,
    agilite: 1000000,
  }),
);
const PCT_DMG_CRIT_BASE = arrondiPct(bonusDegatsCritiques(STATS_NULLES));
const PCT_DMG_CRIT_PAR_AGI = arrondiPct(
  bonusDegatsCritiques({
    ...STATS_NULLES,
    agilite: 1,
  }) - bonusDegatsCritiques(STATS_NULLES),
);
export const AIDE_STATS = {
  force: `Dégâts dans l'élément <b>Terre</b>.<br>+1 Vitalité par 5 de Force.`,
  intelligence: `Dégâts dans l'élément <b>Feu</b>.<br>Dégâts finaux : <b>+${PCT_INTEL_PAR_POINT} %</b> par point (max +${PCT_INTEL_MAX} %).`,
  agilite: `Dégâts dans l'élément <b>Air</b>.<br>Taux de coup critique : <b>+${PCT_CRIT_PAR_AGI} %</b> par point (plancher ${PCT_CRIT_BASE} % pour tous, jusqu'à ${PCT_CRIT_MAX} %).<br>Dégâts critiques : <b>+${PCT_DMG_CRIT_PAR_AGI} %</b> par point (base ${PCT_DMG_CRIT_BASE} %, sans plafond).`,
  chance: `Dégâts dans l'élément <b>Eau</b>.<br>+1 Prospection par 3 de Chance.`,
  vitalite: `Points de vie maximum : <b>+1 PV</b> par point.`,
  soin: `Puissance des soins prodigués : <b>+0,5 %</b> par point (max 50 %).`,
  prospection: `Augmente les chances de butin d'équipement (cumulé sur toute l'équipe).`,
  crit: `% plat de coup critique (équipement), s'ajoute au taux dérivé de l'Agilité — sans plafond, jusqu'au critique permanent.`,
};
export const AIDE_NOTE_ELEMENT = `<br><i class="aide-note">L'élément de frappe est l'un des 2 éléments déclarés par ta classe.</i>`;
export const AIDE_PIEGE = `Piège du Sram : si un adversaire est déplacé sur cette rangée, il le déclenche. Un seul piège part par déplacement. Le premier posé part le premier.`;

// Ce que changerait le fait d'équiper cet objet sur ce héros, par rapport à ce qu'il porte.
const LIBELLES_DELTA = {
  pv: ` PV max`,
  pa: ` PA`,
  attaque: ` dégâts moyens d'arme`,
};
export function libelleDelta(cle) {
  if (LIBELLES_DELTA[cle]) {
    return LIBELLES_DELTA[cle];
  }
  if (cle.startsWith(`res_`)) {
    return ` % rés. ${NOMS_ELEMENTS[cle.slice(4)]}`;
  }
  return ` ${ABREV_STATS[cle] ?? cle}`;
}
export function htmlDeltas(deltas) {
  return deltas
    .map(
      (delta) =>
        `<span class="${delta.valeur > 0 ? `delta-plus` : `delta-moins`}${delta.utile ? `` : ` delta-inutile`}"${delta.utile ? `` : ` data-tip="Peu utile pour cette classe (élément non utilisé)"`}>${delta.valeur > 0 ? `+` : `−`}${Math.abs(Math.round(delta.valeur * 10) / 10)}${libelleDelta(delta.cle)}</span>`,
    )
    .join(` `);
}
export const VERDICTS = {
  mieux: { icone: `▲`, texte: `Amélioration` },
  moins: { icone: `▼`, texte: `Moins bien` },
  mitige: { icone: `⇅`, texte: `Gains et pertes` },
  egal: { icone: `=`, texte: `Pareil` },
  impossible: { icone: `✕`, texte: `Pas équipable` },
};
// Petites pastilles « ▲ Iop » : les héros pour qui l'objet est une amélioration.
export function htmlBadgesHeros(inst, persos, sauf) {
  const heros = herosAmeliores(inst, persos).filter((perso) => perso !== sauf);
  if (!heros.length) {
    return ``;
  }
  return `<span class="badges-heros" data-tip="Amélioration nette pour ces héros">${heros
    .map(
      (perso) =>
        `<span class="badge-heros">▲ ${echapperHtml(CLASSES[perso.classeId]?.nom ?? perso.classeId)}</span>`,
    )
    .join(``)}</span>`;
}
