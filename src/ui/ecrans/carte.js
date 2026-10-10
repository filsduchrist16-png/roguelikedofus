import { CLASSES, COMBATS, MONDES, MONSTRES, ZONES } from "../../data/index.js";
import { AFFIXES_GROUPE, CONFIG_ARCHI, DIFFICULTES } from "../../jeu/config.js";
import { cheminVisite, noeudsAtteignables, trouverNoeud } from "../../carte/generation.js";
import { effetsDifficulte, pvMaxPerso } from "../../jeu/run.js";
import { xpPourNiveau } from "../../jeu/progression.js";
import {
  IMG_ARMURERIE,
  IMG_BESTIAIRE,
  IMG_CARACTERISTIQUES,
  IMG_COEUR,
  IMG_DEPART,
  IMG_DOFUS,
  IMG_FORMATION,
  IMG_INVENTAIRE,
  IMG_MENU,
  IMG_RECOMMENCER,
  IMG_RECOMMENCER_AVEC_PERSO,
  cheminAsset,
  demanderConfirmation,
  ecranTactile,
  echapperHtml,
  etoilesDifficulte,
  htmlKamas,
  imgSymboleClasse,
  masquerElements,
  pastillesElementsPerso,
  racine,
} from "../commun.js";
import { ecranEquipement } from "./equipement.js";
import { ecranBestiaire } from "./bestiaire.js";
import { ecranArmurerie } from "./armurerie.js";
import { ecranDofus } from "./dofus.js";
import { ecranFormation } from "./formation.js";
import { ecranCaracteristiques } from "./caracteristiques.js";
const ICONES_NOEUDS = {
  combat: `⚔️`,
  combat_dur: `💀`,
  taverne: `🍺`,
  otomai: `🧪`,
  zaap: `🌀`,
  donjon: `🐉`,
  hdv: `🪙`,
  forgemagie: `🔨`,
  rencontre: `❓`,
};
const NOMS_NOEUDS = {
  combat: `Combat`,
  combat_dur: `Combat dur`,
  taverne: `Taverne`,
  otomai: `Otomai`,
  zaap: `Zaap`,
  donjon: `Donjon`,
  hdv: `Hôtel de vente`,
  forgemagie: `Forgemage`,
  rencontre: `Rencontre`,
};
// Contenu des cases sans combat, affiché au survol (PC) ou dans le panneau de sélection (tactile).
const DESC_NOEUDS = {
  taverne: `Taverne : soigne ou recrute`,
  otomai: `Otomai : philtre d'archimonstre`,
  zaap: `Zaap : case surprise`,
  hdv: `Hôtel de vente : vends ou achète des objets`,
  forgemagie: `Forgemage : monter la rareté`,
  rencontre: `Rencontre : évènement au hasard`,
};
const IMAGES_NOEUDS = {
  combat: `combat`,
  combat_dur: `combat_elite`,
  taverne: `taverne`,
  otomai: `otomai`,
  zaap: `zaap`,
  donjon: `donjon`,
  hdv: `hdv`,
  forgemagie: `forgemagie`,
  rencontre: `rencontre`,
};
function imageBossDonjon(e) {
  let t = e.combatId ? COMBATS[e.combatId]?.ennemis : undefined;
  let n = t?.find((e) => MONSTRES[e.monstre]?.boss) ?? t?.[0];
  let r = n ? MONSTRES[n.monstre]?.img : undefined;
  if (r) {
    return cheminAsset(r);
  }
  return null;
}
// Affixe d'un combat dur (« Cuirassés »…), ou undefined.
function affixeNoeud(noeud) {
  if (noeud.type !== `combat_dur`) {
    return undefined;
  }
  const id = (noeud.eliteModifs ?? []).find((m) => AFFIXES_GROUPE.some((a) => a.id === m));
  return id ? AFFIXES_GROUPE.find((a) => a.id === id) : undefined;
}
// « 2× Bouftou, Tofu » : les monstres d'un groupe, regroupés par espèce.
function listeMonstres(ennemis) {
  const comptes = new Map();
  for (const en of ennemis) {
    const nom = MONSTRES[en.monstre]?.nom ?? en.monstre;
    comptes.set(nom, (comptes.get(nom) ?? 0) + 1);
  }
  return [...comptes].map(([nom, n]) => (n > 1 ? `${n}× ${nom}` : nom)).join(`, `);
}
// Texte (brut, plusieurs lignes) qui décrit ce qui attend le joueur sur une case.
export function texteCase(noeud) {
  const nomType = NOMS_NOEUDS[noeud.type] ?? noeud.type;
  const combat = noeud.combatId ? COMBATS[noeud.combatId] : undefined;
  if (![`combat`, `combat_dur`, `donjon`].includes(noeud.type) || !combat) {
    return DESC_NOEUDS[noeud.type] ?? nomType;
  }
  const ennemis = combat.ennemis ?? [];
  // certains noms de combat commencent déjà par « Donjon : »
  const lignes = [combat.nom.startsWith(nomType) ? combat.nom : `${nomType} : ${combat.nom}`];
  let autres = ennemis;
  if (noeud.type === `donjon`) {
    const boss = ennemis.filter((en) => MONSTRES[en.monstre]?.boss);
    if (boss.length) {
      lignes.push(`Boss : ${listeMonstres(boss)}`);
      autres = ennemis.filter((en) => !boss.includes(en));
    }
  }
  if (autres.length) {
    lignes.push(
      `${autres.length} ${noeud.type === `donjon` ? `sbire` : `monstre`}${autres.length > 1 ? `s` : ``} : ${listeMonstres(autres)}`,
    );
  }
  const affixe = affixeNoeud(noeud);
  if (affixe) {
    lignes.push(`${affixe.nom} : ${affixe.desc}`);
  }
  return lignes.join(`\n`);
}
// Raccourcis 1, 2, 3… : cases atteignables triées de haut en bas (puis de gauche à droite).
export function ordreRaccourcis(cases) {
  return [...cases].sort((a, b) => a.y - b.y || a.x - b.x).map((c) => c.id);
}
// Niveau maximum du monde qui contient la zone (retrouvée par son nom), ou null.
export function niveauMaxDeZone(nomZone, zones = ZONES, mondes = MONDES) {
  const zone = zones.find((z) => z.nom === nomZone);
  const monde = zone && mondes.find((m) => m.zones.includes(zone.id));
  return monde?.niveaux?.[1] ?? null;
}
const LETTRES_OUTILS = {
  e: `carte-equip`,
  s: `carte-persos`,
  f: `carte-formation`,
  b: `carte-bestiaire`,
};
const imageNoeud = (e) =>
  (e.type === `donjon` ? imageBossDonjon(e) : null) ??
  cheminAsset(`/assets/cases/${IMAGES_NOEUDS[e.type]}.png`);
