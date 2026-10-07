import { CLASSES, COMBATS, MONSTRES } from "../../data/index.js";
import { AFFIXES_GROUPE, DIFFICULTES } from "../../jeu/config.js";
import { cheminVisite, noeudsAtteignables, trouverNoeud } from "../../carte/generation.js";
import { pvMaxPerso } from "../../jeu/run.js";
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
const imageNoeud = (e) =>
  (e.type === `donjon` ? imageBossDonjon(e) : null) ??
  cheminAsset(`/assets/cases/${IMAGES_NOEUDS[e.type]}.png`);
const CARTE_HAUTEUR = 440;
const CARTE_PAS_X = 116;
const CARTE_MARGE = 56;
// onModif : appelé après un changement fait depuis la carte (équipement, formation) pour sauvegarder la run
export function ecranCarte(e, t, n, r, i = [], a = 0, o = 0, s = 0, onModif = () => {}) {
  return new Promise((resolve) => {
    let l = () => {
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
          ]
            .filter(Boolean)
            .join(` `);
          let a = (t.eliteModifs ?? []).find((e) => AFFIXES_GROUPE.some((t) => t.id === e));
          let o = t.type === `combat_dur` && a ? AFFIXES_GROUPE.find((e) => e.id === a) : undefined;
          let s = o
            ? ` data-tip="${echapperHtml(`Combat dur : ${o.nom}
Ennemis : ${o.desc}`)}"`
            : ``;
          return `<button class="${i}" data-id="${t.id}" ${r ? `` : `disabled`}${t.id === e.courant ? ` aria-current="location"` : ``} style="left:${n.x}px;top:${n.y}px"${s}>
            <span class="case-art">
              <img class="case-img" src="${imageNoeud(t)}" alt="" onerror="this.onerror=null;this.nextElementSibling.style.display='';this.remove()" />
              <span class="mn-icon" style="display:none">${ICONES_NOEUDS[t.type]}</span>
            </span>
            <span class="mn-lbl">${NOMS_NOEUDS[t.type]}${o ? `<small class="mn-modif">${echapperHtml(o.nom)}</small>` : ``}</span>
          </button>`;
        })
        .join(``);
      let x = t
        .map((e) => {
          let t = CLASSES[e.classeId];
          let n = pvMaxPerso(e);
          let r = Math.max(0, Math.round((e.pvActuels / n) * 100));
          let i = Math.max(0, Math.round(e.pvActuels));
          return `
            <div class="aside-perso ${e.flashNiveau ? `flash-niv` : ``}">
              ${e.flashNiveau ? `<span class="niv-flash">⬆ Niveau ${e.progression.niveau} !</span>` : ``}
              <img class="aside-sym" src="${imgSymboleClasse(e.classeId)}" alt="" onerror="this.remove()" />
              <span class="pv-gem pv-gem-aside ${i <= 0 ? `ko` : ``}" title="${i} / ${n} PV" style="--pv-pct:${r}%">
                <img class="pv-vide" src="${IMG_COEUR}" alt="" onerror="this.remove()" />
                <img class="pv-plein" src="${IMG_COEUR}" alt="" onerror="this.remove()" />
                <b class="pv-num">${i}<span>/${n}</span></b>
              </span>
              <div class="aside-info">
                <div class="aside-nom">${echapperHtml(t.nom)}${pastillesElementsPerso(e)}</div>
                <div class="aside-niv">Niv.${e.progression.niveau}</div>
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
            <h2 class="zone-titre">${echapperHtml(r)}${o >= 1 ? `<span class="asc-badge" title="${echapperHtml(DIFFICULTES[o].desc)}">${etoilesDifficulte(o)}</span>` : ``}${s >= 1 ? `<span class="asc-badge" title="Philtres d'Otomai bus : les archimonstres apparaissent plus souvent">🧪 ×${s}</span>` : ``}</h2>
            <div class="topbar-actions">
              <button id="carte-persos" class="aside-icone" title="Caractéristiques"><img src="${IMG_CARACTERISTIQUES}" alt="Caractéristiques" onerror="this.remove()" /><span class="aside-lbl">Stats</span></button>
              <button id="carte-formation" class="aside-icone" title="Formation"><img src="${IMG_FORMATION}" alt="Formation" onerror="this.remove()" /><span class="aside-lbl">Formation</span></button>
              <button id="carte-equip" class="aside-icone" title="Équipement${i.length ? ` · ${i.length} objet(s)` : ``}"><img src="${IMG_INVENTAIRE}" alt="Équipement" onerror="this.remove()" />${i.length ? `<span class="aside-compte">${i.length}</span>` : ``}<span class="aside-lbl">Équipement</span></button>
              <button id="carte-bestiaire" class="aside-icone" title="Bestiaire"><img src="${IMG_BESTIAIRE}" alt="Bestiaire" onerror="this.remove()" /><span class="aside-lbl">Bestiaire</span></button>
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
            <div class="equipe-bar">${x}</div>
            <div class="aside-kamas" title="Kamas de la run (perdus à la mort)">${htmlKamas(a)}</div>
          </footer>
        </div>`;
      racine.querySelectorAll(`.map-node.atteignable`).forEach((t) => {
        t.addEventListener(`click`, () => {
          let n = trouverNoeud(e, t.dataset.id);
          if (n) {
            resolve(n);
          }
        });
      });
      document.getElementById(`carte-persos`)?.addEventListener(`click`, async () => {
        await ecranCaracteristiques(t, undefined, undefined, true, n);
        l();
      });
      document.getElementById(`carte-formation`)?.addEventListener(`click`, async () => {
        await ecranFormation(t);
        onModif();
        l();
      });
      document.getElementById(`carte-equip`)?.addEventListener(`click`, async () => {
        await ecranEquipement(t, i);
        onModif();
        l();
      });
      document.getElementById(`carte-bestiaire`)?.addEventListener(`click`, async () => {
        await ecranBestiaire(n);
        l();
      });
      document.getElementById(`carte-armurerie`)?.addEventListener(`click`, async () => {
        await ecranArmurerie(n);
        l();
      });
      document.getElementById(`carte-dofus`)?.addEventListener(`click`, async () => {
        await ecranDofus(n);
        l();
      });
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
