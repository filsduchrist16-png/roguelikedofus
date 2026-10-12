import { MONDES, MONSTRES, RELIQUES } from "../../data/index.js";
import {
  MONSTRES_RARES,
  bossDeZone,
  monstresDeZone,
  bonusRelique,
  reliquesDuMonde,
  zonesDuMonde,
  zoneSecrete,
} from "../../jeu/config.js";
import { numeroZone } from "../../jeu/economie.js";
import { CONFIG_ARCHI } from "../../jeu/config.js";
import { bonusJaugeArchi } from "../../jeu/run.js";
import {
  comportementDefilement,
  afficherEcran,
  barreRetour,
  cheminAsset,
  echapperHtml,
  racine,
} from "../commun.js";
import { equiperRelique } from "../../sauvegarde/meta.js";
import { pastilleReliques, rendreEnGardantScroll } from "../collection.js";
const ECRAN_ETROIT = `(max-width: 760px)`;
export function ecranBestiaire(metaEntree) {
  const meta = metaEntree;
  return new Promise((resolve) => {
    let reliquesObtenues = metaEntree.reliques ?? [];
    let mondesJouables = MONDES.filter((monde) => monde.zones.length > 0);
    let mondesAVenir = MONDES.filter((monde) => monde.zones.length === 0);
    let archisDeZone = (zone) =>
      monstresDeZone(zone).filter((especeId) => MONSTRES[especeId]?.archiNom);
    let compterCaptures = (especes) =>
      especes.filter((especeId) => metaEntree.archis.includes(especeId)).length;
    let progressionArchis = (monde) => {
      let archis = new Set(zonesDuMonde(monde).flatMap(archisDeZone));
      for (let especeId of MONSTRES_RARES[monde.id]?.especes ?? []) {
        if (MONSTRES[especeId]?.archiNom) {
          archis.add(especeId);
        }
      }
      return {
        fait: compterCaptures([...archis]),
        sur: archis.size,
      };
    };
    let mondeChoisiId = mondesJouables[0]?.id ?? ``;
    let indexZone = 0;
    let htmlEspece = (especeId) => {
      let monstre = MONSTRES[especeId];
      let capture = !!monstre.archiNom && metaEntree.archis.includes(especeId);
      return `<div class="best-espece ${monstre.archiNom ? (capture ? `capt` : `manquant`) : `simple`}" title="${echapperHtml(monstre.archiNom ? `${monstre.archiNom}, archimonstre de ${monstre.nom}` : `${monstre.nom} (pas d'archimonstre)`)}">
          <span class="best-espece-img">
            ${monstre.img ? `<img src="${cheminAsset(monstre.img)}" alt="" loading="lazy" onerror="this.remove()" />` : ``}
            ${capture ? `<img class="archi-mark" src="${cheminAsset(`/assets/divers/Archmonster.webp`)}" alt="capturé" onerror="this.remove()" />` : ``}
          </span>
          <b>${echapperHtml(monstre.archiNom ?? monstre.nom)}</b>
          <small>${monstre.archiNom ? echapperHtml(monstre.nom) : `Pas d'archimonstre`}</small>
        </div>`;
    };
    let htmlBoss = (bossId) => {
      let monstre = MONSTRES[bossId];
      let relique = RELIQUES[bossId];
      let possede = reliquesObtenues.includes(bossId);
      return `<div class="best-boss">
          <div class="best-boss-carte">
            ${monstre.img ? `<img src="${cheminAsset(monstre.img)}" alt="" onerror="this.remove()" />` : ``}
            <span><em class="best-tag">Boss</em><b>${echapperHtml(monstre.nom)}</b></span>
          </div>
          ${
            relique
              ? `<div class="best-relique ${possede ? `eue` : `manquante`}">
            <span class="best-relique-halo"><img src="${cheminAsset(`/assets/reliques/${bossId}.png`)}" alt="" onerror="this.remove()" /></span>
            <span><em class="best-tag">${possede ? `Relique obtenue` : `Relique`}</em>
              <b>${possede ? echapperHtml(relique.nom) : `???`}</b>
              <small>Lâchée rarement par ${echapperHtml(monstre.nom)}</small>
              ${
                possede
                  ? `<small class="best-relique-bonus">${echapperHtml(bonusRelique(bossId)?.desc ?? ``)} (relique équipée)</small>
              <button type="button" class="secondaire" data-relique="${bossId}" aria-pressed="${bossId === meta.reliqueEquipee}">${bossId === meta.reliqueEquipee ? `Retirer` : `Équiper`}</button>`
                  : `<small class="muet">Obtenue, elle donnera ${echapperHtml(bonusRelique(bossId)?.desc ?? ``)} une fois équipée.</small>`
              }</span>
          </div>`
              : ``
          }
        </div>`;
    };
    let texteArchis = (especes) => {
      if (especes.length) {
        return `Archimonstres ${compterCaptures(especes)}/${especes.length}`;
      }
      return `Aucun archimonstre`;
    };
    let afficher = () => {
      let mondeCourant =
        mondesJouables.find((monde) => monde.id === mondeChoisiId) ?? mondesJouables[0];
      let zones = mondeCourant
        ? [...zonesDuMonde(mondeCourant), zoneSecrete(mondeCourant.id)].filter(Boolean)
        : [];
      let fortuits = (MONSTRES_RARES[mondeCourant?.id ?? ``]?.especes ?? []).filter(
        (especeId) => MONSTRES[especeId],
      );
      let htmlOnglets = mondesJouables
        .map((monde) => {
          let progression = progressionArchis(monde);
          let reliques = reliquesDuMonde(monde.id);
          return `<button class="best-onglet${monde.id === mondeCourant?.id ? ` actif` : ``}" aria-pressed="${monde.id === mondeCourant?.id}" data-monde="${monde.id}">
            <b>${echapperHtml(monde.nom)}</b>
            <small>${progression.sur ? `Archimonstres ${progression.fait}/${progression.sur}` : `Pas d'archimonstre`} · Reliques ${reliques.filter((reliqueId) => reliquesObtenues.includes(reliqueId)).length}/${reliques.length}</small>
          </button>`;
        })
        .join(``);
      let htmlZones =
        zones
          .map((zone, indice) => {
            let bossIds = bossDeZone(zone);
            let pastille = pastilleReliques(bossIds, reliquesObtenues);
            let imgBoss = MONSTRES[bossIds[0]]?.img;
            return `<button class="best-zone${indice === indexZone ? ` actif` : ``}" data-zone="${indice}">
            ${imgBoss ? `<img src="${cheminAsset(imgBoss)}" alt="" onerror="this.remove()" />` : `<span></span>`}
            <span class="best-zone-txt"><b>${echapperHtml(zone.nom)}</b><small>${texteArchis(archisDeZone(zone))}</small></span>
            ${pastille ? `<span class="best-pastille${pastille.complete ? ` complete` : ``}" title="Reliques de la zone">${pastille.texte}</span>` : ``}
          </button>`;
          })
          .join(``) +
        (fortuits.length
          ? `<button class="best-zone${indexZone === zones.length ? ` actif` : ``}" data-zone="${zones.length}">
            ${MONSTRES[fortuits[0]]?.img ? `<img src="${cheminAsset(MONSTRES[fortuits[0]].img)}" alt="" onerror="this.remove()" />` : `<span></span>`}
            <span class="best-zone-txt"><b>Rencontres fortuites</b><small>${texteArchis(fortuits.filter((especeId) => MONSTRES[especeId]?.archiNom))}</small></span>
          </button>`
          : ``);
      let htmlDetail;
      if (indexZone < zones.length) {
        let zone = zones[indexZone];
        let bossIds = bossDeZone(zone);
        let habitants = monstresDeZone(zone).filter((especeId) => !bossIds.includes(especeId));
        htmlDetail = `<div class="best-titre"><h2>${echapperHtml(zone.nom)}</h2>
            <small>${zone.secret ? `Donjon secret (il s'ouvre avec une clé, après le boss d'une zone)` : `Zone ${numeroZone(zone.id)}`} · ${texteArchis(archisDeZone(zone))}</small></div>
          <div class="best-boss-liste">${bossIds.map(htmlBoss).join(``)}</div>
          <h3 class="best-rubrique">Habitants</h3>
          <div class="best-especes">${habitants.map(htmlEspece).join(``)}</div>`;
      } else {
        htmlDetail = `<div class="best-titre"><h2>Rencontres fortuites</h2></div>
          <p class="muet">Ces vagabonds n'habitent aucun donjon : ils surgissent rarement au milieu d'un combat ordinaire, et toujours sous leur forme d'Archimonstre.</p>
          <div class="best-especes">${fortuits.map(htmlEspece).join(``)}</div>`;
      }
      afficherEcran(`
        <h1>Bestiaire</h1>
        <p class="best-jauge" data-tip="Chaque combat sans archimonstre inédit remplit la jauge ; elle se vide quand un archi jamais capturé apparaît.">🎯 Jauge de traque : <b>+${Math.round(bonusJaugeArchi(mondeCourant.jaugeArchi) * 100)} %</b> de chance d'archi inédit${mondeCourant.jaugeArchi ? ` (${mondeCourant.jaugeArchi} combat${mondeCourant.jaugeArchi > 1 ? `s` : ``} sans nouvel archi)` : ``} · les archis jamais capturés apparaissent ${CONFIG_ARCHI.multNouveau}× plus souvent</p>
        <div class="best-onglets" role="group" aria-label="Mondes">${htmlOnglets}</div>
        <div class="best-vue">
          <nav class="best-zones" aria-label="Zones du monde">${htmlZones}</nav>
          <section class="best-detail"><button type="button" class="best-vers-zones secondaire">↑ Zones</button>${htmlDetail}</section>
        </div>
        ${mondesAVenir.length ? `<p class="muet monde-verrouille">${mondesAVenir.map((monde) => echapperHtml(monde.nom)).join(`, `)} : à venir</p>` : ``}
        ${barreRetour(`best-retour`)}
      `);
      racine.querySelectorAll(`[data-monde]`).forEach((bouton) =>
        bouton.addEventListener(`click`, () => {
          mondeChoisiId = bouton.dataset.monde;
          indexZone = 0;
          rendreEnGardantScroll(afficher, false);
        }),
      );
      racine.querySelectorAll(`[data-zone]`).forEach((bouton) =>
        bouton.addEventListener(`click`, () => {
          indexZone = Number(bouton.dataset.zone);
          rendreEnGardantScroll(afficher, true);
          // téléphone : le détail est sous la liste des zones, on l'amène à l'écran
          if (window.matchMedia(ECRAN_ETROIT).matches) {
            racine
              .querySelector(`.best-detail`)
              ?.scrollIntoView({ block: `start`, behavior: comportementDefilement() });
          }
        }),
      );
      racine.querySelectorAll(`[data-relique]`).forEach((bouton) =>
        bouton.addEventListener(`click`, () => {
          equiperRelique(
            meta,
            meta.reliqueEquipee === bouton.dataset.relique ? null : bouton.dataset.relique,
          );
          rendreEnGardantScroll(afficher, true);
        }),
      );
      racine.querySelector(`.best-vers-zones`)?.addEventListener(`click`, () => {
        const zone =
          racine.querySelector(`.best-zone.actif`) ?? racine.querySelector(`.best-zones`);
        zone?.scrollIntoView({ block: `center`, behavior: comportementDefilement() });
        zone?.focus({ preventScroll: true });
      });
      racine.querySelector(`#best-retour`)?.addEventListener(`click`, () => resolve());
    };
    afficher();
  });
}