const CARTE_HAUTEUR = 500;
const CARTE_PAS_X = 116;
const CARTE_MARGE = 56;
// onModif : appelé après un changement fait depuis la carte (équipement, formation) pour sauvegarder la run
// Caméra : la carte défile pour montrer la case actuelle et les cases atteignables (sinon, on
// revenait au départ de la zone après chaque combat).
function centrerCarte() {
  const sc = racine.querySelector(`.map-scroll`);
  const cases = [...racine.querySelectorAll(`.map-node.atteignable, .map-node.courant`)];
  if (!sc || !cases.length) {
    return;
  }
  const box = sc.getBoundingClientRect();
  const rects = cases.map((c) => c.getBoundingClientRect());
  const milieuX =
    (Math.min(...rects.map((r) => r.left)) + Math.max(...rects.map((r) => r.right))) / 2;
  const milieuY =
    (Math.min(...rects.map((r) => r.top)) + Math.max(...rects.map((r) => r.bottom))) / 2;
  // les cases atteignables un peu à droite du centre : on voit d'où l'on vient et où l'on va
  sc.scrollLeft = Math.max(0, sc.scrollLeft + milieuX - box.left - sc.clientWidth * 0.45);
  sc.scrollTop = Math.max(0, sc.scrollTop + milieuY - box.top - sc.clientHeight / 2);
  // sur téléphone, la carte entière dans l'écran plutôt que la barre d'outils
  const haut = sc.getBoundingClientRect();
  if (haut.bottom > innerHeight || haut.top < 0) {
    window.scrollTo({ top: Math.max(0, scrollY + haut.top - 8) });
  }
}
export function ecranCarte(
  e,
  t,
  n,
  r,
  i = [],
  a = 0,
  o = 0,
  s = 0,
  onModif = () => {},
  effets = [],
  infosZone = {},
) {
  return new Promise((resolveBrut) => {
    const mortDefinitive = !!effetsDifficulte(o).mortDefinitive;
    const niveauMax = infosZone.niveauMax ?? niveauMaxDeZone(r);
    // Clavier : retiré à chaque re-rendu, à l'ouverture d'un sous-écran et à la sortie.
    let toucheCarte = null;
    const nettoyer = () => {
      if (toucheCarte) {
        document.removeEventListener(`keydown`, toucheCarte);
        toucheCarte = null;
      }
    };
    const resolve = (v) => {
      nettoyer();
      resolveBrut(v);
    };
    // Sous-écran ouvert depuis la carte : plus de raccourcis tant qu'il est affiché.
    const sousEcran = (id, action) =>
      document.getElementById(id)?.addEventListener(`click`, async () => {
        nettoyer();
        await action();
        l();
      });
    let l = () => {
      nettoyer();
      const tactile = ecranTactile();
      let d = Math.max(...e.noeuds.map((e) => e.ligne));
      let f = CARTE_MARGE * 2 + (d + 1) * CARTE_PAS_X;
      let p = {
        x: CARTE_MARGE,
        y: CARTE_HAUTEUR / 2,
      };
      let m = new Map();
      let h = new Map();
      for (let t of e.noeuds) {
        h.set(t.ligne, (h.get(t.ligne) ?? 0) + 1);
      }
      let g = CARTE_HAUTEUR / (Math.max(1, ...h.values()) + 1);
      for (let t of e.noeuds) {
        m.set(t.id, {
          x: CARTE_MARGE + (t.ligne + 1) * CARTE_PAS_X,
          y: CARTE_HAUTEUR / 2 + t.colonne * g,
        });
      }
      let _ = new Set(noeudsAtteignables(e).map((e) => e.id));
      const numeros = new Map(
        ordreRaccourcis([..._].map((id) => ({ id, ...m.get(id) }))).map((id, k) => [id, k + 1]),
      );
      const appelSoin = !mortDefinitive && t.some((p) => p.pvActuels <= 0);
      let v = (t) => e.courant === t || (e.courant === null && trouverNoeud(e, t)?.ligne === 0);
      let ee = (e, t, n, r = false) => {
        let i = t.x - e.x;
        let a = t.y - e.y;
        let o = Math.hypot(i, a);
        if (o <= 84) {
          return ``;
        }
        let s = 42 / o;
        return `<line x1="${e.x + i * s}" y1="${e.y + a * s}" x2="${t.x - i * s}" y2="${t.y - a * s}" class="arete ${n ? `arete-actif` : ``} ${r ? `arete-emprunte` : ``}"/>`;
      };
      let y = e.noeuds
        .flatMap((t) =>
          t.suivants.map((n) =>
            ee(m.get(t.id), m.get(n), _.has(n) && v(t.id), cheminVisite(e, t.id, n)),
          ),
        )
        .join(``);
      let b = e.depart
        .map((t) => ee(p, m.get(t), e.courant === null, cheminVisite(e, null, t)))
        .join(``);
      let te = e.noeuds
        .map((t) => {
          let n = m.get(t.id);
          let r = _.has(t.id);
          let i = [
            `map-node`,
            `t-${t.type}`,
            t.visite ? `visite` : ``,
            t.id === e.courant ? `courant` : ``,
            r ? `atteignable` : ``,
            r && appelSoin && t.type === `taverne` ? `appel-soin` : ``,
          ]
            .filter(Boolean)
            .join(` `);
          let o = affixeNoeud(t);
          let s = ` data-tip="${echapperHtml(texteCase(t))}"`;
          let num = r && !tactile && numeros.get(t.id);
          return `<button class="${i}" data-id="${t.id}" ${r ? `` : `disabled`}${t.id === e.courant ? ` aria-current="location"` : ``} style="left:${n.x}px;top:${n.y}px"${s}>
            <span class="case-art">
              <img class="case-img" src="${imageNoeud(t)}" alt="" onerror="this.onerror=null;this.nextElementSibling.style.display='';this.remove()" />
              <span class="mn-icon" style="display:none">${ICONES_NOEUDS[t.type]}</span>
            </span>
            <span class="mn-lbl">${NOMS_NOEUDS[t.type]}${o ? `<small class="mn-modif"> · ${echapperHtml(o.nom)}</small>` : ``}</span>
            ${num && num <= 9 ? `<kbd class="mn-kbd" aria-hidden="true">${num}</kbd>` : ``}
          </button>`;
        })
        .join(``);
      let x = t
        .map((e) => {
          let t = CLASSES[e.classeId];
          let n = pvMaxPerso(e);
          let r = Math.max(0, Math.round((e.pvActuels / n) * 100));
          let i = Math.max(0, Math.round(e.pvActuels));
          let ko = e.pvActuels <= 0;
          let niv = e.progression.niveau;
          let besoin = xpPourNiveau(niv);
          let xp = Math.max(0, Math.round(e.progression.xp ?? 0));
          // Au plafond du monde, l'XP ne s'accumule plus (gagnerXp la remet à 0).
          let auPlafond = niveauMax != null && niv >= niveauMax;
          let pctXp = auPlafond ? 100 : Math.max(0, Math.min(100, Math.round((xp / besoin) * 100)));
          let tipXp = auPlafond
            ? `Niveau max du monde atteint`
            : `XP : ${xp} / ${besoin} vers le niveau ${niv + 1}`;
          return `
            <div class="aside-perso ${e.flashNiveau ? `flash-niv` : ``} ${ko ? `ko` : ``}">
              ${e.flashNiveau ? `<span class="niv-flash">⬆ Niveau ${e.progression.niveau} !</span>` : ``}
              ${ko ? `<span class="ko-badge">K.O.</span>` : ``}
              <img class="aside-sym" src="${imgSymboleClasse(e.classeId)}" alt="" onerror="this.remove()" />
              <span class="pv-gem pv-gem-aside ${i <= 0 ? `ko` : ``}" title="${i} / ${n} PV" style="--pv-pct:${r}%">
                <img class="pv-vide" src="${IMG_COEUR}" alt="" onerror="this.remove()" />
                <img class="pv-plein" src="${IMG_COEUR}" alt="" onerror="this.remove()" />
                <b class="pv-num">${i}<span>/${n}</span></b>
              </span>
              <div class="aside-info">
                <div class="aside-nom">${echapperHtml(t.nom)}${pastillesElementsPerso(e)}</div>
                <div class="aside-niv${auPlafond ? ` au-plafond` : ``}" data-tip="${echapperHtml(tipXp)}">Niv.${niv}<span class="aside-xp" role="progressbar" aria-label="Expérience" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pctXp}"><span style="width:${pctXp}%"></span></span></div>
                ${ko ? `<div class="ko-sous">${mortDefinitive ? `tombé pour de bon` : `se relève en taverne`}</div>` : ``}
              </div>
            </div>`;
        })
        .join(``);
      t.forEach((e) => {
        e.flashNiveau = false;
      });
      masquerElements();
      racine.innerHTML = `
        <div class="carte-ecran map-layout">
          <header class="map-topbar">
            <h2 class="zone-titre">${infosZone.zoneNum ? `<span class="zone-num">Zone ${Number(infosZone.zoneNum)}${infosZone.nbZones ? `/${Number(infosZone.nbZones)}` : ``}</span> · ` : ``}${echapperHtml(r)}${infosZone.tierObjets != null ? `<span class="asc-badge zone-tier" data-tip="Tier : numéro de la zone où tombent les objets, compté depuis le Monde 1">objets T${Number(infosZone.tierObjets)}</span>` : ``}${o >= 1 ? `<span class="asc-badge" data-tip="${echapperHtml(DIFFICULTES[o].desc)}">${etoilesDifficulte(o)}</span>` : ``}${s >= 1 ? `<span class="asc-badge" data-tip="Philtres d'Otomai bus : les archimonstres apparaissent plus souvent (${CONFIG_ARCHI.philtresMax} au maximum)">🧪 ${Math.min(s, CONFIG_ARCHI.philtresMax)}/${CONFIG_ARCHI.philtresMax}</span>` : ``}</h2>
            ${effets.length ? `<div class="zone-effets">${effets.map((x) => `<span class="zone-effet" data-tip="${echapperHtml(x.desc)}">${x.icone} ${echapperHtml(x.nom)}</span>`).join(``)}</div>` : ``}
            <div class="topbar-actions">
              <button id="carte-persos" class="aside-icone" title="Caractéristiques (S)"><img src="${IMG_CARACTERISTIQUES}" alt="Caractéristiques" onerror="this.remove()" /><span class="aside-lbl">Stats</span></button>
              <button id="carte-formation" class="aside-icone" title="Formation (F)"><img src="${IMG_FORMATION}" alt="Formation" onerror="this.remove()" /><span class="aside-lbl">Formation</span></button>
              <button id="carte-equip" class="aside-icone" title="Équipement (E)${i.length ? ` · ${i.length} objet(s)` : ``}"><img src="${IMG_INVENTAIRE}" alt="Équipement" onerror="this.remove()" />${i.length ? `<span class="aside-compte">${i.length}</span>` : ``}<span class="aside-lbl">Équipement</span></button>
              <button id="carte-bestiaire" class="aside-icone" title="Bestiaire (B)"><img src="${IMG_BESTIAIRE}" alt="Bestiaire" onerror="this.remove()" /><span class="aside-lbl">Bestiaire</span></button>
              <button id="carte-armurerie" class="aside-icone" title="Armurerie"><img src="${IMG_ARMURERIE}" alt="Armurerie" onerror="this.parentElement.textContent='🛡️'" /><span class="aside-lbl">Armurerie</span></button>
              <button id="carte-dofus" class="aside-icone" title="Dofus"><img src="${IMG_DOFUS}" alt="Dofus" onerror="this.remove()" /><span class="aside-lbl">Dofus</span></button>
              <span class="topbar-sep"></span>
              <button id="carte-accueil" class="aside-icone" title="Retour à l'accueil (la run reste sauvegardée)"><img src="${IMG_MENU}" alt="Accueil" onerror="this.remove()" /><span class="aside-lbl">Accueil</span></button>
              <button id="carte-restart" class="aside-icone" title="Recommencer avec les mêmes héros (abandonne la run en cours)"><img src="${IMG_RECOMMENCER}" alt="Recommencer" onerror="this.remove()" /><span class="aside-lbl">Rejouer</span></button>
              <button id="carte-restart-choix" class="aside-icone" title="Recommencer en choisissant d'autres héros (abandonne la run en cours)"><img src="${IMG_RECOMMENCER_AVEC_PERSO}" alt="Recommencer (autres héros)" onerror="this.remove()" /><span class="aside-lbl">Autre équipe</span></button>
            </div>
          </header>
          <div class="map-scroll"><div class="map-zone" style="width:${f}px;height:${CARTE_HAUTEUR}px">
            <svg class="map-svg" width="${f}" height="${CARTE_HAUTEUR}">${b}${y}</svg>
            ${te}
            <div class="map-depart" style="left:${p.x}px;top:${p.y}px">
              <span class="case-art">
                <img class="case-img" src="${IMG_DEPART}" alt="" onerror="this.onerror=null;this.nextElementSibling.style.display='';this.remove()" />
                <span class="depart-art" style="display:none">🚩</span>
              </span>
              <span class="mn-lbl">Départ</span>
            </div>
          </div></div>
          <footer class="map-equipe-bar">
            <div class="case-panneau" hidden>
              <p class="cp-texte"></p>
              <div class="cp-actions">
                <button type="button" class="cp-fermer" aria-label="Fermer">✕</button>
                <button type="button" class="primaire cp-aller">Y aller</button>
              </div>
            </div>
            <div class="equipe-bar">${x}</div>
            <div class="aside-kamas" title="Kamas de la run (perdus à la mort)">${htmlKamas(a)}</div>
          </footer>
        </div>`;
      centrerCarte();
      // menu du haut : un dégradé à droite tant qu'il reste des boutons hors écran
      const menuHaut = racine.querySelector(`.topbar-actions`);
      if (menuHaut) {
        const maj = () =>
          menuHaut.classList.toggle(
            `suite`,
            menuHaut.scrollLeft + menuHaut.clientWidth < menuHaut.scrollWidth - 4,
          );
        menuHaut.addEventListener(`scroll`, maj, { passive: true });
        maj();
      }
      const aller = (id) => {
        let n = trouverNoeud(e, id);
        if (n) {
          resolve(n);
        }
      };
      // Tactile : un premier appui sélectionne la case et décrit son contenu, le second valide.
      const panneau = racine.querySelector(`.case-panneau`);
      let selId = null;
      const deselectionner = () => {
        selId = null;
        racine.querySelectorAll(`.map-node.sel`).forEach((b) => b.classList.remove(`sel`));
        if (panneau) {
          panneau.hidden = true;
        }
      };
      const selectionner = (bouton) => {
        deselectionner();
        selId = bouton.dataset.id;
        bouton.classList.add(`sel`);
        if (panneau) {
          panneau.querySelector(`.cp-texte`).textContent = bouton.dataset.tip ?? ``;
          panneau.hidden = false;
        }
      };
      racine.querySelectorAll(`.map-node.atteignable`).forEach((b) => {
        b.addEventListener(`click`, () => {
          if (ecranTactile() && selId !== b.dataset.id) {
            selectionner(b);
          } else {
            aller(b.dataset.id);
          }
        });
      });
      panneau?.querySelector(`.cp-aller`)?.addEventListener(`click`, () => selId && aller(selId));
      panneau?.querySelector(`.cp-fermer`)?.addEventListener(`click`, deselectionner);
      // Molette verticale → défilement horizontal quand la carte ne déborde qu'en largeur.
      const sc = racine.querySelector(`.map-scroll`);
      sc?.addEventListener(
        `wheel`,
        (ev) => {
          if (
            ev.deltaY === 0 ||
            ev.ctrlKey ||
            Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ||
            sc.scrollWidth <= sc.clientWidth ||
            sc.scrollHeight > sc.clientHeight
          ) {
            return;
          }
          sc.scrollLeft +=
            ev.deltaY * (ev.deltaMode === 1 ? 32 : ev.deltaMode === 2 ? sc.clientWidth : 1);
          ev.preventDefault();
        },
        { passive: false },
      );
      // Souris : glisser le fond de la carte pour la faire défiler.
      const zone = racine.querySelector(`.map-zone`);
      let glisse = null;
      zone?.addEventListener(`pointerdown`, (ev) => {
        if (
          ev.pointerType !== `mouse` ||
          ev.button !== 0 ||
          ev.target.closest(`.map-node`) ||
          !sc
        ) {
          return;
        }
        glisse = {
          x: ev.clientX,
          y: ev.clientY,
          left: sc.scrollLeft,
          top: sc.scrollTop,
          id: ev.pointerId,
        };
        zone.setPointerCapture?.(ev.pointerId);
        zone.classList.add(`glisse`);
        ev.preventDefault();
      });
      zone?.addEventListener(`pointermove`, (ev) => {
        if (glisse && ev.pointerId === glisse.id) {
          sc.scrollLeft = glisse.left - (ev.clientX - glisse.x);
          sc.scrollTop = glisse.top - (ev.clientY - glisse.y);
        }
      });
      const finGlisse = () => {
        glisse = null;
        zone?.classList.remove(`glisse`);
      };
      zone?.addEventListener(`pointerup`, finGlisse);
      zone?.addEventListener(`pointercancel`, finGlisse);
      // Clavier : 1, 2, 3… pour les cases, E/S/F/B pour les outils. Ni Entrée ni Espace.
      toucheCarte = (ev) => {
        if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) {
          return;
        }
        const actif = document.activeElement;
        if (
          actif?.matches?.(
            `input, textarea, select, [contenteditable=""], [contenteditable="true"]`,
          ) ||
          document.querySelector(`.confirm-fond`) ||
          !racine.querySelector(`.carte-ecran`)
        ) {
          return;
        }
        // Chiffres lus dans ev.code : sur AZERTY, la rangée du haut donne « & », « é »…
        const chiffre = /^(?:Digit|Numpad)([1-9])$/.exec(ev.code ?? ``)?.[1];
        const touche = (ev.key ?? ``).toLowerCase();
        if (chiffre) {
          const id = [...numeros].find(([, k]) => k === Number(chiffre))?.[0];
          if (id) {
            ev.preventDefault();
            aller(id);
          }
        } else if (LETTRES_OUTILS[touche]) {
          ev.preventDefault();
          document.getElementById(LETTRES_OUTILS[touche])?.click();
        }
      };
      document.addEventListener(`keydown`, toucheCarte);
      sousEcran(`carte-persos`, () => ecranCaracteristiques(t, undefined, undefined, true, n));
      sousEcran(`carte-formation`, async () => {
        await ecranFormation(t);
        onModif();
      });
      sousEcran(`carte-equip`, async () => {
        await ecranEquipement(t, i);
        onModif();
      });
      sousEcran(`carte-bestiaire`, () => ecranBestiaire(n));
      sousEcran(`carte-armurerie`, () => ecranArmurerie(n));
      sousEcran(`carte-dofus`, () => ecranDofus(n));
      document.getElementById(`carte-accueil`)?.addEventListener(`click`, () => resolve(`accueil`));
      document.getElementById(`carte-restart`)?.addEventListener(`click`, async () => {
        if (
          await demanderConfirmation(
            `Abandonner la run en cours et recommencer avec les mêmes héros ?`,
            `Recommencer`,
          )
        ) {
          resolve(`recommencer-memes`);
        }
      });
      document.getElementById(`carte-restart-choix`)?.addEventListener(`click`, async () => {
        if (
          await demanderConfirmation(
            `Abandonner la run en cours et choisir d'autres héros ?`,
            `Recommencer`,
          )
        ) {
          resolve(`recommencer-choix`);
        }
      });
    };
    l();
  });
}
