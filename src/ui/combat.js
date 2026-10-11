import { SORTS } from "../data/index.js";
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
import { ETATS_CLASSE, ICONES_MARQUES } from "../combat/classes.js";
import { nomTouche, sauverParametres } from "../sauvegarde/parametres.js";
import { replierObjectifsCombat } from "./objectifs.js";
import {
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
const ecranEtroit = () => window.matchMedia?.(`(max-width: 700px)`).matches ?? false;
const refActive = () => combattantActif?.ref ?? refTourEnCours;
function replierObjectifs() {
  if (!objectifsReplies) {
    objectifsReplies = true;
    replierObjectifsCombat();
  }
}
export function installerRaccourcisCombat() {
  document.addEventListener(`keydown`, (e) => {
    if (!contexteCombat || !combattantActif || e.repeat || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    if (e.key === parametres.toucheFinTour) {
      // Espace sur un sort ou un bouton qui a le focus l'active : il ne doit pas finir le tour
      if (
        document.activeElement?.closest(`button, a[href], input, textarea, select, [role="button"]`)
      ) {
        return;
      }
      e.preventDefault();
      terminerAction(null);
      return;
    }
    if (e.key === `Escape` && (sortChoisi || infoSort)) {
      sortChoisi = null;
      infoSort = null;
      rendreCombat();
      return;
    }
    if (sortChoisi && !sansCibleAChoisir(sortChoisi)) {
      if (e.key === `ArrowLeft` || e.key === `ArrowRight` || e.key === `Tab`) {
        e.preventDefault();
        deplacerVisee(e.key === `ArrowLeft` || (e.key === `Tab` && e.shiftKey) ? -1 : 1);
        return;
      }
      // Entrée sur un bouton de l'aide (Annuler, ⓘ…) garde son effet habituel
      if (e.key === `Enter` && !document.activeElement?.closest?.(`.aide button, #fin-tour`)) {
        e.preventDefault();
        lancerSurVisee();
        return;
      }
    }
    let t = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (t) {
      let n = Number(t[1]);
      let r = n === 1 ? combattantActif.armeSort : SORTS[combattantActif.sorts[n - 2]];
      if (r) {
        e.preventDefault();
        choisirSort(r, true);
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
  if (!cartes.some((c) => c.dataset.ref === refVisee)) {
    // par défaut : la première cible que le sort achève, sinon la première
    const mortelle = cartes.find((c) => c.querySelector(`.cc-apercu.mortel`));
    refVisee = (mortelle ?? cartes[0])?.dataset.ref ?? null;
  }
  for (const c of cartes) {
    c.classList.toggle(`visee`, c.dataset.ref === refVisee);
    c.classList.toggle(`unique`, cartes.length === 1);
  }
}
function deplacerVisee(pas) {
  const cartes = cartesCiblables();
  if (!cartes.length) {
    return;
  }
  const i = cartes.findIndex((c) => c.dataset.ref === refVisee);
  refVisee = cartes[(i + pas + cartes.length) % cartes.length].dataset.ref;
  marquerVisee();
  const c = cartes.find((x) => x.dataset.ref === refVisee);
  c?.focus({ preventScroll: true });
  c?.scrollIntoView({ block: `nearest`, inline: `nearest` });
}
function lancerSurVisee() {
  const c = racine?.querySelector(`.carte.ciblable.visee`);
  if (!c || !sortChoisi) {
    return false;
  }
  terminerAction({ sort: sortChoisi, cibleRef: c.dataset.ref });
  return true;
}
export function installerInfobulleSorts() {
  let e = document.createElement(`div`);
  e.className = `sort-tip`;
  e.style.display = `none`;
  document.body.appendChild(e);
  elementsAMasquer.push(e);
  let t = (t) => {
    let n = t.dataset.arme
      ? combattantActif?.armeSort
      : t.dataset.sort
        ? SORTS[t.dataset.sort]
        : null;
    if (!n) {
      return;
    }
    let raison = combattantActif ? raisonIndisponible(combattantActif, n, combattants) : null;
    e.innerHTML =
      infobulleSort(n, combattantActif) +
      (raison ? `<div class="tip-indispo">⛔ ${echapperHtml(raison)}</div>` : ``);
    e.style.display = `block`;
    let r = t.getBoundingClientRect();
    let i = e.getBoundingClientRect();
    let a = r.left + r.width / 2 - i.width / 2;
    a = Math.max(8, Math.min(a, window.innerWidth - i.width - 8));
    let o = r.top - i.height - 10;
    if (o < 8) {
      o = r.bottom + 10;
    }
    e.style.left = `${a}px`;
    e.style.top = `${o}px`;
  };
  document.addEventListener(`mouseover`, (e) => {
    let n = e.target.closest?.(`button.sort[data-sort], button.sort[data-arme]`);
    // le sort choisi est déjà détaillé dans l'aide : pas d'infobulle qui cacherait les cibles
    if (n && !n.classList.contains(`choisi`)) {
      t(n);
    }
  });
  document.addEventListener(`mouseout`, (t) => {
    let n = t.target.closest?.(`button.sort[data-sort], button.sort[data-arme]`);
    if (n && !n.contains(t.relatedTarget)) {
      e.style.display = `none`;
    }
  });
}
function peutEncoreJouer(e, t) {
  // l'attaque d'arme compte aussi : sans elle, un héros à qui il ne reste que les PA
  // de son arme voyait son tour passé automatiquement
  return [e.armeSort, ...e.sorts.map((e) => SORTS[e])]
    .filter(Boolean)
    .some((n) => !raisonIndisponible(e, n, t));
}
function htmlLigneJournal(e) {
  let t = `info`;
  if (e.msg.startsWith(`▶`)) {
    t = `tour`;
  } else if (/dégâts|inflige|subit|meurt|perd/i.test(e.msg)) {
    t = `degats`;
  } else if (/récupère|soigne|soin|PV rendus|bouclier/i.test(e.msg)) {
    t = `soin`;
  } else if (/poison|empoisonne|☠/i.test(e.msg)) {
    t = `poison`;
  }
  let n = echapperHtml(e.msg);
  if (e.meta?.portion) {
    let t = echapperHtml(e.meta.portion);
    n = n.replace(t, `<span class="log-el el-${e.meta.element}">${t}</span>`);
  }
  return `<div class="log-line log-${t}">${n}</div>`;
}
function rafraichirJournal() {
  let e = document.getElementById(`journal`);
  if (e) {
    // ne recolle en bas que si le joueur y était déjà : on peut remonter lire pendant un tour
    const enBas = e.scrollHeight - e.scrollTop - e.clientHeight < 12;
    e.innerHTML = journalCombat.map(htmlLigneJournal).join(``);
    if (enBas) {
      e.scrollTop = e.scrollHeight;
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
    dejaJoues.add(meta.tour);
    refTourEnCours = meta.tour;
  }
  journalCombat.push({
    msg,
    meta,
  });
  if (journalCombat.length > 200) {
    journalCombat.shift();
  }
  rafraichirJournal();
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
  const e = etatDefiCombat ?? { etat: `en_cours` };
  const [icone, libelle] = ETATS_DEFI[e.etat] ?? ETATS_DEFI.en_cours;
  return `<div class="defi-combat defi-${e.etat}" title="Réussis le défi pour gagner +30 % d'XP et de kamas">
    <span class="defi-nom">🎯 Défi ${echapperHtml(defiCombat.nom)}</span>
    <span class="defi-texte">${echapperHtml(defiCombat.texte)}</span>
    <span class="defi-etat">${icone ? `${icone} ` : ``}${libelle}${e.detail ? ` · ${echapperHtml(e.detail)}` : ``}</span>
    <small class="defi-bonus">+30 % XP et kamas</small>
  </div>`;
}
export function initialiserVueCombat(e, t, n = null, options = {}) {
  optionsVue = options;
  defiCombat = null;
  etatDefiCombat = null;
  combattants = e;
  titreCombat = t;
  resolveurAction = n;
  journalCombat = [];
  combattantActif = null;
  sortChoisi = null;
  infoSort = null;
  refVisee = null;
  refTourEnCours = null;
  dejaJoues = new Set();
  numeroRonde = 1;
  derniereRefRendue = null;
  objectifsReplies = false;
  combatEnCours = false;
  rendreCombat();
  memoriserEtats(e);
}
export function rafraichirCombat() {
  rendreCombat();
  jouerAnimationsFx();
}
const etatsPrecedents = new Map();
let coucheFx = null;
let compteurFx = 0;
const evenementsFx = new Map();
export function enregistrerFx(e) {
  let t = evenementsFx.get(e.ref) ?? {};
  if (e.type === `crit`) {
    t.crit = true;
  }
  if (e.type === `esquive`) {
    t.esquive = true;
  }
  evenementsFx.set(e.ref, t);
}
function obtenirCoucheFx() {
  if (!coucheFx || !coucheFx.isConnected) {
    coucheFx = document.createElement(`div`);
    coucheFx.className = `fx-layer`;
    document.body.appendChild(coucheFx);
  }
  return coucheFx;
}
function memoriserEtats(e) {
  etatsPrecedents.clear();
  for (let t of e) {
    etatsPrecedents.set(t.ref, {
      pv: t.pvActuels,
      bouclier: t.bouclier,
      mort: t.pvActuels <= 0,
    });
  }
}
function afficherNombreFx(ref, t, n) {
  let r = racine.querySelector(`.carte[data-ref="${ref}"]`);
  if (!r) {
    return;
  }
  let i = r.getBoundingClientRect();
  let a = document.createElement(`div`);
  a.className = `fx-num ${n}`;
  a.textContent = t;
  let o = (compteurFx++ % 3) * 16 - 16;
  a.style.left = `${i.left + i.width / 2 + o}px`;
  a.style.top = `${i.top + i.height * 0.32}px`;
  a.addEventListener(`animationend`, () => a.remove());
  obtenirCoucheFx().appendChild(a);
}
function afficherFlashFx(ref) {
  let t = racine.querySelector(`.carte[data-ref="${ref}"]`);
  if (!t) {
    return;
  }
  let n = t.getBoundingClientRect();
  let r = document.createElement(`div`);
  r.className = `fx-flash`;
  r.style.left = `${n.left}px`;
  r.style.top = `${n.top}px`;
  r.style.width = `${n.width}px`;
  r.style.height = `${n.height}px`;
  r.addEventListener(`animationend`, () => r.remove());
  obtenirCoucheFx().appendChild(r);
}
function jouerAnimationsFx() {
  for (let e of combattants) {
    let t = etatsPrecedents.get(e.ref);
    if (!t) {
      continue;
    }
    let n = Math.max(0, t.pv - e.pvActuels) + Math.max(0, t.bouclier - e.bouclier);
    let r = Math.max(0, e.pvActuels - t.pv);
    let i = Math.max(0, e.bouclier - t.bouclier);
    let a = evenementsFx.get(e.ref);
    if (n > 0) {
      if (a?.crit) {
        afficherNombreFx(e.ref, `-${n} !`, `crit`);
      } else {
        afficherNombreFx(e.ref, `-${n}`, `dmg`);
      }
      afficherFlashFx(e.ref);
    }
    if (a?.esquive) {
      afficherNombreFx(e.ref, `Esquive !`, `esquive`);
    }
    if (r > 0) {
      afficherNombreFx(e.ref, `+${r}`, `soin`);
    }
    if (i > 0) {
      afficherNombreFx(e.ref, `+${i}`, `bouclier`);
    }
    if (!t.mort && e.pvActuels <= 0) {
      afficherNombreFx(e.ref, `K.O.`, `mort`);
    }
  }
  evenementsFx.clear();
  memoriserEtats(combattants);
}
// Écran tactile : pas de survol, donc pas d'infobulle. Un premier appui sur un sort l'affiche
// (description + bouton « Lancer ») au lieu de le lancer directement.
const sansCibleAChoisir = (sort) => sort.cible === `soi` || sort.cible === `allie_tous`;
export function controleurJoueur(e, t) {
  combattants = t;
  combattantActif = e;
  sortChoisi = null;
  infoSort = null;
  refVisee = null;
  return new Promise((resolve) => {
    contexteCombat = resolve;
    if (parametres.autoFinTour && !peutEncoreJouer(e, t)) {
      journaliser(`${e.nom} n'a plus rien à jouer, tour passé.`);
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
    rendreCombat();
    montrerHerosActif();
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
function terminerAction(e) {
  let t = contexteCombat;
  combattantActif = null;
  sortChoisi = null;
  infoSort = null;
  refVisee = null;
  contexteCombat = null;
  rendreCombat();
  t?.(e);
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
  let t = combattantActif;
  if (!t || !contexteCombat || !sort) {
    return;
  }
  replierObjectifs();
  document.querySelectorAll(`.sort-tip`).forEach((x) => (x.style.display = `none`));
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
  if (!sortJouable(t, sort)) {
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
  rendreCombat();
}
function badgeArchi(e) {
  if (e.camp !== `ennemi` || !e.archi || !e.archiNom) {
    return ``;
  }
  let t =
    e.monstreId && resolveurAction?.archis.includes(e.monstreId)
      ? `Archimonstre (âme déjà capturée) : ${e.archiNom}`
      : `Archimonstre : vaincs-le pour capturer son âme : ${e.archiNom}`;
  return `<img class="archi-badge capture" src="${cheminAsset(`/assets/divers/Archmonster.webp`)}" alt="" title="${echapperHtml(t)}" onerror="this.remove()" />`;
}
function compterPieges(e, t) {
  let n = 0;
  for (let r of combattants) {
    for (let i of r.pieges ?? []) {
      i.camp === e && i.avant === t && n++;
    }
  }
  return n;
}
// Dégâts prévus du sort choisi sur une cible (sans esquive ni critique) : [min, max], ou null.
function apercuDegats(cible) {
  const s = sortChoisi;
  const lanceur = combattantActif;
  if (!s || !lanceur || s.type !== `degats` || !(s.baseMax > 0) || cible.camp === lanceur.camp) {
    return null;
  }
  try {
    const calc = (x) => {
      const suite = s.sansEsquiveNiCrit ? [x] : [0.999, x, 0.999];
      let k = 0;
      const ctx = {
        rng: () => suite[k++] ?? 0.999,
        log: () => {},
        playerDamageBonus: optionsVue.playerDamageBonus ?? 1,
        enemyDamageBonus: optionsVue.enemyDamageBonus ?? 1,
        reliquesActives: optionsVue.reliquesActives ?? new Set(),
      };
      return calculerDegatsDetail(lanceur, s, cible, { ctx, mult: 1, paAvant: lanceur.paActuels })
        .dmg;
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
const pct = (v) => Math.round(Math.abs(v) * 100);
const signe = (v) => (v >= 0 ? `+` : `−`);
export const EFFETS_AFFICHAGE = {
  poison: {
    icone: `☠`,
    court: (v) => `poison ${v}/t`,
    long: (v) => `Poison : perd ${v} PV au début de chacun de ses tours.`,
    classe: `mal`,
  },
  hot: {
    icone: `♥`,
    court: (v) => `soin ${v}/t`,
    long: (v) => `Régénère ${v} PV au début de chacun de ses tours.`,
    classe: `bien`,
  },
  degatsInfliges: {
    icone: `⚔`,
    court: (v) => `${signe(v)}${pct(v)} % dgts`,
    long: (v) => `Dégâts infligés ${signe(v)}${pct(v)} %.`,
  },
  resAll: {
    icone: `🛡`,
    court: (v) => `${signe(v)}${pct(v)} % rés.`,
    long: (v) => `Résistances à tous les éléments ${signe(v)}${pct(v)} %.`,
  },
  reductionDegats: {
    icone: `🛡`,
    court: (v) => `−${pct(v)} % subis`,
    long: (v) => `Dégâts subis réduits de ${pct(v)} %.`,
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
    court: (v) => `+${v} % crit`,
    long: (v) => `Chance de coup critique +${v} %.`,
    classe: `bien`,
  },
  force: {
    icone: `💪`,
    court: (v) => `${signe(v)}${Math.abs(v)} Force`,
    long: (v) => `Force ${signe(v)}${Math.abs(v)} (cumulable).`,
  },
  intelligence: {
    icone: `🔥`,
    court: (v) => `${signe(v)}${Math.abs(v)} Intel.`,
    long: (v) => `Intelligence ${signe(v)}${Math.abs(v)} (cumulable).`,
  },
  agilite: {
    icone: `💨`,
    court: (v) => `${signe(v)}${Math.abs(v)} Agi.`,
    long: (v) => `Agilité ${signe(v)}${Math.abs(v)} (cumulable).`,
  },
  chance: {
    icone: `💧`,
    court: (v) => `${signe(v)}${Math.abs(v)} Chance`,
    long: (v) => `Chance ${signe(v)}${Math.abs(v)} (cumulable).`,
  },
  vitalite: {
    icone: `❤`,
    court: (v) => `${signe(v)}${pct(v)} % PV`,
    long: (v) => `PV max ${signe(v)}${pct(v)} %.`,
  },
  initiative: {
    icone: `⏳`,
    court: (v) => `init ${v >= 0 ? `+` : ``}${v}`,
    long: (v) => `Initiative ${v >= 0 ? `+` : ``}${v} : change sa place dans l'ordre de jeu.`,
  },
  contre: {
    icone: `⚔️`,
    court: (v) => `contre ${pct(v)} %`,
    long: (v) => `Contre : ${pct(v)} % de chances de riposter quand il est frappé.`,
    classe: `bien`,
  },
  proie: {
    icone: `🎯`,
    court: (v) => `proie · vol ${pct(v)} %`,
    long: (v) => `Proie : l'équipe adverse récupère ${pct(v)} % des dégâts qu'elle lui inflige.`,
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
    court: (v) => `échec ${pct(v)} %`,
    long: (v) => `${pct(v)} % de chances que chacun de ses sorts échoue.`,
    classe: `mal`,
  },
  armure: {
    icone: `🪨`,
    court: (v) => `armure +${v}`,
    long: (v) => `Armure : retire ${v} à chaque frappe reçue.`,
    classe: `bien`,
  },
  degatsCritSubis: {
    icone: `🃏`,
    court: (v) => `+${pct(v)} % crit subis`,
    long: (v) => `Subit ${pct(v)} % de dégâts en plus sur les coups critiques.`,
    classe: `mal`,
  },
  esquive: {
    icone: `💨`,
    court: (v) => `+${pct(v)} % esq.`,
    long: (v) => `Esquive +${pct(v)} % : chance d'éviter complètement une attaque.`,
    classe: `bien`,
  },
  bonusPieges: {
    icone: `🪤`,
    court: (v) => `pièges +${pct(v)} %`,
    long: (v) => `Ses pièges font ${pct(v)} % de dégâts en plus.`,
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
    court: (v) => `+${v} PA/tour`,
    long: (v) => `Gagne ${v} PA au début de chacun de ses tours.`,
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
const duree = (t) => (t > 0 && t < 90 ? ` · ${t} t` : ``);
const dureeLongue = (t) =>
  t > 0 && t < 90 ? ` Encore ${t} tour${t > 1 ? `s` : ``}.` : ` Jusqu'à la fin du combat.`;
export function badgesEffets(e) {
  const cumuls = new Map();
  for (const ef of e.effets) {
    // les effets d'un état de classe sont expliqués par le badge de l'état
    if (ef.source === `etat`) {
      continue;
    }
    const c = cumuls.get(ef.stat) ?? { valeur: 0, tours: 0 };
    c.valeur += ef.valeur;
    c.tours = Math.max(c.tours, ef.toursRestants ?? 0);
    cumuls.set(ef.stat, c);
  }
  const badges = [];
  for (const [stat, { valeur, tours }] of cumuls) {
    const v = Math.round(valeur * 100) / 100;
    const def = EFFETS_AFFICHAGE[stat];
    if (!def) {
      badges.push({ texte: `${stat}${duree(tours)}`, tip: `${stat}.${dureeLongue(tours)}` });
      continue;
    }
    badges.push({
      texte: `${def.icone} ${def.court(v)}${duree(tours)}`,
      tip: `${def.long(v)}${dureeLongue(tours)}`,
      classe: def.classe,
    });
  }
  const temporaires = e.boucliersTemporaires ?? [];
  if (temporaires.length) {
    const montant = temporaires.reduce((acc, b) => acc + b.montant, 0);
    const tours = Math.max(...temporaires.map((b) => b.tours));
    badges.push({
      texte: `🛡 bouclier ${Math.round(montant)}${duree(tours)}`,
      tip: `Bouclier temporaire : absorbe ${Math.round(montant)} dégâts avant les PV, puis s'estompe.${dureeLongue(tours)}`,
      classe: `bien`,
    });
  }
  if ((e.armure ?? 0) > 0) {
    badges.push({
      texte: `🪨 armure ${e.armure}`,
      tip: `Armure permanente : retire ${e.armure} à chaque frappe reçue.`,
    });
  }
  return badges;
}
function badgesCombattant(e) {
  const c = badgesEffets(e);
  const ajouter = (texte, tip, classe) => c.push({ texte, tip, classe });
  const etat = e.etatClasse && ETATS_CLASSE[e.etatClasse];
  if (etat) {
    const effets = etat.effets
      .map((x) => EFFETS_AFFICHAGE[x.stat]?.court(x.valeur))
      .filter(Boolean)
      .join(`, `);
    ajouter(
      `${etat.icone} ${etat.nom}`,
      `État ${etat.nom}${effets ? ` : ${effets}` : ``}, tant que l'état dure.`,
    );
  }
  if (e.marqueElement) {
    ajouter(
      `${ICONES_MARQUES[e.marqueElement]} Marque ${NOMS_ELEMENTS[e.marqueElement]}`,
      `Marque ${NOMS_ELEMENTS[e.marqueElement]} : un sort d'un autre élément la combine pour un effet bonus.`,
    );
  }
  if (e.tourelle) {
    ajouter(`⚙️ Tourelle niv. ${e.niveauTourelle ?? 1}`, `Tourelle : joue seule à chaque tour.`);
  } else if (e.creature) {
    ajouter(`🐾 Créature`, `Créature invoquée : joue seule et disparaît si son invocateur tombe.`);
  }
  if ((e.bombes ?? 0) > 0) {
    ajouter(`💣 ×${e.bombes}`, `${e.bombes} bombe(s) collée(s) : Kaboom les fait exploser.`);
  }
  if ((e.telefrags ?? 0) > 0) {
    ajouter(`⌛ ×${e.telefrags}`, `${e.telefrags} Téléfrag(s) posé(s) (4 au plus).`);
  }
  if ((e.portails ?? 0) > 0) {
    ajouter(`🌀 ×${e.portails}`, `${e.portails} portail(s) ouvert(s) : +2 % de dégâts chacun.`);
  }
  if ((e.rage ?? 0) > 0) {
    ajouter(`🐺 Rage ×${e.rage}`, `Rage ×${e.rage} : +${5 * e.rage} % de dégâts.`, `bien`);
  }
  if ((e.chausseTrappe ?? 0) > 0) {
    ajouter(
      `🪤 Chausse-Trappe ×${e.chausseTrappe}`,
      `Chausse-Trappe ×${e.chausseTrappe} (5 au plus) : renforce ses sorts liés.`,
    );
  }
  if (e.provoque) {
    ajouter(`🛡 Provoque`, `Provocation : les ennemis doivent le viser en priorité.`);
  }
  if ((e.coupsAnnulesRestants ?? 0) > 0) {
    ajouter(
      `🐺 ${e.coupsAnnulesRestants} coup(s) annulé(s)`,
      `Encaisse sans broncher : ses ${e.coupsAnnulesRestants} prochain(s) coup(s) reçu(s) sont annulés (rechargé à chacun de ses tours).`,
      `bien`,
    );
  }
  if (e.bonusOffensifProchain > 0) {
    const p = Math.round(e.bonusOffensifProchain * 100);
    ajouter(`+${p} % prochain`, `Son prochain sort offensif fait +${p} % de dégâts.`, `bien`);
  }
  if (e.maxRollCharges > 0) {
    ajouter(
      `Œil affûté ×${e.maxRollCharges}`,
      `Ses ${e.maxRollCharges} prochain(s) sort(s) font leurs dégâts maximaux.`,
      `bien`,
    );
  }
  if (e.paBonusNextTurn !== 0) {
    const v = e.paBonusNextTurn;
    ajouter(`${v > 0 ? `+` : ``}${v} PA`, `${v > 0 ? `+` : ``}${v} PA à son prochain tour.`);
  }
  if (e.estEgide && (e.toursRestantsInvocation ?? 0) > 0) {
    ajouter(
      `🛡️ Égide · ${e.toursRestantsInvocation} t`,
      `Égide : protège sa ligne, disparaît dans ${e.toursRestantsInvocation} tour(s).`,
    );
  }
  return c;
}
// niveau de PV pour colorer les barres : « crit » sous 25 %, « bas » sous 50 %
export function niveauPv(pct) {
  return pct <= 25 ? `crit` : pct <= 50 ? `bas` : ``;
}
// la barre du bas est collée en bas de l'écran : on fait défiler la page pour que les cibles restent au-dessus
function degagerCibles() {
  const barre = document.getElementById(`cb-barre`);
  const cartes = cartesCiblables();
  if (!barre || !cartes.length) {
    return;
  }
  const hautBarre = barre.getBoundingClientRect().top;
  const bas = Math.max(...cartes.map((c) => c.getBoundingClientRect().bottom));
  const haut = Math.min(...cartes.map((c) => c.getBoundingClientRect().top));
  const decalage = Math.min(bas - hautBarre + 10, haut - 8);
  if (decalage > 0) {
    window.scrollBy({ top: decalage, behavior: `smooth` });
  }
}
function htmlCarteCombattant(e, t) {
  let n = e.pvActuels <= 0;
  let r = Math.max(0, Math.round(e.pvActuels));
  let i = e.pvMax > 0 ? Math.max(0, Math.min(100, Math.round((e.pvActuels / e.pvMax) * 100))) : 0;
  let a = Math.round(e.bouclier);
  let o =
    combattantActif &&
    combattantActif.camp === `joueur` &&
    e.camp === `ennemi` &&
    combattantActif.pvActuels > 0 &&
    e.pvActuels > 0
      ? choisirElement(combattantActif, e, sortChoisi ?? undefined)
      : null;
  let s = ELEMENTS.filter((t) => Math.round(resistanceTotale(e, t) * 100) !== 0 || t === o)
    .map((t) => {
      let n = Math.round(resistanceTotale(e, t) * 100);
      return `<span class="res-chip ${n < 0 ? `faible` : n === 0 ? `zero` : `forte`}${t === o ? ` vise` : ``}" ${t === o ? `data-tip="Résistance ${NOMS_ELEMENTS[t]} · ton élément de frappe contre cette cible (celui qui lui fait le plus mal)"` : `title="Résistance ${NOMS_ELEMENTS[t]}"`}><img src="${IMGS_RESISTANCE[t]}" alt="" onerror="this.remove()" />${n > 0 ? `+` : ``}${n}%</span>`;
    })
    .join(``);
  let c = badgesCombattant(e);
  let l = enLigneAvant(e) ? `avant` : `arriere`;
  return `
    <div class="${[
      `carte`,
      e.camp === `joueur` ? `carte-joueur` : `carte-ennemi`,
      `ligne-${l}`,
      n ? `ko` : ``,
      e.ref === refActive() ? `actif` : ``,
      t ? `ciblable` : ``,
      e.archi ? `archi` : ``,
    ]
      .filter(Boolean)
      .join(
        ` `,
      )}" data-ref="${e.ref}"${t ? ` tabindex="0" role="button" aria-label="${echapperHtml(libelleCible(e))}"` : ``}>
      <div class="carte-tete">
        <span class="carte-nom">${defiCombat?.cible === e.ref ? `<span class="badge-defi" title="Cible du défi ${echapperHtml(defiCombat.nom)}">🎯</span>` : ``}${echapperHtml(e.nom)}</span>
        <span class="rang rang-${l}">${l === `avant` ? `AVANT` : `ARR.`}</span>
      </div>
      <div class="portrait-wrap">
        ${e.img ? `<img class="portrait" src="${cheminAsset(e.img)}" alt="" onerror="this.remove()" />` : `<div class="portrait"></div>`}
        ${badgeArchi(e)}
        <span class="pa-gem" title="${e.paActuels} / ${e.paMax} PA"><img src="${IMG_ETOILE}" alt="" onerror="this.remove()" /><b>${e.paActuels}</b></span>
        <span class="pv-gem ${n ? `ko` : ``} ${a > 0 ? `protege` : ``}" title="${r} / ${e.pvMax} PV${a > 0 ? ` · ${a} bouclier` : ``}" style="--pv-pct:${i}%">
          <img class="pv-vide" src="${IMG_COEUR}" alt="" onerror="this.remove()" />
          <img class="pv-plein" src="${IMG_COEUR}" alt="" onerror="this.remove()" />
          <b class="pv-num">${r}<span>/${e.pvMax}</span></b>
          ${a > 0 ? `<span class="pv-bouclier" title="Bouclier">${a}</span>` : ``}
        </span>
      </div>
      <div class="pv-barre${n ? ` ko` : ``}${n ? `` : ` ${niveauPv(i)}`}" style="--pv-pct:${i}%" title="${r} / ${e.pvMax} PV">
        <span class="pv-barre-txt">❤ ${r} / ${e.pvMax}${a > 0 ? ` · 🛡 ${a}` : ``}</span>
        <span class="pa-txt">★ ${e.paActuels} PA</span>
      </div>
      ${(() => {
        if (e.estEgide) {
          return ``;
        }
        let t = statsEffectives(e);
        return `<div class="mini-stats">
        <span class="ms" title="Coup critique (Agilité)"><img src="${IMG_CRITIQUE}" alt="" onerror="this.remove()" />${pctCritique(t)}%</span>
        <span class="ms" title="Dégâts critiques (Agilité)"><img src="${IMG_DMG_CRITIQUE}" alt="" onerror="this.remove()" />${pctDegatsCritiques(t)}%</span>
        <span class="ms" title="Soins (Soin + élément de frappe)"><img src="${IMG_SOIN}" alt="" onerror="this.remove()" />${pctSoin(t, statElement(t, meilleurElement(e)))}%</span>
        <span class="ms" title="Dégâts finaux (Intelligence)"><img src="${IMG_PUISSANCE}" alt="" onerror="this.remove()" />${pctPuissanceIntel(t)}%</span>
        ${(e.armure ?? 0) > 0 ? `<span class="ms" title="Armure : retranchée de chaque frappe reçue">🪨 ${e.armure}</span>` : ``}
      </div>`;
      })()}
      ${e.camp === `joueur` && !e.estEgide ? `<div class="pp-row" title="Prospection"><img src="${IMG_PP}" alt="" onerror="this.remove()" /><b>${e.stats.prospection ?? 0}</b></div>` : ``}
      ${s && !e.estEgide ? `<div class="res-row">${s}</div>` : ``}
      <div class="badges">${c.map((b) => `<span class="badge${b.classe ? ` ${b.classe}` : ``}" data-tip="${echapperHtml(b.tip)}">${echapperHtml(b.texte)}</span>`).join(``)}</div>
      ${(() => {
        let ap = t ? apercuDegats(e) : null;
        if (!ap) {
          return ``;
        }
        let mortel = ap[0] >= e.pvActuels + (e.bouclier ?? 0);
        return `<div class="cc-apercu${mortel ? ` mortel` : ``}" title="Dégâts prévus du sort (hors critique et esquive)${mortel ? ` : la cible tombe` : ``}">${mortel ? `☠` : `💥`} ${ap[0]}${ap[1] !== ap[0] ? `–${ap[1]}` : ``} dégâts</div>`;
      })()}
      ${!t && protegeParLigneAvant(e) ? `<span class="cc-protege" data-tip="Protégé par la ligne avant : ce sort vise d'abord un ennemi de devant">🛡 protégé</span>` : ``}
      ${n ? `<div class="ko-label">K.O.</div>` : ``}
    </div>`;
}
// Libellé d'une cible en visée, pour les lecteurs d'écran : « Zénith sur Chafer, 10-16 dégâts ».
function libelleCible(e) {
  if (!sortChoisi) {
    return e.nom;
  }
  const ap = apercuDegats(e);
  const degats = ap ? `, ${ap[0]}${ap[1] !== ap[0] ? `-${ap[1]}` : ``} dégâts` : ``;
  return `${sortChoisi.nom} sur ${e.nom}${degats}`;
}
// En visée d'un sort de ligne : l'ennemi de la ligne arrière est protégé par sa ligne avant.
function sortDeLigne() {
  return (
    sortChoisi?.cible === `ennemi_ligne` &&
    combattantActif &&
    sommeEffets(combattantActif, `ignoreLigne`) <= 0
  );
}
function protegeParLigneAvant(e) {
  return (
    sortDeLigne() &&
    e.camp !== combattantActif.camp &&
    e.pvActuels > 0 &&
    !enLigneAvant(e) &&
    !e.estLance &&
    combattants.some(
      (x) => x.camp === e.camp && x.pvActuels > 0 && enLigneAvant(x) && !x.estLance && !x.estEgide,
    )
  );
}
// Pourquoi une carte n'est pas ciblable par le sort choisi (appui sur une carte refusée).
function raisonCibleRefusee(e) {
  const s = sortChoisi;
  const l = combattantActif;
  if (!s || !l) {
    return ``;
  }
  if (e.pvActuels <= 0) {
    return `${e.nom} est K.O.`;
  }
  const visEnnemi = [`ennemi_ligne`, `ennemi_tous`].includes(s.cible);
  if (visEnnemi && e.camp === l.camp) {
    return `${e.nom} est un allié : ce sort vise un ennemi.`;
  }
  if ([`allie`, `allie_tous`].includes(s.cible) && e.camp !== l.camp) {
    return `${e.nom} est un ennemi : ce sort vise un allié.`;
  }
  if (s.cible === `soi`) {
    return `Ce sort se lance sur ${l.nom} uniquement.`;
  }
  if (e.estLance) {
    return `La Lance n'est pas une cible.`;
  }
  if (e.estEgide) {
    return `L'Égide n'est pas une cible.`;
  }
  if (protegeParLigneAvant(e)) {
    return `${e.nom} est protégé par la ligne avant : vise d'abord un ennemi de devant.`;
  }
  if (sommeEffets(l, `tetanise`) > 0 && !enLigneAvant(e) && e.camp !== l.camp) {
    return `${l.nom} est tétanisé : il ne peut viser que la ligne avant.`;
  }
  if (
    (s.cooldown && (l.cooldowns[`${s.id}:${e.ref}`] ?? 0) > 0) ||
    (s.maxParCibleParTour && (l.lancersCeTour?.[`${s.id}:${e.ref}`] ?? 0) >= s.maxParCibleParTour)
  ) {
    return `${e.nom} a déjà été visé par ${s.nom} : choisis une autre cible.`;
  }
  if (s.transfertPvPct && e.ref === l.ref) {
    return `${l.nom} ne peut pas se viser lui-même avec ce sort.`;
  }
  return `${e.nom} ne peut pas être visé par ${s.nom}.`;
}
// Sur téléphone : si aucune cible du sort choisi n'est visible (cachée par la barre des sorts ou
// hors de l'écran), on fait défiler jusqu'à elles.
function montrerCibles() {
  const cartes = [...racine.querySelectorAll(`.carte.ciblable`)];
  if (!cartes.length) {
    return;
  }
  const barre = document.getElementById(`cb-barre`)?.getBoundingClientRect();
  const bas = barre && barre.top > 0 && barre.top < innerHeight ? barre.top : innerHeight;
  const visible = (c) => {
    const r = c.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= bas;
  };
  if (cartes.some(visible)) {
    return;
  }
  const r = cartes[0].getBoundingClientRect();
  window.scrollTo({ top: Math.max(0, scrollY + r.top - Math.max(8, (bas - r.height) / 2)) });
}
function rendreCombat() {
  if (!racine) {
    return;
  }
  masquerElements();
  let e =
    combattantActif && sortChoisi ? ciblesValides(combattantActif, sortChoisi, combattants) : [];
  let t = (t) => e.some((e) => e.ref === t.ref);
  let n = (e) => {
    let n = combattants.filter((t) => t.camp === e).sort((e, t) => e.position - t.position);
    let r = (n, r, i) => {
      let a = compterPieges(e, i);
      return `<div class="ligne-col">
         <span class="ligne-label">${n}${a > 0 ? `<span class="piege-indicateur" title="${echapperHtml(AIDE_PIEGE)}">🪤 ×${a}</span>` : ``}</span>
         <div class="ligne-cards">${r.map((e) => htmlCarteCombattant(e, t(e))).join(``) || `<span class="ligne-vide">—</span>`}</div>
       </div>`;
    };
    let i = r(`Ligne avant`, n.filter(enLigneAvant), true);
    let a = r(
      `Ligne arrière`,
      n.filter((e) => !enLigneAvant(e)),
      false,
    );
    let o = `<img class="ligne-sep" src="${cheminAsset(`/assets/divers/delimiter.png`)}" alt="" onerror="this.remove()" />`;
    return `<div class="camp-lignes ${e}">${e === `joueur` ? a + o + i : i + o + a}</div>`;
  };
  combatEnCours ||=
    ((racine.innerHTML = `
      <div class="combat">
        <h2 class="titre-combat">${echapperHtml(titreCombat)}</h2>
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
    true);
  let r = (e, t) => {
    let n = document.getElementById(e);
    if (n) {
      n.innerHTML = t;
    }
  };
  r(`cb-defi`, htmlDefi());
  r(`cb-timeline`, htmlTimeline());
  r(`cb-joueur`, n(`joueur`));
  r(`cb-ennemi`, n(`ennemi`));
  r(`cb-barre`, htmlBarreSorts());
  racine.querySelector(`.combat`)?.classList.toggle(`ciblage`, !!(combattantActif && sortChoisi));
  document.getElementById(`journal`)?.classList.toggle(`deplie`, journalDeplie);
  rafraichirJournal();
  if (combattantActif && sortChoisi) {
    montrerCibles();
    marquerVisee();
    degagerCibles();
    racine.querySelectorAll(`.carte.ciblable, .tl-pastille.ciblable`).forEach((e) => {
      e.addEventListener(`click`, (ev) => {
        // un appui pour lire un badge ou une résistance ne lance pas le sort
        if (ev.target.closest(`.badge, [data-tip]`)) {
          return;
        }
        terminerAction({
          sort: sortChoisi,
          cibleRef: e.dataset.ref,
        });
      });
    });
    racine.querySelectorAll(`.carte.ciblable`).forEach((e) => {
      e.addEventListener(`focus`, () => {
        refVisee = e.dataset.ref;
        marquerVisee();
      });
    });
    if (!sansCibleAChoisir(sortChoisi)) {
      racine.querySelectorAll(`.carte:not(.ciblable)`).forEach((e) => {
        e.addEventListener(`click`, (ev) => {
          const c = combattants.find((x) => x.ref === e.dataset.ref);
          const zone = document.getElementById(`aide-refus`);
          if (!c || !zone || ev.target.closest(`.badge, [data-tip]`)) {
            return;
          }
          zone.textContent = `⛔ ${raisonCibleRefusee(c)}`;
          zone.hidden = false;
        });
      });
    }
  }
  suivreTourActif();
  racine.querySelectorAll(`[data-ref]`).forEach((e) => {
    let ref = e.dataset.ref;
    let n = () => racine.querySelectorAll(`[data-ref="${ref}"]`);
    e.addEventListener(`mouseenter`, () => n().forEach((e) => e.classList.add(`lie-survol`)));
    e.addEventListener(`mouseleave`, () => n().forEach((e) => e.classList.remove(`lie-survol`)));
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
  for (const c of [pastille.parentElement, liste]) {
    if (c.scrollWidth > c.clientWidth + 1) {
      const p = pastille.getBoundingClientRect();
      const r = c.getBoundingClientRect();
      c.scrollLeft += p.left + p.width / 2 - (r.left + r.width / 2);
    }
  }
}
function initiativeEffective(e) {
  return (
    e.initiative +
    e.effets.filter((e) => e.stat === `initiative`).reduce((acc, item) => acc + item.valeur, 0)
  );
}
function htmlTimeline() {
  let e = new Map(combattants.map((e) => [e.ref, e]));
  let t = ordreDeJeu(combattants)
    .map((t) => e.get(t))
    .filter((e) => !!e && e.pvActuels > 0);
  if (t.length < 2) {
    return ``;
  }
  let n =
    combattantActif && sortChoisi ? ciblesValides(combattantActif, sortChoisi, combattants) : [];
  const actif = refActive();
  return `<div class="timeline"><span class="tl-ronde" title="Ronde en cours : chacun joue une fois par ronde">Ronde ${numeroRonde}</span><div class="tl-liste">${t
    .map((e) => {
      let e_camp = e.camp;
      let r = e.ref === actif ? `actif` : dejaJoues.has(e.ref) ? `deja-joue` : ``;
      let i = n.some((t) => t.ref === e.ref) ? `ciblable` : ``;
      let a = e.img
        ? `<img src="${cheminAsset(e.img)}" alt="" onerror="this.remove()" />`
        : `<span class="tl-ini">${initiativeEffective(e)}</span>`;
      return `<div class="tl-pastille ${e_camp} ${r} ${i}" data-ref="${e.ref}" title="${echapperHtml(e.nom)} · init ${initiativeEffective(e)}">${a}</div>`;
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
  const libelle = `${sort.nom}${arme ? `, attaque d'arme` : ``}${
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
        ${recharge > 0 ? `<span class="sort-cd" title="Rechargement : ${recharge} tour(s)">${recharge}</span>` : ``}
        ${etiquette ? `<span class="sort-etiquette${raison ? `` : ` dispo`}">${echapperHtml(etiquette)}</span>` : ``}
      </button>`;
}
function htmlBarreSorts() {
  if (!combattantActif) {
    // tour d'un monstre ou d'une créature : on montre qui joue, à la place des sorts
    const joueur = combattants.find((x) => x.ref === refTourEnCours && x.pvActuels > 0);
    if (!joueur) {
      return `<div class="attente">En attente…</div>`;
    }
    return `<div class="attente attente-tour ${joueur.camp}">
      ${joueur.img ? `<img class="attente-portrait" src="${cheminAsset(joueur.img)}" alt="" onerror="this.remove()" />` : ``}
      <span>Tour de <b>${echapperHtml(joueur.nom)}</b>…</span>
    </div>`;
  }
  let e = combattantActif;
  let e_armeSort = e.armeSort;
  let n =
    (e_armeSort
      ? htmlBoutonSort(
          e,
          e_armeSort,
          1,
          `<span class="sort-icon-wrap"><img class="sort-icon" src="${e_armeSort.img ? cheminAsset(e_armeSort.img) : ``}" alt="" onerror="this.closest('.sort-icon-wrap')?.remove()" /></span>`,
          true,
        )
      : `<div class="sort sort-cac" title="Corps à corps, aucune arme équipée">
        <span class="sort-touche">1</span>
        <span class="sort-icon-vide">🗡️</span>
      </div>`) +
    e.sorts
      .map((e) => SORTS[e])
      .map((t, n) =>
        htmlBoutonSort(
          e,
          t,
          n + 2,
          `<span class="sort-icon-wrap"${attrElementSort(t, e)}><span class="sort-nom-fallback">${echapperHtml(t.nom)}</span><img class="sort-icon" src="${iconeSort(t.id)}" alt="" onerror="this.closest('.sort-icon-wrap')?.classList.add('noicon'); this.remove()" /></span>`,
        ),
      )
      .join(``);
  queueMicrotask(() => {
    racine.querySelectorAll(`button.sort[data-sort]`).forEach((e) => {
      e.addEventListener(`click`, () => choisirSort(SORTS[e.dataset.sort]));
    });
    racine.querySelector(`button.sort[data-arme]`)?.addEventListener(`click`, () => {
      if (combattantActif?.armeSort) {
        choisirSort(combattantActif.armeSort);
      }
    });
    document.getElementById(`fin-tour`)?.addEventListener(`click`, () => terminerAction(null));
    document.getElementById(`vitesse-combat`)?.addEventListener(`click`, (ev) => {
      parametres.combatRapide = !parametres.combatRapide;
      sauverParametres(parametres);
      ev.currentTarget.classList.toggle(`on`, parametres.combatRapide);
      ev.currentTarget.setAttribute(`aria-pressed`, String(parametres.combatRapide));
    });
    document.getElementById(`sort-lancer`)?.addEventListener(`click`, () => {
      if (sortChoisi) {
        lancerSurSoi(sortChoisi);
      }
    });
    document.getElementById(`sort-info`)?.addEventListener(`click`, () => {
      aideDepliee = !aideDepliee;
      rendreCombat();
    });
    document.getElementById(`sort-annuler`)?.addEventListener(`click`, () => {
      sortChoisi = null;
      infoSort = null;
      rendreCombat();
    });
    document.getElementById(`sort-lancer-cible`)?.addEventListener(`click`, () => {
      lancerSurVisee();
    });
  });
  let r;
  if (sortChoisi) {
    const cibles = sansCibleAChoisir(sortChoisi)
      ? []
      : ciblesValides(e, sortChoisi, combattants).filter((c) => c.pvActuels > 0);
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
    r = `<div class="aide aide-sort${aideDepliee ? ` deplie` : ``}">
      <div class="aide-sort-tete">${consigne}<button id="sort-info" class="secondaire sort-info" aria-label="Détails du sort" aria-pressed="${aideDepliee}">ⓘ</button><button id="sort-annuler" class="secondaire">Annuler</button></div>
      <div id="aide-refus" class="aide-refus" role="status" hidden></div>
      <div class="aide-sort-detail">${infobulleSort(sortChoisi, e)}</div>
    </div>`;
  } else if (infoSort) {
    const raison = raisonIndisponible(e, infoSort, combattants);
    r = `<div class="aide aide-sort aide-indispo deplie">
      <div class="aide-sort-tete"><span class="aide-consigne">⛔ <b>${echapperHtml(infoSort.nom)}</b>${raison ? ` : ${echapperHtml(raison)}` : ``}</span><button id="sort-annuler" class="secondaire">Fermer</button></div>
      <div class="aide-sort-detail">${infobulleSort(infoSort, e)}</div>
    </div>`;
  } else {
    r = `<div class="aide">Tour de <b>${echapperHtml(e.nom)}</b> : choisis un sort · <span class="aide-pa">${e.paActuels}/${e.paMax} PA</span></div>`;
  }
  // PV des héros toujours visibles (téléphone) : la barre recouvre les cartes de l'équipe
  const equipeMini = combattants
    .filter((c) => c.camp === `joueur`)
    .map((c) => {
      const pct =
        c.pvMax > 0 ? Math.max(0, Math.min(100, Math.round((c.pvActuels / c.pvMax) * 100))) : 0;
      return `<span class="em-heros${c.pvActuels <= 0 ? ` mort` : ` ${niveauPv(pct)}`}${c === e ? ` actif` : ``}" style="--pv-pct:${pct}%"><b>${echapperHtml(c.nom)}</b> <span class="em-pv">${Math.max(0, Math.round(c.pvActuels))}/${c.pvMax}</span></span>`;
    })
    .join(``);
  return `
    <div class="equipe-mini" aria-hidden="true">${equipeMini}</div>
    <div class="sorts-rangee">
      <div class="sorts-zone"><div class="sorts-liste">${n}</div></div>
      <div class="barre-actions-fin"><button id="vitesse-combat" class="secondaire vitesse-combat${parametres.combatRapide ? ` on` : ``}" title="Tours des monstres rapides (aussi dans les Paramètres)" aria-pressed="${!!parametres.combatRapide}">⏩</button><button id="fin-tour" class="fin-tour primaire" title="Terminer le tour"><span class="fin-tour-txt">Fin du tour</span> <kbd>${echapperHtml(nomTouche(parametres.toucheFinTour))}</kbd></button></div>
    </div>
    ${r}`;
}
