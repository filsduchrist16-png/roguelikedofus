import { SORTS } from "../data/index.js";
import { afficherAstuce } from "./ecrans/succes.js";
import { statElement } from "../jeu/progression.js";
import {
  ELEMENTS,
  choisirElement,
  ciblesValides,
  coutPA,
  enLigneAvant,
  meilleurElement,
  raisonIndisponible,
  resistanceTotale,
  sommeEffets,
  statsEffectives,
  calculerDegatsDetail,
} from "../combat/stats.js";
import { ordreDeJeu } from "../combat/moteur.js";
import { choisirActionIA } from "../combat/ia.js";
import { ETATS_CLASSE, ICONES_MARQUES } from "../combat/classes.js";
import { nomTouche, sauverParametres } from "../sauvegarde/parametres.js";
import { replierObjectifsCombat } from "./objectifs.js";
import {
  comportementDefilement,
  AIDE_PIEGE,
  IMGS_RESISTANCE,
  IMG_COEUR,
  IMG_CRITIQUE,
  IMG_DMG_CRITIQUE,
  IMG_ETOILE,
  IMG_PP,
  IMG_PUISSANCE,
  IMG_SOIN,
  NOMS_ELEMENTS,
  attrElementSort,
  cheminAsset,
  echapperHtml,
  ecranTactile,
  elementsAMasquer,
  iconeSort,
  infobulleSort,
  masquerElements,
  parametres,
  pastilleElementSort,
  pctCritique,
  pctDegatsCritiques,
  pctPuissanceIntel,
  pctSoin,
  racine,
} from "./commun.js";
import { sortAmeliore } from "../combat/ameliorations.js";
import { htmlRecapEffets, marqueursEffets } from "./recapEffets.js";
import { badgesContenu, enConcentration } from "./capacitesBoss.js";
let combattants = [];
let journalCombat = [];
let titreCombat = ``;
let resolveurAction = null;
// bonus de dégâts du combat, pour l'aperçu des dégâts sur chaque cible
let optionsVue = {};
// détails du sort choisi dépliés (téléphone)
let aideDepliee = false;
let combatEnCours = false;
let combattantActif = null;
let sortChoisi = null;
let contexteCombat = null;
// journal agrandi au toucher (téléphone), gardé d'un combat à l'autre
let journalDeplie = false;
// qui joue pendant les tours des monstres et créatures (posé par le « ▶ Tour de … » du moteur)
let refTourEnCours = null;
let dejaJoues = new Set();
let numeroRonde = 1;
// dernier combattant actif rendu : la frise et la carte ne défilent qu'au changement de tour
let derniereRefRendue = null;
// sort indisponible dont l'aide (et la raison) est affichée, sans passer en visée
let infoSort = null;
// cible pointée au clavier pendant la visée
let refVisee = null;
// la boîte des objectifs se replie dès la première action du joueur
let objectifsReplies = false;
// tour d'un combattant (compté à chaque « ▶ Tour de … ») : la re-sélection et l'auto n'en sortent pas
let numeroTour = 0;
// dernier sort à cible lancé par un héros : { ref, id, tour }, re-sélectionné s'il est encore jouable
let dernierSort = null;
// jeu automatique : null, { ref, tour } (le tour de ce héros) ou { combat: true } (jusqu'à la fin)
let autoJeu = null;
let minuteurAuto = null;
const ecranEtroit = () => window.matchMedia?.(`(max-width: 700px)`).matches ?? false;
const refActive = () => combattantActif?.ref ?? refTourEnCours;
function replierObjectifs() {
  if (!objectifsReplies) {
    objectifsReplies = true;
    replierObjectifsCombat();
  }
}
export function installerRaccourcisCombat() {
  document.addEventListener(`keydown`, (evenement) => {
    if (
      !contexteCombat ||
      !combattantActif ||
      evenement.repeat ||
      evenement.ctrlKey ||
      evenement.metaKey ||
      evenement.altKey
    ) {
      return;
    }
    if (evenement.key === parametres.toucheFinTour) {
      // Espace sur un sort ou un bouton qui a le focus l'active : il ne doit pas finir le tour
      if (
        document.activeElement?.closest(`button, a[href], input, textarea, select, [role="button"]`)
      ) {
        return;
      }
      evenement.preventDefault();
      terminerAction(null);
      return;
    }
    if (evenement.key === `Escape` && (sortChoisi || infoSort)) {
      sortChoisi = null;
      infoSort = null;
      rendreCombat();
      return;
    }
    if (sortChoisi && !sansCibleAChoisir(sortChoisi)) {
      if (
        evenement.key === `ArrowLeft` ||
        evenement.key === `ArrowRight` ||
        evenement.key === `Tab`
      ) {
        evenement.preventDefault();
        deplacerVisee(
          evenement.key === `ArrowLeft` || (evenement.key === `Tab` && evenement.shiftKey) ? -1 : 1,
        );
        return;
      }
      // Entrée sur un bouton de l'aide (Annuler, ⓘ…) garde son effet habituel
      if (
        evenement.key === `Enter` &&
        !document.activeElement?.closest?.(`.aide button, #fin-tour`)
      ) {
        evenement.preventDefault();
        lancerSurVisee();
        return;
      }
    }
    let chiffre = /^(?:Digit|Numpad)([1-9])$/.exec(evenement.code);
    if (chiffre) {
      let numero = Number(chiffre[1]);
      let sort = numero === 1 ? combattantActif.armeSort : SORTS[combattantActif.sorts[numero - 2]];
      if (sort) {
        evenement.preventDefault();
        choisirSort(sort, true);
      }
    }
  });
}
// Visée au clavier : la classe .visee passe d'une carte ciblable à l'autre, dans l'ordre affiché.
function cartesCiblables() {
  return racine ? [...racine.querySelectorAll(`.carte.ciblable`)] : [];
}
function marquerVisee() {
  const cartes = cartesCiblables();
  if (!cartes.some((carte) => carte.dataset.ref === refVisee)) {
    // par défaut : la première cible que le sort achève, sinon la première
    const mortelle = cartes.find((carte) => carte.querySelector(`.cc-apercu.mortel`));
    refVisee = (mortelle ?? cartes[0])?.dataset.ref ?? null;
  }
  for (const carte of cartes) {
    carte.classList.toggle(`visee`, carte.dataset.ref === refVisee);
    carte.classList.toggle(`unique`, cartes.length === 1);
  }
}
function deplacerVisee(pas) {
  const cartes = cartesCiblables();
  if (!cartes.length) {
    return;
  }
  const indice = cartes.findIndex((candidate) => candidate.dataset.ref === refVisee);
  refVisee = cartes[(indice + pas + cartes.length) % cartes.length].dataset.ref;
  marquerVisee();
  const carte = cartes.find((candidate) => candidate.dataset.ref === refVisee);
  carte?.focus({ preventScroll: true });
  carte?.scrollIntoView({ block: `nearest`, inline: `nearest` });
}
function lancerSurVisee() {
  const carte = racine?.querySelector(`.carte.ciblable.visee`);
  if (!carte || !sortChoisi) {
    return false;
  }
  terminerAction({ sort: sortChoisi, cibleRef: carte.dataset.ref });
  return true;
}
export function installerInfobulleSorts() {
  let bulle = document.createElement(`div`);
  bulle.className = `sort-tip`;
  bulle.style.display = `none`;
  document.body.appendChild(bulle);
  elementsAMasquer.push(bulle);
  let montrer = (bouton) => {
    let sort = bouton.dataset.arme
      ? combattantActif?.armeSort
      : bouton.dataset.sort
        ? SORTS[bouton.dataset.sort]
        : null;
    if (!sort) {
      return;
    }
    let raison = combattantActif ? raisonIndisponible(combattantActif, sort, combattants) : null;
    bulle.innerHTML =
      infobulleSort(sort, combattantActif) +
      (raison ? `<div class="tip-indispo">⛔ ${echapperHtml(raison)}</div>` : ``);
    bulle.style.display = `block`;
    let cadre = bouton.getBoundingClientRect();
    let cadreBulle = bulle.getBoundingClientRect();
    let gauche = cadre.left + cadre.width / 2 - cadreBulle.width / 2;
    gauche = Math.max(8, Math.min(gauche, window.innerWidth - cadreBulle.width - 8));
    let haut = cadre.top - cadreBulle.height - 10;
    if (haut < 8) {
      haut = cadre.bottom + 10;
    }
    bulle.style.left = `${gauche}px`;
    bulle.style.top = `${haut}px`;
  };
  document.addEventListener(`mouseover`, (evenement) => {
    let bouton = evenement.target.closest?.(`button.sort[data-sort], button.sort[data-arme]`);
    // le sort choisi est déjà détaillé dans l'aide : pas d'infobulle qui cacherait les cibles
    if (bouton && !bouton.classList.contains(`choisi`)) {
      montrer(bouton);
    }
  });
  document.addEventListener(`mouseout`, (evenement) => {
    let bouton = evenement.target.closest?.(`button.sort[data-sort], button.sort[data-arme]`);
    if (bouton && !bouton.contains(evenement.relatedTarget)) {
      bulle.style.display = `none`;
    }
  });
}
function peutEncoreJouer(combattant, liste) {
  // l'attaque d'arme compte aussi : sans elle, un héros à qui il ne reste que les PA
  // de son arme voyait son tour passé automatiquement
  return [combattant.armeSort, ...combattant.sorts.map((idSort) => SORTS[idSort])]
    .filter(Boolean)
    .some((sort) => !raisonIndisponible(combattant, sort, liste));
}
function htmlLigneJournal(entree) {
  let type = `info`;
  if (entree.msg.startsWith(`▶`)) {
    type = `tour`;
  } else if (/dégâts|inflige|subit|meurt|perd/i.test(entree.msg)) {
    type = `degats`;
  } else if (/récupère|soigne|soin|PV rendus|bouclier/i.test(entree.msg)) {
    type = `soin`;
  } else if (/poison|empoisonne|☠/i.test(entree.msg)) {
    type = `poison`;
  }
  let html = echapperHtml(entree.msg);
  if (entree.meta?.portion) {
    let portion = echapperHtml(entree.meta.portion);
    html = html.replace(
      portion,
      `<span class="log-el el-${entree.meta.element}">${portion}</span>`,
    );
  }
  return `<div class="log-line log-${type}">${html}</div>`;
}
// Journal : on n'ajoute que la nouvelle ligne (appendChild) au lieu de tout réécrire, pour que les
// lecteurs d'écran (role="log") n'annoncent que le nouveau message. Reconstruit seulement si besoin.
function elementLigneJournal(entree) {
  const modele = document.createElement(`template`);
  modele.innerHTML = htmlLigneJournal(entree);
  return modele.content.firstElementChild;
}
function rafraichirJournal(nouvelle = null) {
  let journalEl = document.getElementById(`journal`);
  if (journalEl) {
    // ne recolle en bas que si le joueur y était déjà : on peut remonter lire pendant un tour
    const enBas = journalEl.scrollHeight - journalEl.scrollTop - journalEl.clientHeight < 12;
    if (nouvelle && journalEl.children.length === journalCombat.length - 1) {
      journalEl.appendChild(elementLigneJournal(nouvelle));
      while (journalEl.children.length > journalCombat.length) {
        journalEl.firstElementChild.remove();
      }
    } else if (journalEl.children.length !== journalCombat.length) {
      journalEl.replaceChildren(...journalCombat.map(elementLigneJournal));
    }
    if (enBas) {
      journalEl.scrollTop = journalEl.scrollHeight;
    }
  }
}
export function journaliser(msg, meta) {
  if (meta?.ronde) {
    // début de ronde signalé par le moteur : pas de ligne dans le journal
    if (dejaJoues.size > 0) {
      dejaJoues.clear();
      numeroRonde++;
    }
    return;
  }
  if (meta?.tour) {
    numeroTour++;
    dejaJoues.add(meta.tour);
    refTourEnCours = meta.tour;
  }
  const entree = { msg, meta };
  const plein = journalCombat.length >= 200;
  journalCombat.push(entree);
  if (plein) {
    journalCombat.shift();
    // une ligne sort en tête : le journal affiché la perd aussi avant l'ajout
    document.getElementById(`journal`)?.firstElementChild?.remove();
  }
  rafraichirJournal(entree);
}
// Défi du combat en cours (challenges façon DOFUS), avec son état en direct.
let defiCombat = null;
let etatDefiCombat = null;
const ETATS_DEFI = {
  en_cours: [``, `en cours`],
  assure: [`✔`, `réussi si tu gagnes`],
  rate: [`✖`, `raté`],
};
export function definirDefiCombat(defi, etat = null) {
  defiCombat = defi;
  etatDefiCombat = etat;
  const hote = document.getElementById(`cb-defi`);
  if (hote) {
    hote.innerHTML = htmlDefi();
  }
  const pastilles = document.getElementById(`cb-pastilles`);
  if (pastilles) {
    pastilles.innerHTML = htmlPastilles();
  }
}
export function majEtatDefi(etat) {
  if (etat?.etat === etatDefiCombat?.etat && etat?.detail === etatDefiCombat?.detail) {
    return;
  }
  definirDefiCombat(defiCombat, etat);
}
function htmlDefi() {
  if (!defiCombat) {
    return ``;
  }
  const etat = etatDefiCombat ?? { etat: `en_cours` };
  const [icone, libelle] = ETATS_DEFI[etat.etat] ?? ETATS_DEFI.en_cours;
  return `<div class="defi-combat defi-${etat.etat}" data-tip="Réussis le défi pour gagner +30 % d'XP et de kamas">
    <span class="defi-nom">🎯 Défi ${echapperHtml(defiCombat.nom)}</span>
    <span class="defi-texte">${echapperHtml(defiCombat.texte)}</span>
    <span class="defi-etat">${icone ? `${icone} ` : ``}${libelle}${etat.detail ? ` · ${echapperHtml(etat.detail)}` : ``}</span>
    <small class="defi-bonus">+30 % XP et kamas</small>
  </div>`;
}
// Téléphone : défi, affixes et Almanax en petites pastilles sur une seule rangée en haut de
// l'écran, le détail au toucher (data-tip). Le PC garde le bloc du défi et les pastilles d'affixes.
function htmlPastilles() {
  const pastilles = [];
  if (defiCombat) {
    const etat = etatDefiCombat ?? { etat: `en_cours` };
    const [icone, libelle] = ETATS_DEFI[etat.etat] ?? ETATS_DEFI.en_cours;
    const detail = `${libelle}${etat.detail ? ` · ${etat.detail}` : ``}`;
    pastilles.push(
      `<span class="cb-pastille cb-defi defi-${etat.etat}" tabindex="0" data-tip="${echapperHtml(`🎯 Défi ${defiCombat.nom} : ${defiCombat.texte} (${detail}). Réussi : +30 % d'XP et de kamas.`)}">🎯 <span class="cb-pastille-txt">${echapperHtml(defiCombat.nom)}</span>${icone ? ` <b>${icone}</b>` : ``}</span>`,
    );
  }
  const affixes = optionsVue.affixes ?? [];
  if (affixes.length) {
    const detail = affixes.map((affixe) => `⚔ ${affixe.nom} : ${affixe.desc}`).join(` · `);
    pastilles.push(
      `<span class="cb-pastille cb-affixes" tabindex="0" data-tip="${echapperHtml(detail)}">⚔ <span class="cb-pastille-txt">${affixes.length > 1 ? `${affixes.length} affixes` : echapperHtml(affixes[0].nom)}</span></span>`,
    );
  }
  const almanax = optionsVue.almanax;
  if (almanax && !almanax.fait) {
    pastilles.push(
      `<span class="cb-pastille cb-almanax" tabindex="0" data-tip="${echapperHtml(`📅 Almanax du jour : ${almanax.quete.texte} (${almanax.progres}/${almanax.quete.objectif}).`)}">📅 <span class="cb-pastille-txt">${almanax.progres}/${almanax.quete.objectif}</span></span>`,
    );
  }
  return pastilles.join(``);
}
// Combat en cours ou dernier combat joué : son titre et les ennemis restés debout (cause d'une
// défaite, pour l'historique des runs).
export function resumeDernierCombat() {
  return {
    titre: titreCombat,
    ennemis: combattants
      .filter((combattant) => combattant.camp === `ennemi` && combattant.pvActuels > 0)
      .map((combattant) => combattant.nom),
  };
}
// Récapitulatif des effets d'un combattant (appui sur sa carte ou sa pastille) : panneau posé sur
// la coquille du combat, tenu à jour à chaque rendu tant qu'il est ouvert.
let refRecap = null;
function majRecapEffets() {
  const panneau = racine?.querySelector(`.recap-effets`);
  const combattant = refRecap && combattants.find((candidat) => candidat.ref === refRecap);
  if (!combattant) {
    panneau?.remove();
    refRecap = null;
    return;
  }
  if (panneau) {
    panneau.querySelector(`.re-boite`).innerHTML = htmlRecapEffets(
      combattant,
      badgesCombattant(combattant),
    );
  }
}
function ouvrirRecapEffets(ref) {
  const combat = racine?.querySelector(`.combat`);
  if (!combat || !combattants.some((candidat) => candidat.ref === ref)) {
    return;
  }
  refRecap = ref;
  if (!combat.querySelector(`.recap-effets`)) {
    const panneau = document.createElement(`div`);
    panneau.className = `recap-effets`;
    panneau.innerHTML = `<div class="re-fond" data-fermer-recap></div><section class="re-boite" role="dialog" aria-modal="true" aria-labelledby="re-titre"></section>`;
    panneau.addEventListener(`click`, (ev) => {
      if (ev.target.closest(`[data-fermer-recap]`)) {
        fermerRecapEffets();
      }
    });
    panneau.addEventListener(`keydown`, (ev) => {
      if (ev.key === `Escape`) {
        ev.stopPropagation();
        fermerRecapEffets();
      }
    });
    combat.appendChild(panneau);
  }
  majRecapEffets();
  combat.querySelector(`.re-fermer`)?.focus({ preventScroll: true });
}
function fermerRecapEffets() {
  refRecap = null;
  racine?.querySelector(`.recap-effets`)?.remove();
}
export function initialiserVueCombat(liste, titre, resolveur = null, options = {}) {
  refRecap = null;
  optionsVue = options;
  defiCombat = null;
  etatDefiCombat = null;
  combattants = liste;
  titreCombat = titre;
  resolveurAction = resolveur;
  journalCombat = [];
  combattantActif = null;
  sortChoisi = null;
  infoSort = null;
  refVisee = null;
  refTourEnCours = null;
  dejaJoues = new Set();
  numeroRonde = 1;
  numeroTour = 0;
  dernierSort = null;
  autoJeu = null;
  clearTimeout(minuteurAuto);
  derniereRefRendue = null;
  objectifsReplies = false;
  combatEnCours = false;
  rendreCombat();
  memoriserEtats(liste);
}
// Combattants et ronde du combat affiché (bilan de fin de combat), sans copie.
export function etatVueCombat() {
  return [combattants, numeroRonde];
}
export function rafraichirCombat() {
  rendreCombat();
  jouerAnimationsFx();
}
const etatsPrecedents = new Map();
let coucheFx = null;
let compteurFx = 0;
const evenementsFx = new Map();
export function enregistrerFx(evenement) {
  let entree = evenementsFx.get(evenement.ref) ?? {};
  if (evenement.type === `crit`) {
    entree.crit = true;
  }
  if (evenement.type === `esquive`) {
    entree.esquive = true;
  }
  evenementsFx.set(evenement.ref, entree);
}
function obtenirCoucheFx() {
  if (!coucheFx || !coucheFx.isConnected) {
    coucheFx = document.createElement(`div`);
    coucheFx.className = `fx-layer`;
    document.body.appendChild(coucheFx);
  }
  return coucheFx;
}
function memoriserEtats(liste) {
  etatsPrecedents.clear();
  for (let combattant of liste) {
    etatsPrecedents.set(combattant.ref, {
      pv: combattant.pvActuels,
      bouclier: combattant.bouclier,
      mort: combattant.pvActuels <= 0,
      furie: !!combattant.enFurie,
      concentration: enConcentration(combattant),
    });
  }
}
// Cadre où montrer un effet : la carte, ou sur téléphone la pastille du héros dans la barre du bas
// quand la carte est cachée dessous ou hors de l'écran.
function cadreFx(ref) {
  let carte = racine.querySelector(`.carte[data-ref="${ref}"]`);
  if (!carte) {
    return null;
  }
  let cadre = carte.getBoundingClientRect();
  let pastille = racine.querySelector(`.em-heros[data-heros="${ref}"]`);
  let barre = document.getElementById(`cb-barre`)?.getBoundingClientRect();
  let milieu = cadre.top + cadre.height / 2;
  let cachee = milieu < 0 || milieu > innerHeight || (barre && milieu > barre.top);
  if (pastille && cachee && pastille.getClientRects().length) {
    return pastille.getBoundingClientRect();
  }
  return cadre;
}
function afficherNombreFx(ref, texte, classe) {
  let cadre = cadreFx(ref);
  if (!cadre) {
    return;
  }
  let nombre = document.createElement(`div`);
  nombre.className = `fx-num ${classe}`;
  nombre.textContent = texte;
  let decalage = (compteurFx++ % 3) * 16 - 16;
  nombre.style.left = `${cadre.left + cadre.width / 2 + decalage}px`;
  nombre.style.top = `${cadre.top + cadre.height * 0.32}px`;
  nombre.addEventListener(`animationend`, () => nombre.remove());
  obtenirCoucheFx().appendChild(nombre);
  // un texte long (« 💀 Cra K.O. ») ne sort pas de l'écran sur téléphone
  const largeur = nombre.offsetWidth;
  const centre = Math.min(
    Math.max(parseFloat(nombre.style.left), largeur / 2 + 4),
    innerWidth - largeur / 2 - 4,
  );
  nombre.style.left = `${centre}px`;
}
function afficherFlashFx(ref, classe = ``) {
  let cadre = cadreFx(ref);
  if (!cadre) {
    return;
  }
  let flash = document.createElement(`div`);
  flash.className = `fx-flash${classe ? ` ${classe}` : ``}`;
  flash.style.left = `${cadre.left}px`;
  flash.style.top = `${cadre.top}px`;
  flash.style.width = `${cadre.width}px`;
  flash.style.height = `${cadre.height}px`;
  flash.addEventListener(`animationend`, () => flash.remove());
  obtenirCoucheFx().appendChild(flash);
}
function jouerAnimationsFx() {
  for (let combattant of combattants) {
    let avant = etatsPrecedents.get(combattant.ref);
    if (!avant) {
      continue;
    }
    let degats =
      Math.max(0, avant.pv - combattant.pvActuels) +
      Math.max(0, avant.bouclier - combattant.bouclier);
    let soins = Math.max(0, combattant.pvActuels - avant.pv);
    let boucliers = Math.max(0, combattant.bouclier - avant.bouclier);
    let fx = evenementsFx.get(combattant.ref);
    if (degats > 0) {
      if (fx?.crit) {
        afficherNombreFx(combattant.ref, `-${degats} !`, `crit`);
      } else {
        afficherNombreFx(combattant.ref, `-${degats}`, `dmg`);
      }
      afficherFlashFx(combattant.ref);
    }
    if (fx?.esquive) {
      afficherNombreFx(combattant.ref, `Esquive !`, `esquive`);
    }
    if (soins > 0) {
      afficherNombreFx(combattant.ref, `+${soins}`, `soin`);
    }
    if (boucliers > 0) {
      afficherNombreFx(combattant.ref, `+${boucliers}`, `bouclier`);
    }
    if (!avant.mort && combattant.pvActuels <= 0) {
      // un héros qui tombe : en rouge, sur sa carte ou sa pastille de la barre du bas
      const heros = combattant.camp === `joueur`;
      afficherNombreFx(
        combattant.ref,
        heros ? `💀 ${combattant.nom} K.O.` : `K.O.`,
        heros ? `mort mort-heros` : `mort`,
      );
      if (heros) {
        afficherFlashFx(combattant.ref, `ko`);
      }
    }
    if (!avant.furie && combattant.enFurie && combattant.pvActuels > 0) {
      // le détail (+20 % · +1 PA) est sur le badge de la carte
      afficherNombreFx(combattant.ref, `🔥 Furie !`, `furie`);
      afficherFlashFx(combattant.ref, `furie`);
    }
    // boss qui prépare une frappe (capacité de boss) : impossible à rater
    if (!avant.concentration && enConcentration(combattant) && combattant.pvActuels > 0) {
      afficherNombreFx(combattant.ref, `⚠️ ${combattant.capacite?.nom ?? `Frappe`} !`, `furie`);
      afficherFlashFx(combattant.ref, `furie`);
    }
  }
  evenementsFx.clear();
  memoriserEtats(combattants);
}
// Écran tactile : pas de survol, donc pas d'infobulle. Un premier appui sur un sort l'affiche
// (description + bouton « Lancer ») au lieu de le lancer directement.
const sansCibleAChoisir = (sort) => sort.cible === `soi` || sort.cible === `allie_tous`;
// Dégâts prévus [min, max] → PV restants [bas, haut] de la cible (le bouclier absorbe d'abord).
export function pvApresCoup(pv, bouclier, [min, max]) {
  const reste = (degats) => Math.max(0, Math.round(pv - Math.max(0, degats - (bouclier ?? 0))));
  return [reste(max), reste(min)];
}
const herosASoin = (combattant) =>
  combattant.sorts?.some((idSort) => SORTS[idSort]?.type === `soin`);
