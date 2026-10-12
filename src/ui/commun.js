import { EMPLACEMENTS, TYPES_OBJETS } from "../jeu/emplacements.js";
import { numeroZoneObjet } from "../jeu/economie.js";
import { descriptionPanoplie } from "../jeu/panoplies.js";
import { texteObtentionDofus, texteObtentionObjet } from "../jeu/obtention.js";
import { CLASSES, DOFUS, EQUIPEMENTS } from "../data/index.js";
import { DIFFICULTES, DIFFICULTE_MAX, DOSSIER_ICONE_SORT, RARETES_INFO } from "../jeu/config.js";
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
} from "../sauvegarde/parametres.js";
import { herosAmeliores } from "../jeu/inventaire.js";
export let racine;
export function definirRacine(e) {
  racine = e;
}
export const parametres = chargerParametres();
// `auto` ou `smooth` pour scrollIntoView / scrollBy : instantané si les animations sont réduites.
export function comportementDefilement() {
  let systeme = false;
  try {
    systeme = !!window.matchMedia?.(`(prefers-reduced-motion: reduce)`).matches;
  } catch {}
  return choisirDefilement(parametres.reduireAnimations, systeme);
}
export function echapperHtml(e) {
  return String(e).replace(
    /[&<>"']/g,
    (e) =>
      ({
        "&": `&amp;`,
        "<": `&lt;`,
        ">": `&gt;`,
        '"': `&quot;`,
        "'": `&#39;`,
      })[e],
  );
}
export const elementsAMasquer = [];
export function masquerElements() {
  for (let e of elementsAMasquer) {
    e.style.display = `none`;
  }
}
function definirFond(e) {
  if (e) {
    document.body.classList.add(`avec-fond`);
    document.body.style.setProperty(`--fond-run`, `url("${e}")`);
  } else {
    document.body.classList.remove(`avec-fond`);
    document.body.style.removeProperty(`--fond-run`);
  }
}
// Dernier écran affiché (élément + classe et titre) : un nouvel écran repart en haut avec le focus
// sur son titre ; le même écran réaffiché (choix d'équipe, HDV, paramètres…) garde défilement et focus.
let dernierEcran = { el: null, cle: `` };
export function afficherEcran(e, t = ``) {
  masquerElements();
  // le combat remplace la racine sans passer par ici : l'écran d'avant n'est alors plus affiché
  const dejaAffiche = !!dernierEcran.el && racine.firstElementChild === dernierEcran.el;
  racine.innerHTML = `<div class="ecran${t ? ` ${t}` : ``}">${e}</div>`;
  const el = racine.firstElementChild;
  const titre = el?.querySelector(`h1`);
  const cle = `${t}|${titre?.textContent.trim() ?? ``}`;
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
    const clavier = (e) => {
      if (e.key === `Escape`) {
        e.preventDefault();
        e.stopPropagation();
        fermer(false);
      }
    };
    fond.addEventListener(`click`, (e) => {
      const r = e.target.closest?.(`[data-reponse]`)?.dataset.reponse;
      if (r) {
        fermer(r === `oui`);
      } else if (e.target === fond) {
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
  document.addEventListener(`keydown`, (e) => {
    if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) {
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
    if (e.key === `Enter`) {
      // un bouton, un lien ou une carte focalisés réagissent déjà à Entrée
      if (actif?.closest?.(`button, [role="button"], a[href], summary`)) {
        return;
      }
      for (const sel of ACTIONS_PRINCIPALES) {
        const b = racine.querySelector(sel);
        if (b && !b.disabled) {
          e.preventDefault();
          b.click();
          return;
        }
      }
      return;
    }
    const chiffre = /^(?:Digit|Numpad)([1-4])$/.exec(e.code)?.[1];
    if (chiffre) {
      const option = racine.querySelectorAll(`.ecran [data-choix]`)[Number(chiffre) - 1];
      if (option && !option.disabled) {
        e.preventDefault();
        option.click();
      }
    }
  });
}
export function installerToucheEchap() {
  installerToucheEntree();
  document.addEventListener(`keydown`, (e) => {
    if (e.key !== `Escape` || e.defaultPrevented) {
      return;
    }
    if (champDeSaisie(document.activeElement)) {
      return;
    }
    let n = racine?.querySelector(`.ecran .boutons-ecran .btn-retour`);
    if (!(!n || n.disabled)) {
      e.preventDefault();
      n.click();
    }
  });
}
export const cheminAsset = (e) => `/` + e.replace(/^\/+/, ``);
export const iconeSort = (e) =>
  cheminAsset(`/assets/spells/${DOSSIER_ICONE_SORT[e] ?? `monstres`}/${e}.png`);
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
export const imgMonde = (e) => cheminAsset(`/assets/menu/Monde_${e}.png`);
export const IMG_DOFUS = cheminAsset(`/assets/menu/dofus.png`);
const IMG_KAMAS = cheminAsset(`/assets/divers/kamas.png`);
export const imgElement = (e) => cheminAsset(`/assets/elements/${e}.png`);
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
export const imgClasse = (e) => cheminAsset(CLASSES[e]?.img ?? `/assets/classes/${e}.png`);
export const imgObjet = (e) => cheminAsset(`/assets/items/${e}.png`);
export function boutonRetour(e, t = `Retour`) {
  return `<button id="${e}" class="btn-retour" title="${echapperHtml(t)}"><img src="${IMG_RETOUR}" alt="Retour" onerror="this.remove()" /></button>`;
}
// Réaffiche un écran en gardant la position des listes et de la page (HDV, forgemagie…).
export function afficherEnGardantScroll(html) {
  const listes = [...racine.querySelectorAll(`.equip-inv`)].map((e) => e.scrollTop);
  const y = scrollY;
  afficherEcran(html);
  racine.querySelectorAll(`.equip-inv`).forEach((e, k) => {
    e.scrollTop = listes[k] ?? 0;
  });
  window.scrollTo(0, y);
}
// Photo de l'équipement (inventaire, objets portés, PV) avant une opération en lot comme
// « Équiper le meilleur » : elle permet de tout remettre comme avant (bouton Annuler).
export function photoEquipement(run) {
  return {
    inventaire: run.inventaire.slice(),
    persos: run.persos.map((p) => ({ perso: p, equipement: { ...p.equipement }, pv: p.pvActuels })),
  };
}
// Remet l'équipement tel qu'il était sur la photo (l'inventaire est modifié en place).
export function restaurerEquipement(run, photo) {
  run.inventaire.length = 0;
  run.inventaire.push(...photo.inventaire);
  for (const { perso, equipement, pv } of photo.persos) {
    for (const k of Object.keys(perso.equipement)) {
      delete perso.equipement[k];
    }
    Object.assign(perso.equipement, equipement);
    perso.pvActuels = pv;
  }
}
export function barreRetour(e, t = `Retour`) {
  return `<div class="boutons-ecran">${boutonRetour(e, t)}</div>`;
}
export function boutonContinuer(e) {
  const kbd = ecranTactile() ? `` : `<kbd class="kbd-entree" aria-hidden="true">Entrée</kbd>`;
  return `<button id="${e}" class="btn-continuer" title="Continuer"><img src="${IMG_CONTINUER}" alt="Continuer" onerror="this.remove()" />${kbd}</button>`;
}
export function barreContinuer(e) {
  return `<div class="boutons-ecran">${boutonContinuer(e)}</div>`;
}
export function etoilesDifficulte(e) {
  let t = Math.max(0, Math.min(Math.trunc(e) || 0, DIFFICULTE_MAX)) + 1;
  return `★`.repeat(t) + `☆`.repeat(DIFFICULTES.length - t);
}
export function fondDuMonde(e) {
  definirFond((e ? FONDS_MONDE[e] : null) ?? FOND_ACCUEIL);
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
  const autres = els.filter((x) => x !== meilleur).map((x) => NOMS_ELEMENTS[x]);
  if (sort.elementPire) {
    return `dans l'élément le <b>moins</b> efficace contre la cible`;
  }
  return `en <b>${NOMS_ELEMENTS[meilleur]}</b>${autres.length ? ` (ou ${autres.join(` / `)} si la cible y résiste moins)` : ``}`;
}
export function infobulleSort(e, t) {
  let n = ``;
  if (t) {
    let r = statsEffectives(t);
    if (e.type === `soin`) {
      if (e.soinComplet) {
        n = `<span class="tip-val soin">♥ Soin complet</span>`;
      } else if (e.baseMax > 0) {
        let i = multiplicateurSoin(r, statElement(r, meilleurElement(t)));
        n = `<span class="tip-val soin">♥ ${Math.round(e.baseMin * i)} – ${Math.round(e.baseMax * i)}</span><span class="tip-unite">PV rendus</span>`;
      }
    } else if (e.type === `degats` && e.baseMax > 0) {
      let i =
        multiplicateurStat(statElement(r, meilleurElement(t))) *
        bonusDegatsIntelligence(r) *
        multiplicateurRelance(e, t);
      n = `<span class="tip-val dgt">⚔ ${Math.round(e.baseMin * i)} – ${Math.round(e.baseMax * i)}</span><span class="tip-el">${texteElement(e, t)}</span>`;
    }
  } else {
    if (e.baseMax > 0) {
      n =
        e.type === `soin`
          ? `<span class="tip-val soin">♥ ${e.baseMin} – ${e.baseMax}</span><span class="tip-unite">PV rendus (base)</span>`
          : `<span class="tip-val dgt">⚔ ${e.baseMin} – ${e.baseMax}</span><span class="tip-unite">base · élément selon la cible</span>`;
    }
  }
  let r = [];
  if (e.cooldownTours) {
    r.push(`⏳ recharge ${e.cooldownTours} tour${e.cooldownTours > 1 ? `s` : ``}`);
  }
  if (e.cooldown) {
    r.push(`⏳ recharge ${e.cooldown} tour${e.cooldown > 1 ? `s` : ``} par cible`);
  }
  if (e.maxParTour) {
    r.push(`${e.maxParTour}×/tour`);
  }
  if (e.maxParCibleParTour) {
    r.push(`${e.maxParCibleParTour}×/cible/tour`);
  }
  let i = t?.cooldowns[e.id] ?? 0;
  if (i > 0) {
    r.push(`<b class="tip-cd-actif">en recharge (${i}t)</b>`);
  }
  return [
    `<div class="tip-nom">${echapperHtml(e.nom)}<span class="tip-pa">${t ? coutPA(e, t) : e.coutPA} PA</span></div>`,
    n ? `<div class="tip-stat">${n}</div>` : ``,
    e.desc ? `<div class="tip-effet">${echapperHtml(e.desc)}</div>` : ``,
    `<div class="tip-cible">🎯 ${LIBELLES_CIBLE[e.cible] ?? e.cible}${r.length ? ` · ${r.join(` · `)}` : ``}</div>`,
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
    const a = el.getBoundingClientRect();
    const o = bulle.getBoundingClientRect();
    let x = a.left + a.width / 2 - o.width / 2;
    x = Math.max(8, Math.min(x, window.innerWidth - o.width - 8));
    let y = a.top - o.height - 10;
    if (y < 8) {
      y = a.bottom + 10;
    }
    bulle.style.left = `${x}px`;
    bulle.style.top = `${y}px`;
  };
  const masquer = () => {
    bulle.style.display = `none`;
    cible?.removeAttribute(`aria-describedby`);
    cible = null;
  };
  return { bulle, placer, masquer };
}
// Survol (souris seulement : le survol simulé d'un toucher laissait des bulles collées), focus
// clavier et toucher ; Échap et le défilement referment la bulle.
function brancherBulle(selecteur, montrer, masquer) {
  document.addEventListener(`mouseover`, (ev) => {
    if (ecranTactile()) {
      return;
    }
    const el = ev.target.closest?.(selecteur);
    if (el) {
      montrer(el);
    }
  });
  document.addEventListener(`mouseout`, (ev) => {
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
      if (!ecranTactile()) {
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
  const montrer = (t) => {
    const etat = t.dataset.possede
      ? `<div class="tip-muet">✓ Obtenu</div>`
      : `<div class="tip-muet">🔒 ${echapperHtml(t.dataset.obtention ?? ``)}</div>`;
    bulle.innerHTML =
      `<div class="tip-nom">${echapperHtml(t.dataset.nom ?? ``)}</div><div class="tip-effet">${echapperHtml(t.dataset.effet ?? ``)}</div>` +
      etat;
    placer(t);
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
  const montrer = (t) => {
    const tip = t.dataset.tip;
    if (!tip) {
      return;
    }
    bulle.textContent = tip;
    placer(t);
  };
  brancherBulle(`[data-tip]`, montrer, masquer);
}
export const NOMS_ELEMENTS = {
  terre: `Terre`,
  feu: `Feu`,
  eau: `Eau`,
  air: `Air`,
};
export const htmlKamas = (e) =>
  `<span class="kamas"><img src="${IMG_KAMAS}" alt="k" onerror="this.remove()" />${e.toLocaleString(`fr-FR`)}</span>`;
function elementsDuPerso(e) {
  return CLASSES[e.classeId].elements;
}
export function pastillesElementsPerso(e) {
  return `<span class="el-pastilles">${(Object.values(e.equipement).some(
    (e) => e && EQUIPEMENTS[e.id]?.elementLibre,
  )
    ? [`terre`, `feu`, `eau`, `air`]
    : elementsDuPerso(e)
  )
    .map(
      (e) =>
        `<img class="el-pastille" src="${imgElement(e)}" alt="" title="Élément : ${NOMS_ELEMENTS[e]}" onerror="this.remove()" />`,
    )
    .join(``)}</span>`;
}
export const NOMS_ARCHETYPES = {
  melee: `Mêlée`,
  distance: `Distance`,
};
export function htmlElementsClasse(e, t = {}) {
  let n = CLASSES[e];
  let r = GAINS_ARCHETYPE[n.archetype];
  let i = `${NOMS_ARCHETYPES[n.archetype]} : +${r.parElement} dans chacun de ses 2 éléments et +${r.vitalite} en Vitalité par niveau`;
  return `<span class="classe-elems">
    ${t.icone && !ecranTactile() ? `<img class="archetype-icone" src="${imgArchetype(n.archetype)}" alt="${NOMS_ARCHETYPES[n.archetype]}" data-tip="${echapperHtml(i)}" onerror="const s=document.createElement('span');s.className='classe-archetype';s.textContent=this.alt;s.dataset.tip=this.dataset.tip;this.replaceWith(s)" />` : `<span class="classe-archetype" data-tip="${echapperHtml(i)}">${NOMS_ARCHETYPES[n.archetype]}</span>`}
    <span class="el-pastilles">${n.elements.map((e) => `<img class="el-pastille" src="${imgElement(e)}" alt="" title="Élément de la classe : ${NOMS_ELEMENTS[e]}" onerror="this.remove()" />`).join(``)}</span>
  </span>`;
}
export const imgSymboleClasse = (e) => cheminAsset(`/assets/class_symbol/${e}.png`);
export const pctCritique = (e) => Math.round(chanceCritique(e) * 100);
export const pctDegatsCritiques = (e) => Math.round(bonusDegatsCritiques(e) * 100);
export const pctSoin = (e, t) => Math.round((multiplicateurSoin(e, t) - 1) * 100);
export const pctPuissanceIntel = (e) => Math.round((bonusDegatsIntelligence(e) - 1) * 100);
export function htmlRackDofus(e, t = false) {
  let n = Object.values(DOFUS)
    .map((t) => {
      let length = e.dofus.filter((e) => e.id === t.id).length;
      let r = length > 0;
      let i = t.id === `dofus_ocre` ? `data-ocre="1"` : ``;
      return `
        <div class="dofus-slot ${r ? `` : `locked`}" data-nom="${echapperHtml(t.nom)}" data-effet="${echapperHtml(t.desc)}" data-obtention="${echapperHtml(texteObtentionDofus(t.id))}" data-possede="${r ? 1 : ``}" ${i}>
          ${t.img ? `<img src="${cheminAsset(t.img)}" alt="${echapperHtml(t.nom)}" loading="lazy" decoding="async" onerror="this.remove()" />` : ``}
          ${length > 1 ? `<span class="dofus-count">×${length}</span>` : ``}
        </div>`;
    })
    .join(``);
  return `<div class="dofus-rack ${t ? `compact` : ``}">${n}</div>`;
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
export function htmlCarteClasse(e, t, n) {
  let r = CLASSES[e];
  return `<button class="classe-carte ${t ? `sel` : ``}" ${n}="${e}">
    <img class="classe-portrait" src="${imgClasse(e)}" alt="" loading="lazy" decoding="async" onerror="this.remove()" />
    <span class="classe-nom">${echapperHtml(r.nom)}</span>
    ${htmlElementsClasse(e)}
    <span class="classe-role">${echapperHtml(ROLES_CLASSES[e] ?? ``)}</span>
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
export const classeRarete = (e) => {
  if (e?.rarete) {
    return ` rarete-${e.rarete}`;
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
export function htmlNomObjet(e) {
  let t = EQUIPEMENTS[e.id];
  let n = echapperHtml(t?.nom ?? e.id);
  if (e.rarete) {
    return `<span class="inom-${e.rarete}" title="${RARETES_INFO[e.rarete].nom}">${n}</span>`;
  }
  return n;
}
// classeId (facultatif) : la classe du porteur, pour dire où va la stat adaptative.
export function htmlChipsObjet(e, classeId) {
  let t = EQUIPEMENTS[e.id];
  let n = [];
  let r = (e, t, titre) =>
    n.push(
      `<span class="ichip ${e}"${titre ? ` data-tip="${echapperHtml(titre)}"` : ``}>${t}</span>`,
    );
  let i = (e) => {
    if (e > 0) {
      return `+${e}`;
    }
    return `${e}`;
  };
  if (e.adaptatif) {
    let elements = CLASSES[classeId]?.elements;
    if (elements) {
      for (let el of elements) {
        let stat = STAT_PAR_ELEMENT[el];
        n.push(
          `<span class="ichip ichip-${stat}${e.adaptatif < 0 ? ` malus` : ``}" data-tip="Stat adaptative : s'applique aux 2 caractéristiques d'élément de ta classe">${i(e.adaptatif)} ${ABREV_STATS[stat]} ★</span>`,
        );
      }
    } else {
      n.push(
        `<span class="ichip ichip-adapt${e.adaptatif < 0 ? ` malus` : ``}" data-tip="Stat adaptative : s'applique aux 2 caractéristiques d'élément du porteur (ex. Force et Chance pour un Feca)">${i(e.adaptatif)} aux 2 caracs d'élément ★</span>`,
      );
    }
  }
  if (t?.pvBonus) {
    r(`ichip-vitalite`, `+${t.pvBonus} PV`);
  }
  for (let t of Object.keys(e.stats)) {
    let n = e.stats[t];
    if (n) {
      r(
        `ichip-${t}${n < 0 ? ` malus` : ``}`,
        `${i(n)} ${ABREV_STATS[t] ?? t}`,
        ROLE_STATS[t] && `${ABREV_STATS[t]} : ${ROLE_STATS[t]}`,
      );
    }
  }
  if (e.pa) {
    r(`ichip-pa`, `+${e.pa} PA`);
  }
  let a = {
    ...(t?.resistances ?? {}),
    ...(e.resistances ?? {}),
  };
  for (let e of Object.keys(a)) {
    let t = a[e];
    if (t) {
      r(
        `ichip-res elem-${e}${t < 0 ? ` malus` : ``}`,
        `${i(Math.round(t * 100))}% ${NOMS_ELEMENTS[e]}`,
      );
    }
  }
  let o = e.rarete ? t?.tiers?.[e.rarete]?.attaque : undefined;
  if (o) {
    r(
      `ichip-arme`,
      `⚔ Attaque d'arme : ${o.baseMin}–${o.baseMax} dégâts, ${o.coutPA} PA${o.cible === `ennemi_tous` ? ` · atteint la ligne arrière` : ``}${o.vampirisme ? ` · rend ${Math.round(o.vampirisme * 100)} % en PV` : ``}`,
    );
  }
  if (t?.paGamble) {
    n.push(
      `<span class="ichip ichip-pa" data-tip="À chaque tour : ${Math.round(t.paGamble.pPlus * 100)} % de gagner +${t.paGamble.plus} PA, sinon −${t.paGamble.moins} PA">🎲 ${Math.round(t.paGamble.pPlus * 100)} % +${t.paGamble.plus} PA / −${t.paGamble.moins}</span>`,
    );
  }
  if (t?.ligneAvant) {
    n.push(
      `<span class="ichip malus" data-tip="Équipable uniquement sur un personnage de la ligne avant">Ligne avant uniqt</span>`,
    );
  }
  if (t?.riposteAvant) {
    n.push(
      `<span class="ichip ichip-force" data-tip="Quand le porteur est frappé en ligne avant : ${Math.round(t.riposteAvant * 100)} % de chance de contre-attaquer">↩ ${Math.round(t.riposteAvant * 100)} % riposte (avant)</span>`,
    );
  }
  if (t?.esquiveArriere) {
    n.push(
      `<span class="ichip ichip-agilite" data-tip="Quand le porteur est en ligne arrière : +${Math.round(t.esquiveArriere * 100)} % d'esquive">💨 +${Math.round(t.esquiveArriere * 100)} % esquive (arrière)</span>`,
    );
  }
  if (t?.soinDegatsRecus) {
    n.push(
      `<span class="ichip ichip-soin" data-tip="À chaque coup encaissé, le porteur récupère ${Math.round(t.soinDegatsRecus * 100)} % des dégâts subis">♥ récup. ${Math.round(t.soinDegatsRecus * 100)} % des dégâts subis</span>`,
    );
  }
  if (t?.changeLigne) {
    n.push(
      `<span class="ichip ichip-pa" data-tip="Confère le sort « Changer de ligne » : bascule avant ↔ arrière en combat pour ${t.changeLigne} PA">↕ change de ligne (${t.changeLigne} PA)</span>`,
    );
  }
  if (t?.perceResistances) {
    n.push(
      `<span class="ichip ichip-force" data-tip="L'attaque de cette arme ignore ${Math.round(t.perceResistances * 100)} % des résistances de la cible">⚡ perce ${Math.round(t.perceResistances * 100)} % des rés.</span>`,
    );
  }
  if (t?.frappeDerriere) {
    n.push(
      `<span class="ichip ichip-force" data-tip="L'attaque touche aussi l'ennemi juste derrière la cible">⤈ frappe aussi derrière</span>`,
    );
  }
  if (t?.prospParPvManquant) {
    n.push(
      `<span class="ichip ichip-prospection" data-tip="Au moment du butin : +${t.prospParPvManquant} prospection par PV manquant du porteur">📦 +${t.prospParPvManquant} PP / PV manquant</span>`,
    );
  }
  if (t?.multKamas) {
    n.push(
      `<span class="ichip ichip-adapt" data-tip="Les kamas gagnés en combat sont multipliés par ${t.multKamas}">🪙 kamas ×${t.multKamas}</span>`,
    );
  }
  if (t?.bouclierDebut) {
    n.push(
      `<span class="ichip ichip-vitalite" data-tip="Commence chaque combat avec un bouclier de ${Math.round(t.bouclierDebut * 100)} % des PV max">🛡 bouclier de départ ${Math.round(t.bouclierDebut * 100)} %</span>`,
    );
  }
  if (t?.poisonArme) {
    n.push(
      `<span class="ichip malus" data-tip="L'attaque de cette arme empoisonne la cible (${t.poisonArme.degats} dégâts pendant ${t.poisonArme.duree} tours)">☠ empoisonne (${t.poisonArme.degats}/t · ${t.poisonArme.duree} t)</span>`,
    );
  }
  if (t?.soinAllieBlesse) {
    n.push(
      `<span class="ichip ichip-soin" data-tip="L'attaque soigne l'allié le plus blessé de ${Math.round(t.soinAllieBlesse * 100)} % des dégâts infligés">♥ soigne l'allié blessé (${Math.round(t.soinAllieBlesse * 100)} %)</span>`,
    );
  }
  if (t?.retraitPA) {
    n.push(
      `<span class="ichip ichip-pa" data-tip="L'attaque a 30 % de chance de retirer ${t.retraitPA} PA à la cible">⛓ retrait ${t.retraitPA} PA (30 %)</span>`,
    );
  }
  if (t?.assome) {
    n.push(
      `<span class="ichip malus" data-tip="L'attaque de cette arme a ${Math.round(t.assome * 100)} % de chance d'assommer la cible : elle passe son prochain tour">💫 assomme (${Math.round(t.assome * 100)} %)</span>`,
    );
  }
  if (t?.recupPASort) {
    n.push(
      `<span class="ichip ichip-pa" data-tip="Après chaque sort lancé par le porteur : ${Math.round(t.recupPASort.chance * 100)} % de chance de récupérer ${t.recupPASort.pa} PA immédiatement">↺ ${Math.round(t.recupPASort.chance * 100)} % récup. ${t.recupPASort.pa} PA</span>`,
    );
  }
  if (t?.esquiveBonus) {
    n.push(
      `<span class="ichip ichip-agilite" data-tip="+${Math.round(t.esquiveBonus * 100)} % d'esquive pour le porteur, quelle que soit sa ligne">💨 +${Math.round(t.esquiveBonus * 100)} % esquive</span>`,
    );
  }
  if (t?.esquiveParPiece) {
    n.push(
      `<span class="ichip ichip-agilite" data-tip="Bonus de panoplie : +${Math.round(t.esquiveParPiece * 1000) / 10} % d'esquive par pièce de sa panoplie équipée (s'ajoute aux bonus de panoplie)">💨 +${Math.round(t.esquiveParPiece * 1000) / 10} % esquive / pièce</span>`,
    );
  }
  if (t?.elementLibre) {
    n.push(
      `<span class="ichip ichip-adapt" data-tip="Le porteur peut frapper dans N'IMPORTE quel élément (plus limité à sa paire déclarée)">🌈 élément libre</span>`,
    );
  }
  if (t?.renaissance) {
    n.push(
      `<span class="ichip ichip-adapt" data-tip="À la mort du porteur : renaît UNE fois par combat à ${Math.round(t.renaissance * 100)} % de ses PV">🥚 renaissance (${Math.round(t.renaissance * 100)} % PV)</span>`,
    );
  }
  if (t?.panoplie) {
    n.push(
      `<span class="ichip ichip-pano" data-tip="${echapperHtml(`${t.panoplie} (pièces portées par le même héros) : ${descriptionPanoplie(t.panoplie)}`)}">⬡ ${echapperHtml(t.panoplie)}</span>`,
    );
  }
  return `<span class="ichips">${n.join(``)}</span>`;
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
const arrondiPct = (e) => String(Math.round(e * 1000) / 10).replace(`.`, `,`);
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
      (d) =>
        `<span class="${d.valeur > 0 ? `delta-plus` : `delta-moins`}${d.utile ? `` : ` delta-inutile`}"${d.utile ? `` : ` data-tip="Peu utile pour cette classe (élément non utilisé)"`}>${d.valeur > 0 ? `+` : `−`}${Math.abs(Math.round(d.valeur * 10) / 10)}${libelleDelta(d.cle)}</span>`,
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
  const heros = herosAmeliores(inst, persos).filter((p) => p !== sauf);
  if (!heros.length) {
    return ``;
  }
  return `<span class="badges-heros" data-tip="Amélioration nette pour ces héros">${heros
    .map(
      (p) =>
        `<span class="badge-heros">▲ ${echapperHtml(CLASSES[p.classeId]?.nom ?? p.classeId)}</span>`,
    )
    .join(``)}</span>`;
}
