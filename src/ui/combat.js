import { SORTS } from "../data/index.js";
import { statElement } from "../jeu/progression.js";
import {
  ELEMENTS,
  choisirElement,
  ciblesValides,
  coutPA,
  enLigneAvant,
  meilleurElement,
  resistanceTotale,
  statsEffectives,
} from "../combat/stats.js";
import { ordreDeJeu } from "../combat/moteur.js";
import { ETATS_CLASSE, ICONES_MARQUES } from "../combat/classes.js";
import { nomTouche } from "../sauvegarde/parametres.js";
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
  IMG_TERMINER,
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
let combatEnCours = false;
let combattantActif = null;
let sortChoisi = null;
let contexteCombat = null;
export function installerRaccourcisCombat() {
  document.addEventListener(`keydown`, (e) => {
    if (!contexteCombat || !combattantActif) {
      return;
    }
    if (e.key === parametres.toucheFinTour) {
      e.preventDefault();
      terminerAction(null);
      return;
    }
    if (e.key === `Escape` && sortChoisi) {
      sortChoisi = null;
      rendreCombat();
      return;
    }
    let t = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (t) {
      let n = Number(t[1]);
      let r = n === 1 ? combattantActif.armeSort : SORTS[combattantActif.sorts[n - 2]];
      if (r) {
        e.preventDefault();
        choisirSort(r);
      }
    }
  });
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
    e.innerHTML = infobulleSort(n, combattantActif);
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
    if (n) {
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
    .some((n) => e.paActuels >= coutPA(n, e) && ciblesValides(e, n, t).length > 0);
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
  if (e.meta) {
    let t = echapperHtml(e.meta.portion);
    n = n.replace(t, `<span class="log-el el-${e.meta.element}">${t}</span>`);
  }
  return `<div class="log-line log-${t}">${n}</div>`;
}
function rafraichirJournal() {
  let e = document.getElementById(`journal`);
  if (e) {
    e.innerHTML = journalCombat.map(htmlLigneJournal).join(``);
    e.scrollTop = e.scrollHeight;
  }
}
export function journaliser(msg, meta) {
  journalCombat.push({
    msg,
    meta,
  });
  if (journalCombat.length > 200) {
    journalCombat.shift();
  }
  rafraichirJournal();
}
// Défi du combat en cours (challenges façon DOFUS).
let defiCombat = null;
export function definirDefiCombat(defi) {
  defiCombat = defi;
  const hote = document.getElementById(`cb-defi`);
  if (hote) {
    hote.innerHTML = htmlDefi();
  }
}
function htmlDefi() {
  if (!defiCombat) {
    return ``;
  }
  return `<div class="defi-combat" title="Réussis le défi pour gagner +30 % d'XP et de kamas">
    <span class="defi-nom">🎯 Défi ${echapperHtml(defiCombat.nom)}</span>
    <span class="defi-texte">${echapperHtml(defiCombat.texte)}</span>
    <small class="defi-bonus">+30 % XP et kamas</small>
  </div>`;
}
export function initialiserVueCombat(e, t, n = null) {
  defiCombat = null;
  combattants = e;
  titreCombat = t;
  resolveurAction = n;
  journalCombat = [];
  combattantActif = null;
  sortChoisi = null;
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
  });
}
function terminerAction(e) {
  let t = contexteCombat;
  combattantActif = null;
  sortChoisi = null;
  contexteCombat = null;
  rendreCombat();
  t?.(e);
}
function sortJouable(lanceur, sort) {
  return (
    lanceur.paActuels >= coutPA(sort, lanceur) &&
    ciblesValides(lanceur, sort, combattants).length > 0
  );
}
function lancerSurSoi(sort) {
  terminerAction({
    sort,
    cibleRef: combattantActif.ref,
  });
}
function choisirSort(sort) {
  let t = combattantActif;
  if (!t || !contexteCombat || !sort) {
    return;
  }
  // un second clic sur le sort sélectionné l'annule (ou le lance s'il n'a pas de cible à choisir)
  if (sortChoisi?.id === sort.id) {
    if (sansCibleAChoisir(sort)) {
      lancerSurSoi(sort);
    } else {
      sortChoisi = null;
      rendreCombat();
    }
    return;
  }
  // les raccourcis clavier passent par ici : mêmes conditions que les boutons (PA, recharge, cibles)
  if (!sortJouable(t, sort)) {
    if (t.paActuels >= coutPA(sort, t)) {
      journaliser(`${sort.nom} : aucune cible valable pour l'instant.`);
    }
    return;
  }
  if (sansCibleAChoisir(sort) && !ecranTactile()) {
    lancerSurSoi(sort);
    return;
  }
  sortChoisi = sort;
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
  let s = ELEMENTS.map((t) => {
    let n = Math.round(resistanceTotale(e, t) * 100);
    return `<span class="res-chip ${n < 0 ? `faible` : n === 0 ? `zero` : ``}${t === o ? ` vise` : ``}" title="${t === o ? `Résistance ${NOMS_ELEMENTS[t]} · ton élément de frappe contre cette cible` : `Résistance ${NOMS_ELEMENTS[t]}`}"><img src="${IMGS_RESISTANCE[t]}" alt="" onerror="this.remove()" />${n > 0 ? `+` : ``}${n}%</span>`;
  }).join(``);
  let c = [];
  for (let t of e.effets) {
    if (t.stat === `vitalite`) {
      c.push(`+PV (${t.toursRestants})`);
    } else if (t.stat === `degatsInfliges`) {
      c.push(`${t.valeur >= 0 ? `+` : `−`}dégâts (${t.toursRestants})`);
    } else if (t.stat === `poison`) {
      c.push(`☠ poison (${t.toursRestants})`);
    } else if (t.stat === `hot`) {
      c.push(`♥ soin/t (${t.toursRestants})`);
    } else if (t.stat === `initiative`) {
      c.push(`⏳ init ${t.valeur} (${t.toursRestants})`);
    } else if (t.stat === `contre`) {
      c.push(`⚔️ Contre ${Math.round(t.valeur * 100)} % (${t.toursRestants})`);
    } else if (t.stat === `proie`) {
      c.push(`🎯 Proie (vol ${Math.round(t.valeur * 100)} %)`);
    } else if (t.stat === `tetanise`) {
      c.push(`🦴 Tétanisé (${t.toursRestants})`);
    } else if (t.stat === `assome`) {
      c.push(`💫 Assommé`);
    } else if (t.stat === `echecCritique`) {
      c.push(`🌀 Échec ${Math.round(t.valeur * 100)} % (${t.toursRestants})`);
    } else if (t.stat === `armure`) {
      c.push(`🪨 Armure +${t.valeur} (${t.toursRestants})`);
    } else if (t.stat === `degatsCritSubis`) {
      c.push(`🃏 Crit subis +${Math.round(t.valeur * 100)} % (${t.toursRestants})`);
    } else if (t.stat === `esquive`) {
      c.push(`💨 Esquive +${Math.round(t.valeur * 100)} % (${t.toursRestants})`);
    } else if (t.stat === `bonusPieges`) {
      c.push(`🪤 Pièges +${Math.round(t.valeur * 100)} % (${t.toursRestants})`);
    } else if (t.stat === `infection`) {
      c.push(`🌿 Infecté (${t.toursRestants})`);
    }
  }
  if (e.etatClasse && ETATS_CLASSE[e.etatClasse]) {
    c.push(`${ETATS_CLASSE[e.etatClasse].icone} ${ETATS_CLASSE[e.etatClasse].nom}`);
  }
  if (e.marqueElement) {
    c.push(`${ICONES_MARQUES[e.marqueElement]} Marque ${NOMS_ELEMENTS[e.marqueElement]}`);
  }
  if (e.tourelle) {
    c.push(`⚙️ Tourelle niv. ${e.niveauTourelle ?? 1}`);
  } else if (e.creature) {
    c.push(`🐾 Créature`);
  }
  if ((e.bombes ?? 0) > 0) {
    c.push(`💣 ×${e.bombes}`);
  }
  if ((e.telefrags ?? 0) > 0) {
    c.push(`⌛ ×${e.telefrags}`);
  }
  if ((e.portails ?? 0) > 0) {
    c.push(`🌀 ×${e.portails}`);
  }
  if ((e.rage ?? 0) > 0) {
    c.push(`🐺 Rage ×${e.rage}`);
  }
  if ((e.chausseTrappe ?? 0) > 0) {
    c.push(`🪤 Chausse-Trappe ×${e.chausseTrappe}`);
  }
  if (e.provoque) {
    c.push(`🛡 Provoque`);
  }
  if ((e.coupsAnnulesRestants ?? 0) > 0) {
    c.push(`🐺 ${e.coupsAnnulesRestants} coup(s) annulé(s)`);
  }
  if (e.bonusOffensifProchain > 0) {
    c.push(`+${Math.round(e.bonusOffensifProchain * 100)} % prochain`);
  }
  if (e.maxRollCharges > 0) {
    c.push(`Œil affûté ×${e.maxRollCharges}`);
  }
  if (e.paBonusNextTurn !== 0) {
    c.push(`${e.paBonusNextTurn > 0 ? `+` : ``}${e.paBonusNextTurn} PA`);
  }
  if (e.estEgide && (e.toursRestantsInvocation ?? 0) > 0) {
    c.push(`🛡️ Égide (${e.toursRestantsInvocation})`);
  }
  let l = enLigneAvant(e) ? `avant` : `arriere`;
  return `
    <div class="${[
      `carte`,
      e.camp === `joueur` ? `carte-joueur` : `carte-ennemi`,
      `ligne-${l}`,
      n ? `ko` : ``,
      e === combattantActif ? `actif` : ``,
      t ? `ciblable` : ``,
      e.archi ? `archi` : ``,
    ]
      .filter(Boolean)
      .join(` `)}" data-ref="${e.ref}">
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
      <div class="pv-barre${n ? ` ko` : ``}" style="--pv-pct:${i}%" title="${r} / ${e.pvMax} PV">
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
      <div class="badges">${c.map((e) => `<span class="badge">${echapperHtml(e)}</span>`).join(``)}</div>
      ${n ? `<div class="ko-label">K.O.</div>` : ``}
    </div>`;
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
  rafraichirJournal();
  if (combattantActif && sortChoisi) {
    montrerCibles();
    racine.querySelectorAll(`.carte.ciblable, .tl-pastille.ciblable`).forEach((e) => {
      e.addEventListener(`click`, () => {
        terminerAction({
          sort: sortChoisi,
          cibleRef: e.dataset.ref,
        });
      });
    });
  }
  racine.querySelectorAll(`[data-ref]`).forEach((e) => {
    let ref = e.dataset.ref;
    let n = () => racine.querySelectorAll(`[data-ref="${ref}"]`);
    e.addEventListener(`mouseenter`, () => n().forEach((e) => e.classList.add(`lie-survol`)));
    e.addEventListener(`mouseleave`, () => n().forEach((e) => e.classList.remove(`lie-survol`)));
  });
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
  return `<div class="timeline"><div class="tl-liste">${t
    .map((e) => {
      let e_camp = e.camp;
      let r = e === combattantActif ? `actif` : ``;
      let i = n.some((t) => t.ref === e.ref) ? `ciblable` : ``;
      let a = e.img
        ? `<img src="${cheminAsset(e.img)}" alt="" onerror="this.remove()" />`
        : `<span class="tl-ini">${initiativeEffective(e)}</span>`;
      return `<div class="tl-pastille ${e_camp} ${r} ${i}" data-ref="${e.ref}" title="${echapperHtml(e.nom)} · init ${initiativeEffective(e)}">${a}</div>`;
    })
    .join(``)}</div></div>`;
}
function htmlBarreSorts() {
  if (!combattantActif) {
    return `<div class="attente">En attente…</div>`;
  }
  let e = combattantActif;
  let e_armeSort = e.armeSort;
  let n =
    (e_armeSort
      ? `<button class="sort ${sortChoisi?.id === e_armeSort.id ? `choisi` : ``}" data-arme="1" ${sortJouable(e, e_armeSort) ? `` : `disabled`} title="${echapperHtml(e_armeSort.nom)}, attaque d'arme">
        <span class="sort-touche">1</span>
        <span class="sort-pa-badge"><img src="${IMG_ETOILE}" alt="" onerror="this.remove()" /><b>${coutPA(e_armeSort, e)}</b></span>
        <span class="sort-icon-wrap"><img class="sort-icon" src="${e_armeSort.img ? cheminAsset(e_armeSort.img) : ``}" alt="" onerror="this.closest('.sort-icon-wrap')?.remove()" /></span>
        ${pastilleElementSort(e_armeSort, e)}
      </button>`
      : `<div class="sort sort-cac" title="Corps à corps, aucune arme équipée">
        <span class="sort-touche">1</span>
        <span class="sort-icon-vide">🗡️</span>
      </div>`) +
    e.sorts
      .map((e) => SORTS[e])
      .map((t, n) => {
        let r = e.cooldowns[t.id] ?? 0;
        let i = ciblesValides(e, t, combattants).length === 0;
        let a = coutPA(t, e);
        let o = e.paActuels >= a && r <= 0 && !i;
        return `<button class="sort ${sortChoisi?.id === t.id ? `choisi` : ``} ${r > 0 ? `cooldown` : ``}" data-sort="${t.id}" ${o ? `` : `disabled`} ${i ? `title="Aucune cible valable"` : ``}>
        <span class="sort-touche">${n + 2}</span>
        <span class="sort-pa-badge"><img src="${IMG_ETOILE}" alt="" onerror="this.remove()" /><b>${a}</b></span>
        <span class="sort-icon-wrap"${attrElementSort(t, e)}><span class="sort-nom-fallback">${echapperHtml(t.nom)}</span><img class="sort-icon" src="${iconeSort(t.id)}" alt="" onerror="this.closest('.sort-icon-wrap')?.classList.add('noicon'); this.remove()" /></span>
        ${pastilleElementSort(t, e)}
        ${r > 0 ? `<span class="sort-cd" title="Rechargement : ${r} tour(s)">${r}</span>` : ``}
      </button>`;
      })
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
    document.getElementById(`sort-lancer`)?.addEventListener(`click`, () => {
      if (sortChoisi) {
        lancerSurSoi(sortChoisi);
      }
    });
    document.getElementById(`sort-annuler`)?.addEventListener(`click`, () => {
      sortChoisi = null;
      rendreCombat();
    });
  });
  let r;
  if (sortChoisi) {
    const consigne = sansCibleAChoisir(sortChoisi)
      ? `<button id="sort-lancer" class="primaire">Lancer ${echapperHtml(sortChoisi.nom)}</button>`
      : `<span class="aide-consigne">Choisis une cible pour <b>${echapperHtml(sortChoisi.nom)}</b>.</span>`;
    r = `<div class="aide aide-sort">
      <div class="aide-sort-tete">${consigne}<button id="sort-annuler" class="secondaire">Annuler</button></div>
      <div class="aide-sort-detail">${infobulleSort(sortChoisi, e)}</div>
    </div>`;
  } else {
    r = `<div class="aide">Tour de <b>${echapperHtml(e.nom)}</b> : choisis un sort.</div>`;
  }
  return `
    <div class="sorts-rangee">
      <div class="sorts-zone"><div class="sorts-liste">${n}</div></div>
      <div class="barre-actions-fin"><button id="fin-tour" class="fin-tour primaire" title="Terminer le tour"><img src="${IMG_TERMINER}" alt="Terminer le tour" onerror="this.replaceWith('Terminer le tour')" /> <kbd>${echapperHtml(nomTouche(parametres.toucheFinTour))}</kbd></button></div>
    </div>
    ${r}`;
}