// Jeu automatique d'un héros, règle simple : l'IA des monstres (soutien si le héros a un soin,
// attaque sinon), puis l'attaque d'arme sur la première cible valide. null : fin du tour.
export function actionAuto(acteur, liste, contexte = {}) {
  const valide = (action) =>
    !!action?.sort &&
    !raisonIndisponible(acteur, action.sort, liste) &&
    (sansCibleAChoisir(action.sort) ||
      ciblesValides(acteur, action.sort, liste).some((cible) => cible.ref === action.cibleRef));
  let action;
  const iaAvant = acteur.ia;
  try {
    // lecture seule de l'IA : le mode est posé le temps du choix, puis remis
    acteur.ia = herosASoin(acteur) ? `soutien` : iaAvant;
    action = choisirActionIA(acteur, liste, contexte);
  } catch {
    action = null;
  } finally {
    acteur.ia = iaAvant;
  }
  if (valide(action)) {
    return action;
  }
  const arme = acteur.armeSort;
  if (arme && !raisonIndisponible(acteur, arme, liste)) {
    const cible = ciblesValides(acteur, arme, liste).find(
      (candidate) => candidate.camp !== acteur.camp && candidate.pvActuels > 0,
    );
    if (cible) {
      return { sort: arme, cibleRef: cible.ref };
    }
  }
  return null;
}
const autoEnCours = (combattant) =>
  !!autoJeu && (autoJeu.combat || (autoJeu.ref === combattant?.ref && autoJeu.tour === numeroTour));
