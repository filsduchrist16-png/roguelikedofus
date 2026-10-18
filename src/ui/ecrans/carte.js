import { CLASSES, COMBATS, MONDES, MONSTRES, ZONES } from "../../data/index.js";
import { afficherAstuce } from "./succes.js";
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
  camp: `⛺`,
  coffre: `🧰`,
};
const NOMS_NOEUDS = {
  combat: `Combat`,
  combat_dur: `Combat dur`,
  taverne: `Taverne`,
  otomai: `Otomaï`,
  zaap: `Zaap`,
  donjon: `Donjon`,
  hdv: `Hôtel de vente`,
  forgemagie: `Forgemagie`,
  rencontre: `Rencontre`,
  camp: `Camp`,
  coffre: `Coffre`,
};
// Contenu des cases sans combat, affiché au survol (PC) ou dans le panneau de sélection (tactile).
const DESC_NOEUDS = {
  taverne: `Taverne : soigne ou recrute\nAu comptoir : une relique de run à vendre`,
  otomai: `Otomaï : philtre d'archimonstre`,
  zaap: `Zaap : case surprise`,
  hdv: `Hôtel de vente : vends ou achète des objets`,
  forgemagie: `Forgemagie : monter la rareté`,
  rencontre: `Rencontre : évènement au hasard\n(sanctuaire, marchand, colporteur de reliques, autel de sang…)`,
  camp: `Camp de repos : au choix\n💤 se reposer (30 % des PV max)\n⬆ ou améliorer un sort gratuitement`,
  coffre: `Coffre : une relique de run ou un objet\n⚠ Parfois piégé : combat ou perte de PV (un Sram, Roublard ou Ecaflip le crochète)`,
};
// Récompense annoncée sous un combat : le chemin risqué (combat dur) rapporte nettement plus.
const RECOMPENSES_COMBAT = {
  combat: `🎁 Récompense : butin + 1 carte parmi 3 (relique de run 1 fois sur 5)`,
  combat_dur: `🎖️ Récompense : relique de run garantie, cartes plus rares, plus de butin, de kamas et d'XP`,
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
// Cases sans image dans /assets/cases : une image existante ailleurs, ou l'emoji seul (camp).
const AUTRES_IMAGES = { coffre: `/assets/monstres/coffre_forgerons.png` };
function imageBossDonjon(noeud) {
  let ennemis = noeud.combatId ? COMBATS[noeud.combatId]?.ennemis : undefined;
  let boss = ennemis?.find((ennemi) => MONSTRES[ennemi.monstre]?.boss) ?? ennemis?.[0];
  let img = boss ? MONSTRES[boss.monstre]?.img : undefined;
  if (img) {
    return cheminAsset(img);
  }
  return null;
}
// Affixes connus d'un combat dur (« Cuirassés »…), dans l'ordre de la carte, sans doublon.
function affixesNoeud(noeud) {
  if (noeud.type !== `combat_dur`) {
    return [];
  }
  const ids = [...new Set(noeud.eliteModifs ?? [])];
  return ids.map((id) => AFFIXES_GROUPE.find((affixe) => affixe.id === id)).filter(Boolean);
}
// « 2× Bouftou, Tofu » : les monstres d'un groupe, regroupés par espèce.
function listeMonstres(ennemis) {
  const comptes = new Map();
  for (const en of ennemis) {
    const nom = MONSTRES[en.monstre]?.nom ?? en.monstre;
    comptes.set(nom, (comptes.get(nom) ?? 0) + 1);
  }
  return [...comptes].map(([nom, nb]) => (nb > 1 ? `${nb}× ${nom}` : nom)).join(`, `);
}
// Texte (brut, plusieurs lignes) qui décrit ce qui attend le joueur sur une case.
// nbAffixes : affixes d'un combat dur selon la difficulté (2 dès Extrême) ; la carte n'en connaît
// souvent qu'un, les autres sont tirés au début du combat.
export function texteCase(noeud, nbAffixes = 1) {
  const nomType = NOMS_NOEUDS[noeud.type] ?? noeud.type;
  const combat = noeud.combatId ? COMBATS[noeud.combatId] : undefined;
  if (![`combat`, `combat_dur`, `donjon`].includes(noeud.type) || !combat) {
    return DESC_NOEUDS[noeud.type] ?? nomType;
  }
  const ennemis = combat.ennemis ?? [];
  // certains noms de combat commencent déjà par « Donjon : »
  // « Combat dur : Garde de la crypte (dur) » : le « (dur) » des données ferait doublon
  const nomCombat =
    noeud.type === `combat_dur` ? combat.nom.replace(/\s*\(dur\)$/, ``) : combat.nom;
  const lignes = [nomCombat.startsWith(nomType) ? nomCombat : `${nomType} : ${nomCombat}`];
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
  const affixes = affixesNoeud(noeud).slice(0, Math.max(1, nbAffixes));
  for (const affixe of affixes) {
    lignes.push(`${affixe.nom} : ${affixe.desc}`);
  }
  const inconnus = noeud.type === `combat_dur` ? Math.max(0, nbAffixes - affixes.length) : 0;
  if (inconnus) {
    lignes.push(
      `+ ${inconnus} ${affixes.length ? `autre ` : ``}affixe${inconnus > 1 ? `s` : ``} tiré${inconnus > 1 ? `s` : ``} au hasard au début du combat (difficulté)`,
    );
  }
  if (RECOMPENSES_COMBAT[noeud.type]) {
    lignes.push(RECOMPENSES_COMBAT[noeud.type]);
  }
  return lignes.join(`\n`);
}
// Raccourcis 1, 2, 3… : cases atteignables triées de haut en bas (puis de gauche à droite).
export function ordreRaccourcis(cases) {
  return [...cases]
    .sort((premiere, seconde) => premiere.y - seconde.y || premiere.x - seconde.x)
    .map((noeud) => noeud.id);
}
// Niveau maximum du monde qui contient la zone (retrouvée par son nom), ou null.
export function niveauMaxDeZone(nomZone, zones = ZONES, mondes = MONDES) {
  const zone = zones.find((candidate) => candidate.nom === nomZone);
  const monde = zone && mondes.find((candidat) => candidat.zones.includes(zone.id));
  return monde?.niveaux?.[1] ?? null;
}
const LETTRES_OUTILS = {
  e: `carte-equip`,
  s: `carte-persos`,
  f: `carte-formation`,
  b: `carte-bestiaire`,
};
const imageNoeud = (noeud) =>
  (noeud.type === `donjon` ? imageBossDonjon(noeud) : null) ??
  (AUTRES_IMAGES[noeud.type] ? cheminAsset(AUTRES_IMAGES[noeud.type]) : null) ??
  (IMAGES_NOEUDS[noeud.type]
    ? cheminAsset(`/assets/cases/${IMAGES_NOEUDS[noeud.type]}.png`)
    : null);
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
  const rects = cases.map((element) => element.getBoundingClientRect());
  const milieuX =
    (Math.min(...rects.map((rect) => rect.left)) + Math.max(...rects.map((rect) => rect.right))) /
    2;
  const milieuY =
    (Math.min(...rects.map((rect) => rect.top)) + Math.max(...rects.map((rect) => rect.bottom))) /
    2;
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
  carte,
  persos,
  meta,
  nomZone,
  inventaire = [],
  kamas = 0,
  ascension = 0,
  philtres = 0,
  onModif = () => {},
  effets = [],
  infosZone = {},
) {
  return new Promise((resolveBrut) => {
    afficherAstuce(
      `carte`,
      `Touche un nœud accessible pour avancer. Pense à équiper tes héros avant les combats.`,
    );
    const mortDefinitive = !!effetsDifficulte(ascension).mortDefinitive;
    const nbAffixesElite = effetsDifficulte(ascension).affixesElite ?? 1;
    const niveauMax = infosZone.niveauMax ?? niveauMaxDeZone(nomZone);
    // Clavier : retiré à chaque re-rendu, à l'ouverture d'un sous-écran et à la sortie.
    let toucheCarte = null;
    const nettoyer = () => {
      if (toucheCarte) {
        document.removeEventListener(`keydown`, toucheCarte);
        toucheCarte = null;
      }
    };
    const resolve = (valeur) => {
      nettoyer();
      resolveBrut(valeur);
    };
    // Sous-écran ouvert depuis la carte : plus de raccourcis tant qu'il est affiché.
    const sousEcran = (id, action) =>
      document.getElementById(id)?.addEventListener(`click`, async () => {
        nettoyer();
        await action();
        afficher();
      });
    let afficher = () => {
      nettoyer();
      const tactile = ecranTactile();
      let ligneMax = Math.max(...carte.noeuds.map((noeud) => noeud.ligne));
      let largeur = CARTE_MARGE * 2 + (ligneMax + 1) * CARTE_PAS_X;
      let origine = {
        x: CARTE_MARGE,
        y: CARTE_HAUTEUR / 2,
      };
      let positions = new Map();
      let parLigne = new Map();
      for (let noeud of carte.noeuds) {
        parLigne.set(noeud.ligne, (parLigne.get(noeud.ligne) ?? 0) + 1);
      }
      let pasY = CARTE_HAUTEUR / (Math.max(1, ...parLigne.values()) + 1);
      for (let noeud of carte.noeuds) {
        positions.set(noeud.id, {
          x: CARTE_MARGE + (noeud.ligne + 1) * CARTE_PAS_X,
          y: CARTE_HAUTEUR / 2 + noeud.colonne * pasY,
        });
      }
      let atteignables = new Set(noeudsAtteignables(carte).map((noeud) => noeud.id));
      const numeros = new Map(
        ordreRaccourcis([...atteignables].map((id) => ({ id, ...positions.get(id) }))).map(
          (id, indice) => [id, indice + 1],
        ),
      );
      const appelSoin = !mortDefinitive && persos.some((perso) => perso.pvActuels <= 0);
      let estCourant = (id) =>
        carte.courant === id || (carte.courant === null && trouverNoeud(carte, id)?.ligne === 0);
      let htmlArete = (depart, arrivee, actif, emprunte = false) => {
        let dx = arrivee.x - depart.x;
        let dy = arrivee.y - depart.y;
        let distance = Math.hypot(dx, dy);
        if (distance <= 84) {
          return ``;
        }
        let coef = 42 / distance;
        return `<line x1="${depart.x + dx * coef}" y1="${depart.y + dy * coef}" x2="${arrivee.x - dx * coef}" y2="${arrivee.y - dy * coef}" class="arete ${actif ? `arete-actif` : ``} ${emprunte ? `arete-emprunte` : ``}"/>`;
      };
      let htmlAretes = carte.noeuds
        .flatMap((noeud) =>
          noeud.suivants.map((suivantId) =>
            htmlArete(
              positions.get(noeud.id),
              positions.get(suivantId),
              atteignables.has(suivantId) && estCourant(noeud.id),
              cheminVisite(carte, noeud.id, suivantId),
            ),
          ),
        )
        .join(``);
      let htmlAretesDepart = carte.depart
        .map((departId) =>
          htmlArete(
            origine,
            positions.get(departId),
            carte.courant === null,
            cheminVisite(carte, null, departId),
          ),
        )
        .join(``);
      let htmlNoeuds = carte.noeuds
        .map((noeud) => {
          let pos = positions.get(noeud.id);
          let atteignable = atteignables.has(noeud.id);
          let classes = [
            `map-node`,
            `t-${noeud.type}`,
            noeud.visite ? `visite` : ``,
            noeud.id === carte.courant ? `courant` : ``,
            atteignable ? `atteignable` : ``,
            atteignable && appelSoin && noeud.type === `taverne` ? `appel-soin` : ``,
          ]
            .filter(Boolean)
            .join(` `);
          let affixe = affixesNoeud(noeud)[0];
          let affixesEnPlus = noeud.type === `combat_dur` ? Math.max(0, nbAffixesElite - 1) : 0;
          let tip = ` data-tip="${echapperHtml(texteCase(noeud, nbAffixesElite))}"`;
          let num = atteignable && !tactile && numeros.get(noeud.id);
          return `<button class="${classes}" data-id="${noeud.id}" ${atteignable ? `` : `aria-disabled="true"`}${noeud.id === carte.courant ? ` aria-current="location"` : ``} style="left:${pos.x}px;top:${pos.y}px"${tip}>
            <span class="case-art">
              ${imageNoeud(noeud) ? `<img class="case-img" src="${imageNoeud(noeud)}" alt="" onerror="this.onerror=null;this.nextElementSibling.style.display='';this.remove()" />` : ``}
              <span class="mn-icon"${imageNoeud(noeud) ? ` style="display:none"` : ``}>${ICONES_NOEUDS[noeud.type] ?? `❔`}</span>
            </span>
            <span class="mn-lbl">${NOMS_NOEUDS[noeud.type]}${affixe ? `<small class="mn-modif"> · ${echapperHtml(affixe.nom)}${affixesEnPlus ? ` +${affixesEnPlus}` : ``}</small>` : ``}</span>
            ${num && num <= 9 ? `<kbd class="mn-kbd" aria-hidden="true">${num}</kbd>` : ``}
          </button>`;
        })
        .join(``);
      let htmlPersos = persos
        .map((perso) => {
          let classe = CLASSES[perso.classeId];
          let pvMax = pvMaxPerso(perso);
          let pctPv = Math.max(0, Math.round((perso.pvActuels / pvMax) * 100));
          let pv = Math.max(0, Math.round(perso.pvActuels));
          let ko = perso.pvActuels <= 0;
          let niv = perso.progression.niveau;
          let besoin = xpPourNiveau(niv);
          let xp = Math.max(0, Math.round(perso.progression.xp ?? 0));
          // Au plafond du monde, l'XP ne s'accumule plus (gagnerXp la remet à 0).
          let auPlafond = niveauMax != null && niv >= niveauMax;
          let pctXp = auPlafond ? 100 : Math.max(0, Math.min(100, Math.round((xp / besoin) * 100)));
          let tipXp = auPlafond
            ? `Niveau max du monde atteint`
            : `XP : ${xp} / ${besoin} vers le niveau ${niv + 1}`;
          return `
            <div class="aside-perso ${perso.flashNiveau ? `flash-niv` : ``} ${ko ? `ko` : ``}">
              ${perso.flashNiveau ? `<span class="niv-flash">⬆ Niveau ${perso.progression.niveau} !</span>` : ``}
              ${ko ? `<span class="ko-badge">K.O.</span>` : ``}
              <img class="aside-sym" src="${imgSymboleClasse(perso.classeId)}" alt="" onerror="this.remove()" />
              <span class="pv-gem pv-gem-aside ${pv <= 0 ? `ko` : ``}" title="${pv} / ${pvMax} PV" style="--pv-pct:${pctPv}%">
                <img class="pv-vide" src="${IMG_COEUR}" alt="" onerror="this.remove()" />
                <img class="pv-plein" src="${IMG_COEUR}" alt="" onerror="this.remove()" />
                <b class="pv-num">${pv}<span>/${pvMax}</span></b>
              </span>
              <div class="aside-info">
                <div class="aside-nom">${echapperHtml(classe.nom)}${pastillesElementsPerso(perso)}</div>
                <div class="aside-niv${auPlafond ? ` au-plafond` : ``}" data-tip="${echapperHtml(tipXp)}">Niv.${niv}<span class="aside-xp" role="progressbar" aria-label="Expérience" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pctXp}"><span style="width:${pctXp}%"></span></span></div>
                ${ko ? `<div class="ko-sous">${mortDefinitive ? `tombé pour de bon` : `se relève en taverne`}</div>` : ``}
              </div>
            </div>`;
        })
        .join(``);
      persos.forEach((perso) => {
        perso.flashNiveau = false;
      });
      masquerElements();
      racine.innerHTML = `
        <div class="carte-ecran map-layout">
          <h1 class="sr-only">Carte : ${echapperHtml(nomZone)}</h1>
          <header class="map-topbar">
            <h2 class="zone-titre">${infosZone.zoneNum ? `<span class="zone-num">Zone ${Number(infosZone.zoneNum)}${infosZone.nbZones ? `/${Number(infosZone.nbZones)}` : ``}</span> · ` : ``}${echapperHtml(nomZone)}${infosZone.tierObjets != null ? `<span class="asc-badge zone-tier" data-tip="Tier : numéro de la zone où tombent les objets, compté depuis le Monde 1">objets T${Number(infosZone.tierObjets)}</span>` : ``}${ascension >= 1 ? `<span class="asc-badge" data-tip="${echapperHtml(DIFFICULTES[ascension].desc)}">${etoilesDifficulte(ascension)}</span>` : ``}${philtres >= 1 ? `<span class="asc-badge" data-tip="Philtres d'Otomai bus : les archimonstres apparaissent plus souvent (${CONFIG_ARCHI.philtresMax} au maximum)">🧪 ${Math.min(philtres, CONFIG_ARCHI.philtresMax)}/${CONFIG_ARCHI.philtresMax}</span>` : ``}</h2>
            ${effets.length ? `<div class="zone-effets">${effets.map((effet) => `<span class="zone-effet" data-tip="${echapperHtml(effet.desc)}">${effet.icone} ${echapperHtml(effet.nom)}</span>`).join(``)}</div>` : ``}
            <div class="topbar-actions">
              <button id="carte-persos" class="aside-icone" title="Caractéristiques (S)"><img src="${IMG_CARACTERISTIQUES}" alt="Caractéristiques" onerror="this.remove()" /><span class="aside-lbl">Stats</span></button>
              <button id="carte-formation" class="aside-icone" title="Formation (F)"><img src="${IMG_FORMATION}" alt="Formation" onerror="this.remove()" /><span class="aside-lbl">Formation</span></button>
              <button id="carte-equip" class="aside-icone" title="Équipement (E)${inventaire.length ? ` · ${inventaire.length} objet(s)` : ``}"><img src="${IMG_INVENTAIRE}" alt="Équipement" onerror="this.remove()" />${inventaire.length ? `<span class="aside-compte">${inventaire.length}</span>` : ``}<span class="aside-lbl">Équipement</span></button>
              <button id="carte-bestiaire" class="aside-icone" title="Bestiaire (B)"><img src="${IMG_BESTIAIRE}" alt="Bestiaire" onerror="this.remove()" /><span class="aside-lbl">Bestiaire</span></button>
              <button id="carte-armurerie" class="aside-icone" title="Armurerie"><img src="${IMG_ARMURERIE}" alt="Armurerie" onerror="this.parentElement.textContent='🛡️'" /><span class="aside-lbl">Armurerie</span></button>
              <button id="carte-dofus" class="aside-icone" title="Dofus"><img src="${IMG_DOFUS}" alt="Dofus" onerror="this.remove()" /><span class="aside-lbl">Dofus</span></button>
              <span class="topbar-sep"></span>
              <button id="carte-accueil" class="aside-icone" title="Retour à l'accueil (la run reste sauvegardée)"><img src="${IMG_MENU}" alt="Accueil" onerror="this.remove()" /><span class="aside-lbl">Accueil</span></button>
              <button id="carte-restart" class="aside-icone" title="Recommencer avec les mêmes héros (abandonne la run en cours)"><img src="${IMG_RECOMMENCER}" alt="Recommencer" onerror="this.remove()" /><span class="aside-lbl">Recommencer</span></button>
              <button id="carte-restart-choix" class="aside-icone" title="Recommencer en choisissant d'autres héros (abandonne la run en cours)"><img src="${IMG_RECOMMENCER_AVEC_PERSO}" alt="Recommencer (autres héros)" onerror="this.remove()" /><span class="aside-lbl">Autre équipe</span></button>
            </div>
          </header>
          <div class="map-scroll"><div class="map-zone" style="width:${largeur}px;height:${CARTE_HAUTEUR}px">
            <svg class="map-svg" width="${largeur}" height="${CARTE_HAUTEUR}">${htmlAretesDepart}${htmlAretes}</svg>
            ${htmlNoeuds}
            <div class="map-depart" style="left:${origine.x}px;top:${origine.y}px">
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
            <div class="equipe-bar">${htmlPersos}</div>
            <div class="aside-kamas" data-tip="Kamas de la run (perdus à la mort)">${htmlKamas(kamas)}</div>
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
        let noeud = trouverNoeud(carte, id);
        if (noeud) {
          resolve(noeud);
        }
      };
      // Tactile : un premier appui sélectionne la case et décrit son contenu, le second valide.
      const panneau = racine.querySelector(`.case-panneau`);
      let selId = null;
      const deselectionner = () => {
        selId = null;
        racine
          .querySelectorAll(`.map-node.sel`)
          .forEach((bouton) => bouton.classList.remove(`sel`));
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
          // case lointaine : on lit son contenu, mais on ne peut pas y aller
          const boutonAller = panneau.querySelector(`.cp-aller`);
          if (boutonAller) {
            boutonAller.style.display = bouton.classList.contains(`atteignable`) ? `` : `none`;
          }
          panneau.hidden = false;
        }
      };
      racine.querySelectorAll(`.map-node`).forEach((bouton) => {
        const atteignable = bouton.classList.contains(`atteignable`);
        bouton.addEventListener(`click`, () => {
          if (ecranTactile() && selId !== bouton.dataset.id) {
            selectionner(bouton);
          } else if (atteignable) {
            aller(bouton.dataset.id);
          } else {
            // case lointaine appuyée une seconde fois : on referme le panneau
            deselectionner();
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
          const id = [...numeros].find(([, numero]) => numero === Number(chiffre))?.[0];
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
      sousEcran(`carte-persos`, () =>
        ecranCaracteristiques(persos, undefined, undefined, true, meta),
      );
      sousEcran(`carte-formation`, async () => {
        await ecranFormation(persos);
        onModif();
      });
      sousEcran(`carte-equip`, async () => {
        await ecranEquipement(
          persos,
          inventaire,
          effets.filter((effet) => effet.reliqueRun),
        );
        onModif();
      });
      sousEcran(`carte-bestiaire`, () => ecranBestiaire(meta));
      sousEcran(`carte-armurerie`, () => ecranArmurerie(meta));
      sousEcran(`carte-dofus`, () => ecranDofus(meta));
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
    afficher();
  });
}
