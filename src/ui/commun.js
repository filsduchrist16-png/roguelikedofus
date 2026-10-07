import { texteObtentionDofus, texteObtentionObjet } from "../jeu/obtention.js";
import { CLASSES, DOFUS, EQUIPEMENTS } from "../data/index.js";
import { DIFFICULTES, DIFFICULTE_MAX, DOSSIER_ICONE_SORT, RARETES_INFO } from "../jeu/config.js";
import {
  GAINS_ARCHETYPE,
  bonusDegatsIntelligence,
  multiplicateurSoin,
  multiplicateurStat,
  statElement,
} from "../jeu/progression.js";
import {
  bonusDegatsCritiques,
  chanceCritique,
  coutPA,
  meilleurElement,
  multiplicateurRelance,
  statsEffectives,
} from "../combat/stats.js";
import { chargerParametres } from "../sauvegarde/parametres.js";
export let racine;
export function definirRacine(e) {
  racine = e;
}
export const parametres = chargerParametres();
export function echapperHtml(e) {
  return e.replace(
    /[&<>]/g,
    (e) =>
      ({
        "&": `&amp;`,
        "<": `&lt;`,
        ">": `&gt;`,
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
export function afficherEcran(e, t = ``) {
  masquerElements();
  racine.innerHTML = `<div class="ecran${t ? ` ${t}` : ``}">${e}</div>`;
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
export function installerToucheEchap() {
  document.addEventListener(`keydown`, (e) => {
    if (e.key !== `Escape` || e.defaultPrevented) {
      return;
    }
    let document_activeElement = document.activeElement;
    if (
      document_activeElement instanceof HTMLInputElement ||
      document_activeElement instanceof HTMLTextAreaElement ||
      document_activeElement instanceof HTMLSelectElement
    ) {
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
export const IMG_TERMINER = cheminAsset(`/assets/menu/Terminer.png`);
export const IMG_DEPART = cheminAsset(`/assets/menu/Depart.png`);
export const IMG_RECOMMENCER_AVEC_PERSO = cheminAsset(`/assets/menu/Recommencer_avec_perso.png`);
export const imgMonde = (e) => cheminAsset(`/assets/menu/Monde_${e}.png`);
export const IMG_DOFUS = cheminAsset(`/assets/menu/dofus.png`);
const IMG_KAMAS = cheminAsset(`/assets/divers/kamas.png`);
const imgElement = (e) => cheminAsset(`/assets/elements/${e}.png`);
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
export function barreRetour(e, t = `Retour`) {
  return `<div class="boutons-ecran">${boutonRetour(e, t)}</div>`;
}
export function boutonContinuer(e) {
  return `<button id="${e}" class="btn-continuer" title="Continuer"><img src="${IMG_CONTINUER}" alt="Continuer" onerror="this.remove()" /></button>`;
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
      n = `<span class="tip-val dgt">⚔ ${Math.round(e.baseMin * i)} – ${Math.round(e.baseMax * i)}</span><span class="tip-el">selon la cible</span>`;
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
export function installerInfobulleDofus() {
  let e = document.createElement(`div`);
  e.className = `dofus-tip`;
  e.style.display = `none`;
  document.body.appendChild(e);
  elementsAMasquer.push(e);
  let t = (t) => {
    let n = t.dataset.nom ?? ``;
    let r = t.dataset.effet ?? ``;
    let i;
    i = t.dataset.possede
      ? `<div class="tip-muet">✓ Obtenu</div>`
      : `<div class="tip-muet">🔒 ${echapperHtml(t.dataset.obtention ?? ``)}</div>`;
    e.innerHTML =
      `<div class="tip-nom">${echapperHtml(n)}</div><div class="tip-effet">${echapperHtml(r)}</div>` +
      i;
    e.style.display = `block`;
    let a = t.getBoundingClientRect();
    let o = e.getBoundingClientRect();
    let s = a.left + a.width / 2 - o.width / 2;
    s = Math.max(8, Math.min(s, window.innerWidth - o.width - 8));
    let c = a.top - o.height - 10;
    if (c < 8) {
      c = a.bottom + 10;
    }
    e.style.left = `${s}px`;
    e.style.top = `${c}px`;
  };
  document.addEventListener(`mouseover`, (e) => {
    let n = e.target.closest?.(`.dofus-slot`);
    if (n) {
      t(n);
    }
  });
  document.addEventListener(`mouseout`, (t) => {
    let n = t.target.closest?.(`.dofus-slot`);
    if (n && !n.contains(t.relatedTarget)) {
      e.style.display = `none`;
    }
  });
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
  let e = document.createElement(`div`);
  e.className = `aide-tip`;
  e.style.display = `none`;
  document.body.appendChild(e);
  elementsAMasquer.push(e);
  let t = (t) => {
    let tip = t.dataset.tip;
    if (!tip) {
      return;
    }
    e.textContent = tip;
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
    let n = e.target.closest?.(`[data-tip]`);
    if (n) {
      t(n);
    }
  });
  document.addEventListener(`mouseout`, (t) => {
    let n = t.target.closest?.(`[data-tip]`);
    if (n && !n.contains(t.relatedTarget)) {
      e.style.display = `none`;
    }
  });
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
    ${t.icone ? `<img class="archetype-icone" src="${imgArchetype(n.archetype)}" alt="${NOMS_ARCHETYPES[n.archetype]}" title="${echapperHtml(i)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'classe-archetype',textContent:this.alt,title:this.title}))" />` : `<span class="classe-archetype" title="${echapperHtml(i)}">${NOMS_ARCHETYPES[n.archetype]}</span>`}
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
          ${t.img ? `<img src="${cheminAsset(t.img)}" alt="${echapperHtml(t.nom)}" loading="lazy" onerror="this.remove()" />` : ``}
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
    <img class="classe-portrait" src="${imgClasse(e)}" alt="" onerror="this.remove()" />
    <span class="classe-nom">${echapperHtml(r.nom)}</span>
    ${htmlElementsClasse(e)}
    <span class="classe-role">${echapperHtml(ROLES_CLASSES[e] ?? ``)}</span>
  </button>`;
}
export const SLOTS = [`arme`, `coiffe`, `cape`, `anneau`];
export const NOMS_SLOTS = {
  arme: `Arme`,
  coiffe: `Coiffe`,
  cape: `Cape`,
  anneau: `Anneau`,
};
const ABREV_STATS = {
  vitalite: `Vita`,
  force: `For`,
  intelligence: `Int`,
  agilite: `Agi`,
  chance: `Cha`,
  soin: `Soin`,
  prospection: `PP`,
  crit: `% Crit`,
};
export function resumeBonus(e, t = 0, n = {}) {
  let r = [];
  if (t) {
    r.push(`+${t} PV`);
  }
  for (let t of Object.keys(e)) {
    let n = e[t];
    if (n) {
      r.push(`+${n} ${ABREV_STATS[t] ?? t}`);
    }
  }
  for (let e of Object.keys(n)) {
    let t = n[e];
    if (t) {
      r.push(`+${Math.round(t * 100)} % rés ${NOMS_ELEMENTS[e]}`);
    }
  }
  return r.join(` · `);
}
export const classeRarete = (e) => {
  if (e?.rarete) {
    return ` rarete-${e.rarete}`;
  }
  return ``;
};
// infobulle « où trouver cet objet » (à mettre sur la carte d'un objet)
export const attrTipObjet = (id) => ` data-tip="${echapperHtml(texteObtentionObjet(id))}"`;
export function htmlNomObjet(e) {
  let t = EQUIPEMENTS[e.id];
  let n = echapperHtml(t?.nom ?? e.id);
  if (e.rarete) {
    return `<span class="inom-${e.rarete}" title="${RARETES_INFO[e.rarete].nom}">${n}</span>`;
  }
  return n;
}
export function htmlChipsObjet(e) {
  let t = EQUIPEMENTS[e.id];
  let n = [];
  let r = (e, t) => n.push(`<span class="ichip ${e}">${t}</span>`);
  let i = (e) => {
    if (e > 0) {
      return `+${e}`;
    }
    return `${e}`;
  };
  if (e.adaptatif) {
    n.push(
      `<span class="ichip ichip-adapt" title="Stat adaptative : s'ajoute à la carac de ta voie (élément choisi)">+${e.adaptatif} ★ Adapt.</span>`,
    );
  }
  if (t?.pvBonus) {
    r(`ichip-vitalite`, `+${t.pvBonus} PV`);
  }
  for (let t of Object.keys(e.stats)) {
    let n = e.stats[t];
    if (n) {
      r(`ichip-${t}${n < 0 ? ` malus` : ``}`, `${i(n)} ${ABREV_STATS[t] ?? t}`);
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
      `⚔ ${o.baseMin}–${o.baseMax} (${o.coutPA} PA)${o.cible === `ennemi_tous` ? ` · ligne arrière` : ``}${o.vampirisme ? ` · vol ${Math.round(o.vampirisme * 100)} %` : ``}`,
    );
  }
  if (t?.paGamble) {
    n.push(
      `<span class="ichip ichip-pa" title="À chaque tour : ${Math.round(t.paGamble.pPlus * 100)} % de gagner +${t.paGamble.plus} PA, sinon −${t.paGamble.moins} PA">🎲 ${Math.round(t.paGamble.pPlus * 100)} % +${t.paGamble.plus} PA / −${t.paGamble.moins}</span>`,
    );
  }
  if (t?.ligneAvant) {
    n.push(
      `<span class="ichip malus" title="Équipable uniquement sur un personnage de la ligne avant">Ligne avant uniqt</span>`,
    );
  }
  if (t?.riposteAvant) {
    n.push(
      `<span class="ichip ichip-force" title="Quand le porteur est frappé en ligne avant : ${Math.round(t.riposteAvant * 100)} % de chance de contre-attaquer">↩ ${Math.round(t.riposteAvant * 100)} % riposte (avant)</span>`,
    );
  }
  if (t?.esquiveArriere) {
    n.push(
      `<span class="ichip ichip-agilite" title="Quand le porteur est en ligne arrière : +${Math.round(t.esquiveArriere * 100)} % d'esquive">💨 +${Math.round(t.esquiveArriere * 100)} % esquive (arrière)</span>`,
    );
  }
  if (t?.soinDegatsRecus) {
    n.push(
      `<span class="ichip ichip-soin" title="À chaque coup encaissé, le porteur récupère ${Math.round(t.soinDegatsRecus * 100)} % des dégâts subis">♥ récup. ${Math.round(t.soinDegatsRecus * 100)} % des dégâts subis</span>`,
    );
  }
  if (t?.changeLigne) {
    n.push(
      `<span class="ichip ichip-pa" title="Confère le sort « Changer de ligne » : bascule avant ↔ arrière en combat pour ${t.changeLigne} PA">↕ change de ligne (${t.changeLigne} PA)</span>`,
    );
  }
  if (t?.perceResistances) {
    n.push(
      `<span class="ichip ichip-force" title="L'attaque de cette arme ignore ${Math.round(t.perceResistances * 100)} % des résistances de la cible">⚡ perce ${Math.round(t.perceResistances * 100)} % des rés.</span>`,
    );
  }
  if (t?.frappeDerriere) {
    n.push(
      `<span class="ichip ichip-force" title="L'attaque touche aussi l'ennemi juste derrière la cible">⤈ frappe aussi derrière</span>`,
    );
  }
  if (t?.prospParPvManquant) {
    n.push(
      `<span class="ichip ichip-prospection" title="Au moment du butin : +${t.prospParPvManquant} prospection par PV manquant du porteur">📦 +${t.prospParPvManquant} PP / PV manquant</span>`,
    );
  }
  if (t?.multKamas) {
    n.push(
      `<span class="ichip ichip-adapt" title="Les kamas gagnés en combat sont multipliés par ${t.multKamas}">🪙 kamas ×${t.multKamas}</span>`,
    );
  }
  if (t?.bouclierDebut) {
    n.push(
      `<span class="ichip ichip-vitalite" title="Commence chaque combat avec un bouclier de ${Math.round(t.bouclierDebut * 100)} % des PV max">🛡 bouclier de départ ${Math.round(t.bouclierDebut * 100)} %</span>`,
    );
  }
  if (t?.poisonArme) {
    n.push(
      `<span class="ichip malus" title="L'attaque de cette arme empoisonne la cible (${t.poisonArme.degats} dégâts pendant ${t.poisonArme.duree} tours)">☠ empoisonne (${t.poisonArme.degats}/t · ${t.poisonArme.duree} t)</span>`,
    );
  }
  if (t?.soinAllieBlesse) {
    n.push(
      `<span class="ichip ichip-soin" title="L'attaque soigne l'allié le plus blessé de ${Math.round(t.soinAllieBlesse * 100)} % des dégâts infligés">♥ soigne l'allié blessé (${Math.round(t.soinAllieBlesse * 100)} %)</span>`,
    );
  }
  if (t?.retraitPA) {
    n.push(
      `<span class="ichip ichip-pa" title="L'attaque a 30 % de chance de retirer ${t.retraitPA} PA à la cible">⛓ retrait ${t.retraitPA} PA (30 %)</span>`,
    );
  }
  if (t?.assome) {
    n.push(
      `<span class="ichip malus" title="L'attaque de cette arme a ${Math.round(t.assome * 100)} % de chance d'assommer la cible : elle passe son prochain tour">💫 assomme (${Math.round(t.assome * 100)} %)</span>`,
    );
  }
  if (t?.recupPASort) {
    n.push(
      `<span class="ichip ichip-pa" title="Après chaque sort lancé par le porteur : ${Math.round(t.recupPASort.chance * 100)} % de chance de récupérer ${t.recupPASort.pa} PA immédiatement">↺ ${Math.round(t.recupPASort.chance * 100)} % récup. ${t.recupPASort.pa} PA</span>`,
    );
  }
  if (t?.esquiveBonus) {
    n.push(
      `<span class="ichip ichip-agilite" title="+${Math.round(t.esquiveBonus * 100)} % d'esquive pour le porteur, quelle que soit sa ligne">💨 +${Math.round(t.esquiveBonus * 100)} % esquive</span>`,
    );
  }
  if (t?.esquiveParPiece) {
    n.push(
      `<span class="ichip ichip-agilite" title="Bonus de panoplie : +${Math.round(t.esquiveParPiece * 1000) / 10} % d'esquive par pièce de sa panoplie équipée (s'ajoute au +1 PA des 4 pièces)">💨 +${Math.round(t.esquiveParPiece * 1000) / 10} % esquive / pièce</span>`,
    );
  }
  if (t?.elementLibre) {
    n.push(
      `<span class="ichip ichip-adapt" title="Le porteur peut frapper dans N'IMPORTE quel élément (plus limité à sa paire déclarée)">🌈 élément libre</span>`,
    );
  }
  if (t?.renaissance) {
    n.push(
      `<span class="ichip ichip-adapt" title="À la mort du porteur : renaît UNE fois par combat à ${Math.round(t.renaissance * 100)} % de ses PV">🥚 renaissance (${Math.round(t.renaissance * 100)} % PV)</span>`,
    );
  }
  if (t?.panoplie) {
    n.push(
      `<span class="ichip ichip-pano" title="Panoplie ${echapperHtml(t.panoplie)} : +1 PA quand les 4 pièces sont portées par le même héros">⬡ ${echapperHtml(t.panoplie)}</span>`,
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
const arrondiPct = (e) => Math.round(e * 1000) / 10;
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