function jouerAuto() {
  const acteur = combattantActif;
  const resolveur = contexteCombat;
  if (!acteur || !resolveur) {
    return;
  }
  clearTimeout(minuteurAuto);
  minuteurAuto = setTimeout(
    () => {
      // le joueur a pu reprendre la main (⏹) ou le tour a changé entre-temps
      if (contexteCombat !== resolveur || !autoEnCours(acteur)) {
        return;
      }
      terminerAction(actionAuto(acteur, combattants, optionsVue));
    },
    parametres.combatRapide ? 150 : 450,
  );
}
function basculerAuto() {
  if (autoJeu) {
    autoJeu = null;
    clearTimeout(minuteurAuto);
    rendreCombat();
    return;
  }
  if (!combattantActif || !contexteCombat) {
    return;
  }
  autoJeu =
    parametres.modeAuto === `combat`
      ? { combat: true }
      : { ref: combattantActif.ref, tour: numeroTour };
  sortChoisi = null;
  infoSort = null;
  rendreCombat();
  jouerAuto();
}
// Re-sélection du dernier sort : même héros, même tour, sort à cible encore jouable.
function sortAReselectionner(combattant, liste) {
  if (
    !parametres.reselectionSort ||
    !dernierSort ||
    dernierSort.ref !== combattant.ref ||
    dernierSort.tour !== numeroTour
  ) {
    return null;
  }
  const sort =
    dernierSort.id === combattant.armeSort?.id ? combattant.armeSort : SORTS[dernierSort.id];
  if (!sort || sansCibleAChoisir(sort) || raisonIndisponible(combattant, sort, liste)) {
    return null;
  }
  return ciblesValides(combattant, sort, liste).some((cible) => cible.pvActuels > 0) ? sort : null;
}
export function controleurJoueur(combattant, liste) {
  combattants = liste;
  combattantActif = combattant;
  sortChoisi = null;
  infoSort = null;
  refVisee = null;
  return new Promise((resolve) => {
    contexteCombat = resolve;
    if (autoEnCours(combattant)) {
      rendreCombat();
      jouerAuto();
      return;
    }
    if (autoJeu && !autoJeu.combat) {
      // l'auto d'un héros s'arrête à la fin de son tour
      autoJeu = null;
    }
    if (parametres.autoFinTour && !peutEncoreJouer(combattant, liste)) {
      journaliser(`${combattant.nom} n'a plus rien à jouer, tour passé.`);
      rendreCombat();
      // ne termine que CE tour : si le joueur a déjà cliqué « Terminer » entre-temps,
      // le délai ne doit pas écourter le tour du héros suivant
      setTimeout(() => {
        if (contexteCombat === resolve) {
          terminerAction(null);
        }
      }, 350);
      return;
    }
    sortChoisi = sortAReselectionner(combattant, liste);
    rendreCombat();
    montrerHerosActif();
    afficherAstuce(
      `combat`,
      `Les héros de l'avant encaissent, ceux de l'arrière sont protégés. Chaque sort coûte des PA : touche un sort puis une cible.`,
    );
  });
}
// Téléphone : au début du tour d'un héros, sa carte ne doit pas rester cachée sous la barre
// des sorts collée en bas de l'écran.
function montrerHerosActif() {
  if (!ecranEtroit() || !combattantActif) {
    return;
  }
  const carte = racine.querySelector(`.carte[data-ref="${combattantActif.ref}"]`);
  const barre = document.getElementById(`cb-barre`);
  if (carte) {
    carte.style.scrollMarginBottom = `${(barre?.offsetHeight ?? 0) + 8}px`;
    carte.style.scrollMarginTop = `8px`;
    carte.scrollIntoView({ block: `nearest` });
  }
}
function terminerAction(action) {
  let resolveur = contexteCombat;
  if (action?.sort && combattantActif && !sansCibleAChoisir(action.sort)) {
    dernierSort = { ref: combattantActif.ref, id: action.sort.id, tour: numeroTour };
  }
  combattantActif = null;
  sortChoisi = null;
  infoSort = null;
  refVisee = null;
  contexteCombat = null;
  rendreCombat();
  resolveur?.(action);
}
function sortJouable(lanceur, sort) {
  return !raisonIndisponible(lanceur, sort, combattants);
}
function lancerSurSoi(sort) {
  terminerAction({
    sort,
    cibleRef: combattantActif.ref,
  });
}
function choisirSort(sort, depuisClavier = false) {
  let acteur = combattantActif;
  if (!acteur || !contexteCombat || !sort) {
    return;
  }
  replierObjectifs();
  document.querySelectorAll(`.sort-tip`).forEach((tip) => (tip.style.display = `none`));
  // un second appui sur le sort choisi le lance sur la cible pointée (touche du sort, ou cible
  // unique), le lance sur soi s'il n'a pas de cible à choisir, sinon l'annule
  if (sortChoisi?.id === sort.id) {
    if (sansCibleAChoisir(sort)) {
      lancerSurSoi(sort);
    } else if ((depuisClavier || cartesCiblables().length === 1) && lancerSurVisee()) {
      return;
    } else {
      sortChoisi = null;
      rendreCombat();
    }
    return;
  }
  // les raccourcis clavier passent par ici : mêmes conditions que les boutons (PA, recharge,
  // cibles) ; un sort indisponible montre son aide et la raison, sans passer en visée
  if (!sortJouable(acteur, sort)) {
    infoSort = infoSort?.id === sort.id ? null : sort;
    sortChoisi = null;
    rendreCombat();
    return;
  }
  infoSort = null;
  if (sansCibleAChoisir(sort) && !ecranTactile()) {
    lancerSurSoi(sort);
    return;
  }
  sortChoisi = sort;
  refVisee = null;
  // réglage : un sort qui n'a qu'une cible possible part dès le premier appui
  if (parametres.cibleUniqueDirecte && !sansCibleAChoisir(sort)) {
    const cibles = ciblesValides(acteur, sort, combattants).filter((cible) => cible.pvActuels > 0);
    if (cibles.length === 1) {
      terminerAction({ sort, cibleRef: cibles[0].ref });
      return;
    }
  }
  rendreCombat();
}
function badgeArchi(combattant) {
  if (combattant.camp !== `ennemi` || !combattant.archi || !combattant.archiNom) {
    return ``;
  }
  let texte =
    combattant.monstreId && resolveurAction?.archis.includes(combattant.monstreId)
      ? `Archimonstre (âme déjà capturée) : ${combattant.archiNom}`
      : `Archimonstre : vaincs-le pour capturer son âme : ${combattant.archiNom}`;
  return `<img class="archi-badge capture" src="${cheminAsset(`/assets/divers/Archmonster.webp`)}" alt="" data-tip="${echapperHtml(texte)}" onerror="this.remove()" />`;
}
function compterPieges(camp, avant) {
  let nb = 0;
  for (let combattant of combattants) {
    for (let piege of combattant.pieges ?? []) {
      piege.camp === camp && piege.avant === avant && nb++;
    }
  }
  return nb;
}
// Dégâts prévus du sort choisi sur une cible (sans esquive ni critique) : [min, max], ou null.
function apercuDegats(cible) {
  const sort = sortChoisi;
  const lanceur = combattantActif;
  if (
    !sort ||
    !lanceur ||
    sort.type !== `degats` ||
    !(sort.baseMax > 0) ||
    cible.camp === lanceur.camp
  ) {
    return null;
  }
  try {
    const calc = (tirage) => {
      const suite = sort.sansEsquiveNiCrit ? [tirage] : [0.999, tirage, 0.999];
      let indice = 0;
      const ctx = {
        rng: () => suite[indice++] ?? 0.999,
        log: () => {},
        playerDamageBonus: optionsVue.playerDamageBonus ?? 1,
        enemyDamageBonus: optionsVue.enemyDamageBonus ?? 1,
        reliquesActives: optionsVue.reliquesActives ?? new Set(),
      };
      return calculerDegatsDetail(lanceur, sort, cible, {
        ctx,
        mult: 1,
        paAvant: lanceur.paActuels,
      }).dmg;
    };
    const min = calc(0);
    const max = calc(0.999);
    return Number.isFinite(min) && Number.isFinite(max) ? [min, max] : null;
  } catch {
    return null;
  }
}
// Effets temporaires lisibles sur les cartes : un badge chiffré par effet (les effets identiques
// se cumulent), et une explication longue au survol ou au toucher (data-tip).
const pct = (valeur) => Math.round(Math.abs(valeur) * 100);
const signe = (valeur) => (valeur >= 0 ? `+` : `−`);
export const EFFETS_AFFICHAGE = {
  poison: {
    icone: `☠`,
    court: (valeur) => `poison ${valeur}/t`,
    long: (valeur) => `Poison : perd ${valeur} PV au début de chacun de ses tours.`,
    classe: `mal`,
  },
  hot: {
    icone: `♥`,
    court: (valeur) => `soin ${valeur}/t`,
    long: (valeur) => `Régénère ${valeur} PV au début de chacun de ses tours.`,
    classe: `bien`,
  },
  degatsInfliges: {
    icone: `⚔`,
    court: (valeur) => `${signe(valeur)}${pct(valeur)} % dgts`,
    long: (valeur) => `Dégâts infligés ${signe(valeur)}${pct(valeur)} %.`,
  },
  resAll: {
    icone: `🛡`,
    court: (valeur) => `${signe(valeur)}${pct(valeur)} % rés.`,
    long: (valeur) => `Résistances à tous les éléments ${signe(valeur)}${pct(valeur)} %.`,
  },
  reductionDegats: {
    icone: `🛡`,
    court: (valeur) => `−${pct(valeur)} % subis`,
    long: (valeur) => `Dégâts subis réduits de ${pct(valeur)} %.`,
    classe: `bien`,
  },
  friction: {
    icone: `🚫`,
    court: () => `soins bloqués`,
    long: () => `Friction : ne peut être ni soigné ni régénéré.`,
    classe: `mal`,
  },
  ignoreLigne: {
    icone: `👁`,
    court: () => `vision`,
    long: () => `Vision : ses sorts de ligne peuvent viser la ligne arrière.`,
    classe: `bien`,
  },
  crit: {
    icone: `🎯`,
    court: (valeur) => `+${valeur} % crit`,
    long: (valeur) => `Chance de coup critique +${valeur} %.`,
    classe: `bien`,
  },
  force: {
    icone: `💪`,
    court: (valeur) => `${signe(valeur)}${Math.abs(valeur)} Force`,
    long: (valeur) => `Force ${signe(valeur)}${Math.abs(valeur)} (cumulable).`,
  },
  intelligence: {
    icone: `🔥`,
    court: (valeur) => `${signe(valeur)}${Math.abs(valeur)} Intel.`,
    long: (valeur) => `Intelligence ${signe(valeur)}${Math.abs(valeur)} (cumulable).`,
  },
  agilite: {
    icone: `💨`,
    court: (valeur) => `${signe(valeur)}${Math.abs(valeur)} Agi.`,
    long: (valeur) => `Agilité ${signe(valeur)}${Math.abs(valeur)} (cumulable).`,
  },
  chance: {
    icone: `💧`,
    court: (valeur) => `${signe(valeur)}${Math.abs(valeur)} Chance`,
    long: (valeur) => `Chance ${signe(valeur)}${Math.abs(valeur)} (cumulable).`,
  },
  vitalite: {
    icone: `❤`,
    court: (valeur) => `${signe(valeur)}${pct(valeur)} % PV`,
    long: (valeur) => `PV max ${signe(valeur)}${pct(valeur)} %.`,
  },
  initiative: {
    icone: `⏳`,
    court: (valeur) => `init ${valeur >= 0 ? `+` : ``}${valeur}`,
    long: (valeur) =>
      `Initiative ${valeur >= 0 ? `+` : ``}${valeur} : change sa place dans l'ordre de jeu.`,
  },
  contre: {
    icone: `⚔️`,
    court: (valeur) => `contre ${pct(valeur)} %`,
    long: (valeur) => `Contre : ${pct(valeur)} % de chances de riposter quand il est frappé.`,
    classe: `bien`,
  },
  proie: {
    icone: `🎯`,
    court: (valeur) => `proie · vol ${pct(valeur)} %`,
    long: (valeur) =>
      `Proie : l'équipe adverse récupère ${pct(valeur)} % des dégâts qu'elle lui inflige.`,
    classe: `mal`,
  },
  tetanise: {
    icone: `🦴`,
    court: () => `tétanisé`,
    long: () => `Tétanisé : ses sorts ne peuvent viser que la ligne avant.`,
    classe: `mal`,
  },
  assome: {
    icone: `💫`,
    court: () => `assommé`,
    long: () => `Assommé : passe son prochain tour.`,
    classe: `mal`,
  },
  echecCritique: {
    icone: `🌀`,
    court: (valeur) => `échec ${pct(valeur)} %`,
    long: (valeur) => `${pct(valeur)} % de chances que chacun de ses sorts échoue.`,
    classe: `mal`,
  },
  armure: {
    icone: `🪨`,
    court: (valeur) => `armure +${valeur}`,
    long: (valeur) => `Armure : retire ${valeur} à chaque frappe reçue.`,
    classe: `bien`,
  },
  degatsCritSubis: {
    icone: `🃏`,
    court: (valeur) => `+${pct(valeur)} % crit subis`,
    long: (valeur) => `Subit ${pct(valeur)} % de dégâts en plus sur les coups critiques.`,
    classe: `mal`,
  },
  esquive: {
    icone: `💨`,
    court: (valeur) => `+${pct(valeur)} % esq.`,
    long: (valeur) => `Esquive +${pct(valeur)} % : chance d'éviter complètement une attaque.`,
    classe: `bien`,
  },
  bonusPieges: {
    icone: `🪤`,
    court: (valeur) => `pièges +${pct(valeur)} %`,
    long: (valeur) => `Ses pièges font ${pct(valeur)} % de dégâts en plus.`,
    classe: `bien`,
  },
  infection: {
    icone: `🌿`,
    court: () => `infecté`,
    long: () => `Infecté : les sorts du Sadida le frappent plus fort et se propagent.`,
    classe: `mal`,
  },
  paParTour: {
    icone: `★`,
    court: (valeur) => `+${valeur} PA/tour`,
    long: (valeur) => `Gagne ${valeur} PA au début de chacun de ses tours.`,
    classe: `bien`,
  },
  aiguille: {
    icone: `🪡`,
    court: () => `écho d'Aiguille`,
    long: () => `Chaque Téléfrag posé sur lui déclenche une Aiguille.`,
    classe: `mal`,
  },
};
// les effets « permanents » (99 tours) n'affichent pas de durée
const duree = (tours) => (tours > 0 && tours < 90 ? ` · ${tours} t` : ``);
const dureeLongue = (tours) =>
  tours > 0 && tours < 90
    ? ` Encore ${tours} tour${tours > 1 ? `s` : ``}.`
    : ` Jusqu'à la fin du combat.`;
export function badgesEffets(combattant) {
  const cumuls = new Map();
  for (const ef of combattant.effets) {
    // les effets d'un état de classe sont expliqués par le badge de l'état
    if (ef.source === `etat`) {
      continue;
    }
    const cumul = cumuls.get(ef.stat) ?? { valeur: 0, tours: 0 };
    cumul.valeur += ef.valeur;
    cumul.tours = Math.max(cumul.tours, ef.toursRestants ?? 0);
    cumuls.set(ef.stat, cumul);
  }
  const badges = [];
  for (const [stat, { valeur, tours }] of cumuls) {
    const arrondi = Math.round(valeur * 100) / 100;
    const def = EFFETS_AFFICHAGE[stat];
    if (!def) {
      badges.push({ texte: `${stat}${duree(tours)}`, tip: `${stat}.${dureeLongue(tours)}` });
      continue;
    }
    badges.push({
      texte: `${def.icone} ${def.court(arrondi)}${duree(tours)}`,
      tip: `${def.long(arrondi)}${dureeLongue(tours)}`,
      classe: def.classe,
    });
  }
  const temporaires = combattant.boucliersTemporaires ?? [];
  if (temporaires.length) {
    const montant = temporaires.reduce((acc, temporaire) => acc + temporaire.montant, 0);
    const tours = Math.max(...temporaires.map((temporaire) => temporaire.tours));
    badges.push({
      texte: `🛡 bouclier ${Math.round(montant)}${duree(tours)}`,
      tip: `Bouclier temporaire : absorbe ${Math.round(montant)} dégâts avant les PV, puis s'estompe.${dureeLongue(tours)}`,
      classe: `bien`,
    });
  }
  if ((combattant.armure ?? 0) > 0) {
    badges.push({
      texte: `🪨 armure ${combattant.armure}`,
      tip: `Armure permanente : retire ${combattant.armure} à chaque frappe reçue.`,
    });
  }
  return badges;
}
export function badgesCombattant(combattant) {
  // capacité de boss et affixes portés d'abord : la frappe préparée reste en tête
  const badges = [...badgesContenu(combattant), ...badgesEffets(combattant)];
  const ajouter = (texte, tip, classe) => badges.push({ texte, tip, classe });
  const etat = combattant.etatClasse && ETATS_CLASSE[combattant.etatClasse];
  if (etat) {
    const effets = etat.effets
      .map((effet) => EFFETS_AFFICHAGE[effet.stat]?.court(effet.valeur))
      .filter(Boolean)
      .join(`, `);
    ajouter(
      `${etat.icone} ${etat.nom}`,
      `État ${etat.nom}${effets ? ` : ${effets}` : ``}, tant que l'état dure.`,
    );
  }
  if (combattant.marqueElement) {
    ajouter(
      `${ICONES_MARQUES[combattant.marqueElement]} Marque ${NOMS_ELEMENTS[combattant.marqueElement]}`,
      `Marque ${NOMS_ELEMENTS[combattant.marqueElement]} : un sort d'un autre élément la combine pour un effet bonus.`,
    );
  }
  if (combattant.enFurie) {
    const effetsFurie = texteEffetsFurie(combattant.furie);
    ajouter(
      `🔥 Furie${effetsFurie.court ? ` ${effetsFurie.court}` : ``}`,
      `En furie jusqu'à la fin du combat${effetsFurie.long ? ` : ${effetsFurie.long}` : ``}.`,
      `furie`,
    );
  } else if (combattant.furie && combattant.pvActuels > 0) {
    const effetsFurie = texteEffetsFurie(combattant.furie);
    ajouter(
      `💢 Furie < ${Math.round(combattant.furie.seuil * 100)} %`,
      `Boss : sous ${Math.round(combattant.furie.seuil * 100)} % de ses PV, il entre en furie au début de son tour${effetsFurie.long ? ` (${effetsFurie.long})` : ``}, jusqu'à la fin du combat.`,
    );
  }
  if (combattant.tourelle) {
    ajouter(
      `⚙️ Tourelle niv. ${combattant.niveauTourelle ?? 1}`,
      `Tourelle : joue seule à chaque tour.`,
    );
  } else if (combattant.creature) {
    ajouter(`🐾 Créature`, `Créature invoquée : joue seule et disparaît si son invocateur tombe.`);
  }
  if ((combattant.bombes ?? 0) > 0) {
    ajouter(
      `💣 ×${combattant.bombes}`,
      `${combattant.bombes} bombe(s) collée(s) : Kaboom les fait exploser.`,
    );
  }
  if ((combattant.telefrags ?? 0) > 0) {
    ajouter(
      `⌛ ×${combattant.telefrags}`,
      `${combattant.telefrags} Téléfrag(s) posé(s) (4 au plus).`,
    );
  }
  if ((combattant.portails ?? 0) > 0) {
    ajouter(
      `🌀 ×${combattant.portails}`,
      `${combattant.portails} portail(s) ouvert(s) : +2 % de dégâts chacun.`,
    );
  }
  if ((combattant.rage ?? 0) > 0) {
    ajouter(
      `🐺 Rage ×${combattant.rage}`,
      `Rage ×${combattant.rage} : +${5 * combattant.rage} % de dégâts.`,
      `bien`,
    );
  }
  if ((combattant.chausseTrappe ?? 0) > 0) {
    ajouter(
      `🪤 Chausse-Trappe ×${combattant.chausseTrappe}`,
      `Chausse-Trappe ×${combattant.chausseTrappe} (5 au plus) : renforce ses sorts liés.`,
    );
  }
  if (combattant.provoque) {
    ajouter(`🛡 Provoque`, `Provocation : les ennemis doivent le viser en priorité.`);
  }
  if ((combattant.coupsAnnulesRestants ?? 0) > 0) {
    ajouter(
      `🐺 ${combattant.coupsAnnulesRestants} coup(s) annulé(s)`,
      `Encaisse sans broncher : ses ${combattant.coupsAnnulesRestants} prochain(s) coup(s) reçu(s) sont annulés (rechargé à chacun de ses tours).`,
      `bien`,
    );
  }
  if (combattant.bonusOffensifProchain > 0) {
    const pctBonus = Math.round(combattant.bonusOffensifProchain * 100);
    ajouter(
      `+${pctBonus} % prochain`,
      `Son prochain sort offensif fait +${pctBonus} % de dégâts.`,
      `bien`,
    );
  }
  if (combattant.maxRollCharges > 0) {
    ajouter(
      `Œil affûté ×${combattant.maxRollCharges}`,
      `Ses ${combattant.maxRollCharges} prochain(s) sort(s) font leurs dégâts maximaux.`,
      `bien`,
    );
  }
  if (combattant.paBonusNextTurn !== 0) {
    const pa = combattant.paBonusNextTurn;
    ajouter(`${pa > 0 ? `+` : ``}${pa} PA`, `${pa > 0 ? `+` : ``}${pa} PA à son prochain tour.`);
  }
  if (combattant.estEgide && (combattant.toursRestantsInvocation ?? 0) > 0) {
    ajouter(
      `🛡️ Égide · ${combattant.toursRestantsInvocation} t`,
      `Égide : protège sa ligne, disparaît dans ${combattant.toursRestantsInvocation} tour(s).`,
    );
  }
  return badges;
}
// Effets de la furie d'un boss (FURIE_BOSS, réglée par la difficulté) : court pour le badge
// (« +20 % · +1 PA »), long pour l'infobulle (« +20 % de dégâts, +1 PA, bouclier de 15 % des PV »).
export function texteEffetsFurie(furie) {
  const courts = [];
  const longs = [];
  if (furie?.degatsPct) {
    courts.push(`+${Math.round(furie.degatsPct * 100)} %`);
    longs.push(`+${Math.round(furie.degatsPct * 100)} % de dégâts`);
  }
  if (furie?.pa) {
    courts.push(`+${furie.pa} PA`);
    longs.push(`+${furie.pa} PA`);
  }
  if (furie?.bouclierPct) {
    courts.push(`🛡`);
    longs.push(`bouclier de ${Math.round(furie.bouclierPct * 100)} % des PV`);
  }
  return { court: courts.join(` · `), long: longs.join(`, `) };
}
// niveau de PV pour colorer les barres : « crit » sous 25 %, « bas » sous 50 %
export function niveauPv(pctPv) {
  return pctPv <= 25 ? `crit` : pctPv <= 50 ? `bas` : ``;
}
// la barre du bas est collée en bas de l'écran : on fait défiler la page pour que les cibles restent au-dessus
function degagerCibles() {
  const barre = document.getElementById(`cb-barre`);
  const cartes = cartesCiblables();
  if (!barre || !cartes.length) {
    return;
  }
  const hautBarre = barre.getBoundingClientRect().top;
  const bas = Math.max(...cartes.map((carte) => carte.getBoundingClientRect().bottom));
  const haut = Math.min(...cartes.map((carte) => carte.getBoundingClientRect().top));
  const decalage = Math.min(bas - hautBarre + 10, haut - 8);
  if (decalage > 0) {
    window.scrollBy({ top: decalage, behavior: comportementDefilement() });
  }
}
// Un badge d'état : l'icône à part, pour que le téléphone n'en garde que l'icône sur une ligne
// (texte complet dans la bulle et le récapitulatif) ; l'alerte d'un boss reste écrite en entier.
const ICONE_BADGE = /^(\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*)\s+(.+)$/u;
function htmlBadge(badge) {
  const morceaux = ICONE_BADGE.exec(badge.texte);
  const contenu = morceaux
    ? `<span class="badge-ic">${echapperHtml(morceaux[1])}</span> <span class="badge-txt">${echapperHtml(morceaux[2])}</span>`
    : `<span class="badge-txt badge-seul">${echapperHtml(badge.texte)}</span>`;
  return `<span class="badge${badge.classe ? ` ${badge.classe}` : ``}" data-tip="${echapperHtml(badge.tip)}">${contenu}</span>`;
}
function htmlCarteCombattant(combattant, ciblable) {
  let ko = combattant.pvActuels <= 0;
  let pv = Math.max(0, Math.round(combattant.pvActuels));
  let pctPv =
    combattant.pvMax > 0
      ? Math.max(0, Math.min(100, Math.round((combattant.pvActuels / combattant.pvMax) * 100)))
      : 0;
  let bouclier = Math.round(combattant.bouclier);
  let elementVise =
    combattantActif &&
    combattantActif.camp === `joueur` &&
    combattant.camp === `ennemi` &&
    combattantActif.pvActuels > 0 &&
    combattant.pvActuels > 0
      ? choisirElement(combattantActif, combattant, sortChoisi ?? undefined)
      : null;
  let htmlRes = ELEMENTS.filter(
    (element) =>
      Math.round(resistanceTotale(combattant, element) * 100) !== 0 || element === elementVise,
  )
    .map((element) => {
      let resPct = Math.round(resistanceTotale(combattant, element) * 100);
      return `<span class="res-chip ${resPct < 0 ? `faible` : resPct === 0 ? `zero` : `forte`}${element === elementVise ? ` vise` : ``}" ${element === elementVise ? `data-tip="Résistance ${NOMS_ELEMENTS[element]} · ton élément de frappe contre cette cible (celui qui lui fait le plus mal)"` : `data-tip="Résistance ${NOMS_ELEMENTS[element]}"`}><img src="${IMGS_RESISTANCE[element]}" alt="" onerror="this.remove()" />${resPct > 0 ? `+` : ``}${resPct}%</span>`;
    })
    .join(``);
  let badges = badgesCombattant(combattant);
  let ligne = enLigneAvant(combattant) ? `avant` : `arriere`;
  return `
    <div class="${[
      `carte`,
      combattant.camp === `joueur` ? `carte-joueur` : `carte-ennemi`,
      `ligne-${ligne}`,
      ko ? `ko` : ``,
      combattant.ref === refActive() ? `actif` : ``,
      ciblable ? `ciblable` : ``,
      combattant.archi ? `archi` : ``,
    ]
      .filter(Boolean)
      .join(
        ` `,
      )}" data-ref="${combattant.ref}"${ciblable ? ` tabindex="0" role="button" aria-label="${echapperHtml(libelleCible(combattant))}"` : ``}>
      <div class="carte-tete">
        <span class="carte-nom">${defiCombat?.cible === combattant.ref ? `<span class="badge-defi" data-tip="Cible du défi ${echapperHtml(defiCombat.nom)}">🎯</span>` : ``}${echapperHtml(combattant.nom)}</span>
        <span class="rang rang-${ligne}">${ligne === `avant` ? `AVANT` : `ARR.`}</span>
      </div>
      <div class="portrait-wrap">
        ${combattant.img ? `<img class="portrait" src="${cheminAsset(combattant.img)}" alt="" onerror="this.remove()" />` : `<div class="portrait"></div>`}
        ${badgeArchi(combattant)}
        <span class="pa-gem" title="${combattant.paActuels} / ${combattant.paMax} PA"><img src="${IMG_ETOILE}" alt="" onerror="this.remove()" /><b>${combattant.paActuels}</b></span>
        <span class="pv-gem ${ko ? `ko` : ``} ${bouclier > 0 ? `protege` : ``}" title="${pv} / ${combattant.pvMax} PV${bouclier > 0 ? ` · ${bouclier} bouclier` : ``}" style="--pv-pct:${pctPv}%">
          <img class="pv-vide" src="${IMG_COEUR}" alt="" onerror="this.remove()" />
          <img class="pv-plein" src="${IMG_COEUR}" alt="" onerror="this.remove()" />
          <b class="pv-num">${pv}<span>/${combattant.pvMax}</span></b>
          ${bouclier > 0 ? `<span class="pv-bouclier" title="Bouclier">${bouclier}</span>` : ``}
        </span>
      </div>
      <div class="pv-barre${ko ? ` ko` : ``}${ko ? `` : ` ${niveauPv(pctPv)}`}" style="--pv-pct:${pctPv}%" title="${pv} / ${combattant.pvMax} PV">
        <span class="pv-barre-txt"><span class="pv-coeur">❤ </span>${pv}<span class="pv-max"><span class="pv-esp"> </span>/<span class="pv-esp"> </span>${combattant.pvMax}</span>${bouclier > 0 ? `<span class="pv-bcl"><span class="pv-esp"> · </span>🛡<span class="pv-esp"> </span>${bouclier}</span>` : ``}</span>
        <span class="pa-txt">★ ${combattant.paActuels} PA</span>
      </div>
      ${(() => {
        if (combattant.estEgide) {
          return ``;
        }
        let statsEff = statsEffectives(combattant);
        return `<div class="mini-stats">
        <span class="ms" data-tip="Coup critique (Agilité)"><img src="${IMG_CRITIQUE}" alt="" onerror="this.remove()" />${pctCritique(statsEff)}%</span>
        <span class="ms" data-tip="Dégâts critiques (Agilité)"><img src="${IMG_DMG_CRITIQUE}" alt="" onerror="this.remove()" />${pctDegatsCritiques(statsEff)}%</span>
        <span class="ms" data-tip="Soins (Soin + élément de frappe)"><img src="${IMG_SOIN}" alt="" onerror="this.remove()" />${pctSoin(statsEff, statElement(statsEff, meilleurElement(combattant)))}%</span>
        <span class="ms" data-tip="Dégâts finaux (Intelligence)"><img src="${IMG_PUISSANCE}" alt="" onerror="this.remove()" />${pctPuissanceIntel(statsEff)}%</span>
        ${(combattant.armure ?? 0) > 0 ? `<span class="ms" data-tip="Armure : retranchée de chaque frappe reçue">🪨 ${combattant.armure}</span>` : ``}
      </div>`;
      })()}
      ${combattant.camp === `joueur` && !combattant.estEgide ? `<div class="pp-row" title="Prospection"><img src="${IMG_PP}" alt="" onerror="this.remove()" /><b>${combattant.stats.prospection ?? 0}</b></div>` : ``}
      ${htmlRes && !combattant.estEgide ? `<div class="res-row">${htmlRes}</div>` : ``}
      <div class="badges">${badges.map(htmlBadge).join(``)}</div>
      ${(() => {
        let ap = ciblable ? apercuDegats(combattant) : null;
        if (!ap) {
          return ``;
        }
        let mortel = ap[0] >= combattant.pvActuels + (combattant.bouclier ?? 0);
        let [bas, haut] = pvApresCoup(combattant.pvActuels, combattant.bouclier, ap);
        let reste = mortel
          ? ``
          : ` <span class="cc-apercu-reste">→ ❤ ${bas}${haut !== bas ? `–${haut}` : ``}</span>`;
        return `<div class="cc-apercu${mortel ? ` mortel` : ``}" title="Dégâts prévus du sort (hors critique et esquive)${mortel ? ` : la cible tombe` : ` · PV restants après le coup`}">${mortel ? `☠` : `💥`} ${ap[0]}${ap[1] !== ap[0] ? `–${ap[1]}` : ``}<span class="cc-apercu-mot"> dégâts</span>${reste}</div>`;
      })()}
      ${!ciblable && protegeParLigneAvant(combattant) ? `<span class="cc-protege" data-tip="Protégé par la ligne avant : ce sort vise d'abord un ennemi de devant">🛡 protégé</span>` : ``}
      ${ko ? `<div class="ko-label">K.O.</div>` : ``}
    </div>`;
}
// Libellé d'une cible en visée, pour les lecteurs d'écran : « Zénith sur Chafer, 10-16 dégâts ».
function libelleCible(combattant) {
  if (!sortChoisi) {
    return combattant.nom;
  }
  const ap = apercuDegats(combattant);
  const degats = ap ? `, ${ap[0]}${ap[1] !== ap[0] ? `-${ap[1]}` : ``} dégâts` : ``;
  return `${sortChoisi.nom} sur ${combattant.nom}${degats}`;
}
// En visée d'un sort de ligne : l'ennemi de la ligne arrière est protégé par sa ligne avant.
function sortDeLigne() {
  return (
    sortAmeliore(combattantActif, sortChoisi)?.cible === `ennemi_ligne` &&
    combattantActif &&
    sommeEffets(combattantActif, `ignoreLigne`) <= 0
  );
}
function protegeParLigneAvant(combattant) {
  return (
    sortDeLigne() &&
    combattant.camp !== combattantActif.camp &&
    combattant.pvActuels > 0 &&
    !enLigneAvant(combattant) &&
    !combattant.estLance &&
    combattants.some(
      (allie) =>
        allie.camp === combattant.camp &&
        allie.pvActuels > 0 &&
        enLigneAvant(allie) &&
        !allie.estLance &&
        !allie.estEgide,
    )
  );
}
// Pourquoi une carte n'est pas ciblable par le sort choisi (appui sur une carte refusée).
function raisonCibleRefusee(cible) {
  const sort = sortChoisi;
  const lanceur = combattantActif;
  if (!sort || !lanceur) {
    return ``;
  }
  if (cible.pvActuels <= 0) {
    return `${cible.nom} est K.O.`;
  }
  const visEnnemi = [`ennemi_ligne`, `ennemi_tous`].includes(sort.cible);
  if (visEnnemi && cible.camp === lanceur.camp) {
    return `${cible.nom} est un allié : ce sort vise un ennemi.`;
  }
  if ([`allie`, `allie_tous`].includes(sort.cible) && cible.camp !== lanceur.camp) {
    return `${cible.nom} est un ennemi : ce sort vise un allié.`;
  }
  if (sort.cible === `soi`) {
    return `Ce sort se lance sur ${lanceur.nom} uniquement.`;
  }
  if (cible.estLance) {
    return `La Lance n'est pas une cible.`;
  }
  if (cible.estEgide) {
    return `L'Égide n'est pas une cible.`;
  }
  if (protegeParLigneAvant(cible)) {
    return `${cible.nom} est protégé par la ligne avant : vise d'abord un ennemi de devant.`;
  }
  if (sommeEffets(lanceur, `tetanise`) > 0 && !enLigneAvant(cible) && cible.camp !== lanceur.camp) {
    return `${lanceur.nom} est tétanisé : il ne peut viser que la ligne avant.`;
  }
  if (
    (sort.cooldown && (lanceur.cooldowns[`${sort.id}:${cible.ref}`] ?? 0) > 0) ||
    (sort.maxParCibleParTour &&
      (lanceur.lancersCeTour?.[`${sort.id}:${cible.ref}`] ?? 0) >= sort.maxParCibleParTour)
  ) {
    return `${cible.nom} a déjà été visé par ${sort.nom} : choisis une autre cible.`;
  }
  if (sort.transfertPvPct && cible.ref === lanceur.ref) {
    return `${lanceur.nom} ne peut pas se viser lui-même avec ce sort.`;
  }
  return `${cible.nom} ne peut pas être visé par ${sort.nom}.`;
}
// Sur téléphone : si aucune cible du sort choisi n'est visible (cachée par la barre des sorts ou
// hors de l'écran), on fait défiler jusqu'à elles.
function montrerCibles() {
  const cartes = [...racine.querySelectorAll(`.carte.ciblable`)];
  if (!cartes.length) {
    return;
  }
  // téléphone : l'écran tient sans défiler, seule la zone des ennemis peut défiler (grand texte)
  const zone = cartes[0].closest(`.colonne`);
  if (zone && zone.scrollHeight > zone.clientHeight + 1) {
    const cadreZone = zone.getBoundingClientRect();
    const dedans = (carte) => {
      const cadreCarte = carte.getBoundingClientRect();
      return cadreCarte.top >= cadreZone.top - 1 && cadreCarte.bottom <= cadreZone.bottom + 1;
    };
    if (!cartes.some(dedans)) {
      cartes[0].scrollIntoView({ block: `nearest` });
    }
    return;
  }
  const barre = document.getElementById(`cb-barre`)?.getBoundingClientRect();
  const bas = barre && barre.top > 0 && barre.top < innerHeight ? barre.top : innerHeight;
  const visible = (carte) => {
    const cadreCarte = carte.getBoundingClientRect();
    return cadreCarte.top >= 0 && cadreCarte.bottom <= bas;
  };
  if (cartes.some(visible)) {
    return;
  }
  const cadre = cartes[0].getBoundingClientRect();
  window.scrollTo({
    top: Math.max(0, scrollY + cadre.top - Math.max(8, (bas - cadre.height) / 2)),
  });
}
function rendreCombat() {
  if (!racine) {
    return;
  }
  masquerElements();
  // calculées une seule fois par rendu, puis passées à la frise et à la barre des sorts
  let cibles =
    combattantActif && sortChoisi ? ciblesValides(combattantActif, sortChoisi, combattants) : [];
  let estCiblable = (combattant) => cibles.some((cible) => cible.ref === combattant.ref);
  let htmlCamp = (camp) => {
    let membres = combattants
      .filter((combattant) => combattant.camp === camp)
      .sort((premier, second) => premier.position - second.position);
    // téléphone : lignes côte à côte (peu de combattants) ou l'une sous l'autre, en grille
    let cote = membres.length <= (camp === `joueur` ? 4 : 3);
    let htmlLigne = (libelle, cartes, avant) => {
      let nbPieges = compterPieges(camp, avant);
      let n = cartes.length;
      let colonnes = cote ? n : n <= 3 ? n : n === 4 && camp === `ennemi` ? 2 : n === 4 ? 4 : 3;
      let dense = cote ? membres.length >= 4 : colonnes >= 4;
      return `<div class="ligne-col${n ? `` : ` vide`}" style="--n:${Math.max(1, n)};--cols:${Math.max(1, colonnes)}">
         <span class="ligne-label">${libelle}${nbPieges > 0 ? `<span class="piege-indicateur" tabindex="0" data-tip="${echapperHtml(AIDE_PIEGE)}">🪤 ×${nbPieges}</span>` : ``}</span>
         <div class="ligne-cards${dense ? ` dense` : ``}">${cartes.map((carte) => htmlCarteCombattant(carte, estCiblable(carte))).join(``) || `<span class="ligne-vide">—</span>`}</div>
       </div>`;
    };
    let htmlAvant = htmlLigne(
      `<span class="ligne-mot">Ligne </span>avant`,
      membres.filter(enLigneAvant),
      true,
    );
    let htmlArriere = htmlLigne(
      `<span class="ligne-mot">Ligne </span>arrière`,
      membres.filter((carte) => !enLigneAvant(carte)),
      false,
    );
    let separateur = `<img class="ligne-sep" src="${cheminAsset(`/assets/divers/delimiter.png`)}" alt="" onerror="this.remove()" />`;
    return `<div class="camp-lignes ${camp} ${cote ? `cote` : `pile`}">${camp === `joueur` ? htmlArriere + separateur + htmlAvant : htmlAvant + separateur + htmlArriere}</div>`;
  };
  combatEnCours ||=
    ((racine.innerHTML = `
      <div class="combat">
        <h1 class="sr-only">Combat : ${echapperHtml(titreCombat)}</h1>
        <div class="cb-entete">
          <h2 class="titre-combat" aria-hidden="true">${echapperHtml(titreCombat)}</h2>
          <div id="cb-pastilles" class="cb-pastilles"></div>
        </div>
        <div class="affixes-combat">${(optionsVue.affixes ?? []).map((affixe) => `<span class="affixe-pastille" tabindex="0" data-tip="${echapperHtml(affixe.desc)}">⚔ ${echapperHtml(affixe.nom)}</span>`).join(``)}</div>
        <div id="cb-defi"></div>
        <div id="cb-timeline"></div>
        <div class="plateau">
          <div class="colonne">
            <h3>Équipe</h3>
            <div id="cb-joueur" class="camp-host"></div>
          </div>
          <div class="colonne">
            <h3>Ennemis <span class="hint">(les sorts de ligne visent la ligne avant tant qu'elle tient)</span></h3>
            <div id="cb-ennemi" class="camp-host"></div>
          </div>
        </div>
        <div class="zone-bas">
          <div id="journal" class="journal" role="log" aria-live="polite" aria-label="Journal de combat"></div>
          <div id="cb-barre" class="barre-sorts"></div>
        </div>
      </div>`),
    installerEcouteursPlateau(),
    installerEcouteursBarre(),
    true);
  let injecter = (id, html) => {
    let element = document.getElementById(id);
    if (element) {
      element.innerHTML = html;
    }
  };
  injecter(`cb-defi`, htmlDefi());
  injecter(`cb-pastilles`, htmlPastilles());
  injecter(`cb-timeline`, htmlTimeline(cibles));
  injecter(`cb-joueur`, htmlCamp(`joueur`));
  injecter(`cb-ennemi`, htmlCamp(`ennemi`));
  injecter(`cb-barre`, htmlBarreSorts(cibles));
  racine.querySelector(`.combat`)?.classList.toggle(`ciblage`, !!(combattantActif && sortChoisi));
  document.getElementById(`journal`)?.classList.toggle(`deplie`, journalDeplie);
  rafraichirJournal();
  if (combattantActif && sortChoisi) {
    montrerCibles();
    marquerVisee();
    degagerCibles();
    racine.querySelectorAll(`.carte.ciblable, .tl-pastille.ciblable`).forEach((carte) => {
      // en visée, tout appui sur la carte (résistance, badge compris) lance le sort : les bulles
      // restent lisibles hors visée
      carte.addEventListener(`click`, () => {
        terminerAction({
          sort: sortChoisi,
          cibleRef: carte.dataset.ref,
        });
      });
    });
    racine.querySelectorAll(`.carte.ciblable`).forEach((carte) => {
      carte.addEventListener(`focus`, () => {
        refVisee = carte.dataset.ref;
        marquerVisee();
      });
    });
    if (!sansCibleAChoisir(sortChoisi)) {
      racine.querySelectorAll(`.carte:not(.ciblable)`).forEach((carte) => {
        carte.addEventListener(`click`, (ev) => {
          const combattant = combattants.find((candidat) => candidat.ref === carte.dataset.ref);
          const zone = document.getElementById(`aide-refus`);
          if (!combattant || !zone || ev.target.closest(`.badge, [data-tip]`)) {
            return;
          }
          zone.textContent = `⛔ ${raisonCibleRefusee(combattant)}`;
          zone.hidden = false;
        });
      });
    }
  }
  suivreTourActif();
  if (refRecap) {
    majRecapEffets();
  }
  racine.querySelectorAll(`[data-ref]`).forEach((element) => {
    let ref = element.dataset.ref;
    let lies = () => racine.querySelectorAll(`[data-ref="${ref}"]`);
    element.addEventListener(`mouseenter`, () =>
      lies().forEach((lie) => lie.classList.add(`lie-survol`)),
    );
    element.addEventListener(`mouseleave`, () =>
      lies().forEach((lie) => lie.classList.remove(`lie-survol`)),
    );
  });
}
// Écouteurs posés une fois par combat sur la coquille (les zones internes sont re-rendues).
function installerEcouteursPlateau() {
  const combat = racine.querySelector(`.combat`);
  document.getElementById(`journal`)?.addEventListener(`click`, (ev) => {
    if (!ecranEtroit()) {
      return;
    }
    const journal = ev.currentTarget;
    journalDeplie = !journalDeplie;
    journal.classList.toggle(`deplie`, journalDeplie);
    journal.scrollTop = journal.scrollHeight;
  });
  // clic droit pendant la visée : l'annule
  combat?.addEventListener(`contextmenu`, (ev) => {
    if (sortChoisi && contexteCombat) {
      ev.preventDefault();
      sortChoisi = null;
      rendreCombat();
    }
  });
  // premier clic sur le plateau : la boîte des objectifs laisse la place
  combat?.querySelector(`.plateau`)?.addEventListener(`click`, replierObjectifs);
  // hors visée, un appui sur une carte (ailleurs que sur une bulle) ou sur la pastille d'un héros
  // de la barre du bas ouvre le récapitulatif de ses effets (phase de capture : en visée, l'appui
  // lance le sort et `sortChoisi` est encore là quand on le regarde)
  combat?.addEventListener(
    `click`,
    (ev) => {
      if (sortChoisi) {
        return;
      }
      const pastille = ev.target.closest?.(`.em-heros[data-heros]`);
      const carte = ev.target.closest?.(`.carte[data-ref]`);
      if (pastille) {
        ouvrirRecapEffets(pastille.dataset.heros);
      } else if (carte && !ev.target.closest(`[data-tip], button, a`)) {
        ouvrirRecapEffets(carte.dataset.ref);
      }
    },
    true,
  );
  combat?.addEventListener(`keydown`, (ev) => {
    const pastille = ev.target.closest?.(`.em-heros[data-heros]`);
    if (pastille && (ev.key === `Enter` || ev.key === ` `)) {
      ev.preventDefault();
      ev.stopPropagation();
      ouvrirRecapEffets(pastille.dataset.heros);
    }
  });
}
// Au changement de tour : la frise garde la pastille active visible (téléphone), et la carte du
// héros qui commence son tour n'est plus cachée par la barre des sorts.
function suivreTourActif() {
  const ref = refActive();
  if (ref === derniereRefRendue) {
    return;
  }
  derniereRefRendue = ref;
  const pastille = racine.querySelector(`.tl-pastille.actif`);
  const liste = pastille?.closest(`.timeline`);
  if (!pastille || !liste) {
    return;
  }
  for (const conteneur of [pastille.parentElement, liste]) {
    if (conteneur.scrollWidth > conteneur.clientWidth + 1) {
      const cadrePastille = pastille.getBoundingClientRect();
      const cadreConteneur = conteneur.getBoundingClientRect();
      conteneur.scrollLeft +=
        cadrePastille.left +
        cadrePastille.width / 2 -
        (cadreConteneur.left + cadreConteneur.width / 2);
    }
  }
}
function initiativeEffective(combattant) {
  return (
    combattant.initiative +
    combattant.effets
      .filter((effet) => effet.stat === `initiative`)
      .reduce((acc, item) => acc + item.valeur, 0)
  );
}
function htmlTimeline(ciblesRendu) {
  let parRef = new Map(combattants.map((combattant) => [combattant.ref, combattant]));
  let ordre = ordreDeJeu(combattants)
    .map((ref) => parRef.get(ref))
    .filter((combattant) => !!combattant && combattant.pvActuels > 0);
  if (ordre.length < 2) {
    return ``;
  }
  let cibles = ciblesRendu;
  const actif = refActive();
  return `<div class="timeline"><span class="tl-ronde" title="Ronde en cours : chacun joue une fois par ronde">Ronde ${numeroRonde}</span><div class="tl-liste">${ordre
    .map((combattant) => {
      let camp = combattant.camp;
      let classeEtat =
        combattant.ref === actif ? `actif` : dejaJoues.has(combattant.ref) ? `deja-joue` : ``;
      let classeCible = cibles.some((cible) => cible.ref === combattant.ref) ? `ciblable` : ``;
      let contenu = combattant.img
        ? `<img src="${cheminAsset(combattant.img)}" alt="" onerror="this.remove()" />`
        : `<span class="tl-ini">${initiativeEffective(combattant)}</span>`;
      return `<div class="tl-pastille ${camp} ${classeEtat} ${classeCible}" data-ref="${combattant.ref}" title="${echapperHtml(combattant.nom)} · init ${initiativeEffective(combattant)}">${contenu}</div>`;
    })
    .join(``)}</div></div>`;
}
// Bouton d'un sort : un sort indisponible reste appuyable (aria-disabled) pour lire sa raison.
function htmlBoutonSort(lanceur, sort, touche, icone, arme = false) {
  const raison = raisonIndisponible(lanceur, sort, combattants);
  const recharge = lanceur.cooldowns[sort.id] ?? 0;
  const max = sort.maxParTour ?? 0;
  const lances = lanceur.lancersCeTour?.[sort.id] ?? 0;
  let etiquette = ``;
  if (raison?.startsWith(`PA`)) {
    etiquette = `PA`;
  } else if (raison?.startsWith(`Déjà lancé`)) {
    etiquette = `${lances}/${max}`;
  } else if (raison === `Pas au 1er tour`) {
    etiquette = `1er t.`;
  } else if (!raison && max >= 2) {
    etiquette = `${max - lances}/${max}`;
  }
  const libelle = `${sort.nom}${arme ? `, attaque d'arme` : ``}${lanceur.ameliorations?.[sort.id]?.length ? `, amélioré` : ``}${
    raison ? ` : ${raison}` : max >= 2 ? ` : ${max - lances}/${max} lancers restants` : ``
  }`;
  const classes = [
    `sort`,
    sortChoisi?.id === sort.id ? `choisi` : ``,
    infoSort?.id === sort.id ? `info` : ``,
    recharge > 0 ? `cooldown` : ``,
    raison ? `indispo` : ``,
  ]
    .filter(Boolean)
    .join(` `);
  return `<button class="${classes}" ${arme ? `data-arme="1"` : `data-sort="${sort.id}"`} aria-label="${echapperHtml(libelle)}"${raison ? ` aria-disabled="true"` : ``}>
        <span class="sort-touche">${touche}</span>
        <span class="sort-pa-badge"><img src="${IMG_ETOILE}" alt="" onerror="this.remove()" /><b>${coutPA(sort, lanceur)}</b></span>
        ${icone}
        ${pastilleElementSort(sort, lanceur)}
        ${lanceur.ameliorations?.[sort.id]?.length ? `<span class="sort-amelio" aria-hidden="true">⬆</span>` : ``}
        ${recharge > 0 ? `<span class="sort-cd" title="Rechargement : ${recharge} tour(s)">${recharge}</span>` : ``}
        ${etiquette ? `<span class="sort-etiquette${raison ? `` : ` dispo`}">${echapperHtml(etiquette)}</span>` : ``}
      </button>`;
}
// Confirmation de « Fin du tour » sur tactile : valable pour ce héros et ce nombre de PA seulement.
let finTourArme = null;
let minuteurFinTour = null;
const finTourConfirme = () =>
  !!finTourArme &&
  combattantActif?.ref === finTourArme.ref &&
  combattantActif.paActuels === finTourArme.pa;
// Un seul écouteur délégué sur la barre des sorts : ses boutons sont redessinés à chaque rendu,
// donc rien à rebrancher (et jamais d'écouteur en double si deux rendus se suivent).
function installerEcouteursBarre() {
  document.getElementById(`cb-barre`)?.addEventListener(`click`, (ev) => {
    const bouton = ev.target.closest?.(`button`);
    if (!bouton) {
      return;
    }
    if (bouton.matches(`button.sort[data-sort]`)) {
      choisirSort(SORTS[bouton.dataset.sort]);
    } else if (bouton.matches(`button.sort[data-arme]`)) {
      if (combattantActif?.armeSort) {
        choisirSort(combattantActif.armeSort);
      }
    } else if (bouton.id === `fin-tour`) {
      // tactile : s'il reste des PA et un sort jouable, un 1er appui demande confirmation (3 s)
      if (
        ecranTactile() &&
        !finTourConfirme() &&
        combattantActif &&
        peutEncoreJouer(combattantActif, combattants) &&
        combattantActif.paActuels > 0
      ) {
        finTourArme = { ref: combattantActif.ref, pa: combattantActif.paActuels };
        clearTimeout(minuteurFinTour);
        minuteurFinTour = setTimeout(() => {
          finTourArme = null;
          if (racine && combatEnCours) {
            rendreCombat();
          }
        }, 3000);
        rendreCombat();
        return;
      }
      clearTimeout(minuteurFinTour);
      finTourArme = null;
      terminerAction(null);
    } else if (bouton.id === `auto-tour`) {
      basculerAuto();
    } else if (bouton.id === `vitesse-combat`) {
      parametres.combatRapide = !parametres.combatRapide;
      sauverParametres(parametres);
      bouton.classList.toggle(`on`, parametres.combatRapide);
      bouton.setAttribute(`aria-pressed`, String(parametres.combatRapide));
    } else if (bouton.id === `sort-lancer`) {
      if (sortChoisi) {
        lancerSurSoi(sortChoisi);
      }
    } else if (bouton.id === `sort-info`) {
      aideDepliee = !aideDepliee;
      rendreCombat();
    } else if (bouton.id === `sort-annuler`) {
      sortChoisi = null;
      infoSort = null;
      rendreCombat();
    } else if (bouton.id === `sort-lancer-cible`) {
      lancerSurVisee();
    }
  });
}
// Bouton 🤖 (réglage « Jeu automatique ») : lance l'auto, puis ⏹ l'arrête.
function htmlBoutonAuto() {
  if (parametres.modeAuto === `cache` && !autoJeu) {
    return ``;
  }
  const actif = !!autoJeu;
  const titre = actif
    ? `Arrêter le jeu automatique`
    : parametres.modeAuto === `combat`
      ? `Jeu automatique de toute l'équipe jusqu'à la fin du combat (réglable dans les Paramètres)`
      : `Jouer ce tour automatiquement (réglable dans les Paramètres)`;
  return `<button id="auto-tour" class="secondaire auto-tour${actif ? ` on` : ``}" title="${titre}" aria-label="${titre}" aria-pressed="${actif}">${actif ? `⏹` : `🤖`}</button>`;
}
function htmlBarreSorts(ciblesRendu) {
  if (!combattantActif) {
    // tour d'un monstre ou d'une créature : on montre qui joue, à la place des sorts
    const joueur = combattants.find(
      (combattant) => combattant.ref === refTourEnCours && combattant.pvActuels > 0,
    );
    if (!joueur) {
      return `<div class="attente">En attente…</div>`;
    }
    return `<div class="attente attente-tour ${joueur.camp}">
      ${joueur.img ? `<img class="attente-portrait" src="${cheminAsset(joueur.img)}" alt="" onerror="this.remove()" />` : ``}
      <span>Tour de <b>${echapperHtml(joueur.nom)}</b>…</span>
      ${autoJeu ? htmlBoutonAuto() : ``}
    </div>`;
  }
  let lanceur = combattantActif;
  let armeSort = lanceur.armeSort;
  let htmlSorts =
    (armeSort
      ? htmlBoutonSort(
          lanceur,
          armeSort,
          1,
          `<span class="sort-icon-wrap"><img class="sort-icon" src="${armeSort.img ? cheminAsset(armeSort.img) : ``}" alt="" onerror="this.closest('.sort-icon-wrap')?.remove()" /></span>`,
          true,
        )
      : `<div class="sort sort-cac" title="Corps à corps, aucune arme équipée">
        <span class="sort-touche">1</span>
        <span class="sort-icon-vide">🗡️</span>
      </div>`) +
    lanceur.sorts
      .map((idSort) => SORTS[idSort])
      .map((sort, indice) =>
        htmlBoutonSort(
          lanceur,
          sort,
          indice + 2,
          `<span class="sort-icon-wrap"${attrElementSort(sort, lanceur)}><span class="sort-nom-fallback">${echapperHtml(sort.nom)}</span><img class="sort-icon" src="${iconeSort(sort.id)}" alt="" onerror="this.closest('.sort-icon-wrap')?.classList.add('noicon'); this.remove()" /></span>`,
        ),
      )
      .join(``);
  let htmlAide;
  if (autoEnCours(lanceur)) {
    htmlAide = `<div class="aide aide-auto" role="status">🤖 <b>${echapperHtml(lanceur.nom)}</b> joue tout seul${autoJeu?.combat ? ` (toute l'équipe, jusqu'à la fin du combat)` : ` ce tour`} · touche ⏹ pour reprendre la main</div>`;
  } else if (sortChoisi) {
    const cibles = sansCibleAChoisir(sortChoisi)
      ? []
      : ciblesRendu.filter((cible) => cible.pvActuels > 0);
    const clavier = ecranTactile()
      ? ``
      : `<span class="aide-clavier"><kbd>←</kbd>/<kbd>→</kbd> cible · <kbd>Entrée</kbd> lancer</span>`;
    let consigne;
    if (sansCibleAChoisir(sortChoisi)) {
      consigne = `<button id="sort-lancer" class="primaire">Lancer ${echapperHtml(sortChoisi.nom)}</button>`;
    } else if (cibles.length === 1 && ecranTactile()) {
      // une seule cible : un bouton suffit, sans chercher la carte sur l'écran
      consigne = `<button id="sort-lancer-cible" class="primaire">Lancer sur ${echapperHtml(cibles[0].nom)}</button>`;
    } else {
      consigne = `<span class="aide-consigne">Choisis une cible${sortDeLigne() ? ` (ligne avant)` : ``} pour <b>${echapperHtml(sortChoisi.nom)}</b>. ${clavier}</span>`;
    }
    htmlAide = `<div class="aide aide-sort${aideDepliee ? ` deplie` : ``}">
      <div class="aide-sort-tete">${consigne}<button id="sort-info" class="secondaire sort-info" aria-label="Détails du sort" aria-pressed="${aideDepliee}">ⓘ</button><button id="sort-annuler" class="secondaire">Annuler</button></div>
      <div id="aide-refus" class="aide-refus" role="status" hidden></div>
      <div class="aide-sort-detail">${infobulleSort(sortChoisi, lanceur)}</div>
    </div>`;
  } else if (infoSort) {
    const raison = raisonIndisponible(lanceur, infoSort, combattants);
    htmlAide = `<div class="aide aide-sort aide-indispo deplie">
      <div class="aide-sort-tete"><span class="aide-consigne">⛔ <b>${echapperHtml(infoSort.nom)}</b>${raison ? ` : ${echapperHtml(raison)}` : ``}</span><button id="sort-annuler" class="secondaire">Fermer</button></div>
      <div class="aide-sort-detail">${infobulleSort(infoSort, lanceur)}</div>
    </div>`;
  } else {
    htmlAide = `<div class="aide">Tour de <b>${echapperHtml(lanceur.nom)}</b> : choisis un sort · <span class="aide-pa">${lanceur.paActuels}/${lanceur.paMax} PA</span></div>`;
  }
  // PV des héros toujours visibles (téléphone) : la barre recouvre les cartes de l'équipe
  const equipeMini = combattants
    .filter((combattant) => combattant.camp === `joueur`)
    .map((combattant) => {
      const pctPvCombattant =
        combattant.pvMax > 0
          ? Math.max(0, Math.min(100, Math.round((combattant.pvActuels / combattant.pvMax) * 100)))
          : 0;
      const marqueurs = marqueursEffets(combattant, badgesCombattant(combattant));
      return `<span class="em-heros${combattant.pvActuels <= 0 ? ` mort` : ` ${niveauPv(pctPvCombattant)}`}${combattant === lanceur ? ` actif` : ``}" data-heros="${combattant.ref}" style="--pv-pct:${pctPvCombattant}%" role="button" tabindex="0" aria-label="${echapperHtml(`${combattant.nom} : ${Math.max(0, Math.round(combattant.pvActuels))} / ${combattant.pvMax} PV, voir ses effets`)}"><b>${echapperHtml(combattant.nom)}</b> <span class="em-pv">${Math.max(0, Math.round(combattant.pvActuels))}/${combattant.pvMax}</span>${marqueurs ? `<span class="em-effets">${echapperHtml(marqueurs)}</span>` : ``}</span>`;
    })
    .join(``);
  return `
    <div class="equipe-mini" aria-label="Équipe : PV et effets">${equipeMini}</div>
    <div class="sorts-rangee">
      <div class="sorts-zone"><div class="sorts-liste">${htmlSorts}</div></div>
      <div class="barre-actions-fin">${htmlBoutonAuto()}<button id="vitesse-combat" class="secondaire vitesse-combat${parametres.combatRapide ? ` on` : ``}" title="Tours des monstres rapides (aussi dans les Paramètres)" aria-pressed="${!!parametres.combatRapide}">⏩</button><button id="fin-tour" class="fin-tour primaire${finTourConfirme() ? ` confirme` : ``}" title="Terminer le tour"><span class="fin-tour-txt">${finTourConfirme() ? `Encore ${lanceur.paActuels} PA : confirmer` : `Fin du tour`}</span> <kbd>${echapperHtml(nomTouche(parametres.toucheFinTour))}</kbd></button></div>
    </div>
    ${htmlAide}`;
}
