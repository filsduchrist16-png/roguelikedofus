import { EQUIPEMENTS, MONDES, MONSTRES, PANOPLIES } from "../../data/index.js";

const OU_PANOPLIE = { combats: `combats`, elites: `combats durs`, boss: `boss` };
import { RARETES_INFO, bossDeZone, zonesDuMonde, zoneSecrete } from "../../jeu/config.js";
import { numeroZone } from "../../jeu/economie.js";
import { descriptionPanoplie } from "../../jeu/panoplies.js";
import {
  comportementDefilement,
  NOMS_SLOTS,
  afficherEcran,
  attrTipObjet,
  barreRetour,
  cheminAsset,
  echapperHtml,
  imgObjet,
  racine,
} from "../commun.js";
import {
  butinParCategorie,
  pastilleCollection,
  progressionArmurerie,
  rendreEnGardantScroll,
} from "../collection.js";
const ECRAN_ETROIT = `(max-width: 760px)`;
export function ecranArmurerie(meta) {
  return new Promise((resolve) => {
    let collection = meta.collection ?? {};
    let idsDuButin = (butin) => [
      ...butin.panoplies.flatMap((panoplie) => panoplie.ids),
      ...butin.combats,
      ...butin.elites,
      ...butin.boss.map((objet) => objet.id),
    ];
    let mondesActifs = MONDES.filter((monde) => progressionArmurerie(monde, collection).sur > 0);
    let mondesVides = MONDES.filter((monde) => progressionArmurerie(monde, collection).sur === 0);
    let mondeChoisiId = mondesActifs[0]?.id ?? ``;
    let indexZone = 0;
    let htmlObjet = (id, annotation = ``) => {
      let def = EQUIPEMENTS[id];
      let rarete = collection[id];
      return `<div class="armu-objet${rarete ? ` eu rarete-${rarete}` : ``}"${attrTipObjet(id)}>
          <img src="${imgObjet(id)}" alt="" loading="lazy" onerror="this.remove()" />
          <b>${echapperHtml(def.nom)}</b>
          <small>${NOMS_SLOTS[def.slot]}${annotation ? ` · ${echapperHtml(annotation)}` : ``}</small>
          <span class="armu-rarete${rarete ? ` armu-r-${rarete}` : ``}">${rarete ? RARETES_INFO[rarete].nom : `Jamais obtenu`}</span>
        </div>`;
    };
    let htmlSection = (titre, sousTitre, cartes) => {
      if (cartes.length) {
        return `<div class="armu-section">
          <div class="armu-section-tete"><h3 class="best-rubrique">${echapperHtml(titre)}</h3><small>${echapperHtml(sousTitre)}</small></div>
          <div class="armu-objets">${cartes.join(``)}</div>
        </div>`;
      }
      return ``;
    };
    let afficher = () => {
      let mondeCourant =
        mondesActifs.find((monde) => monde.id === mondeChoisiId) ?? mondesActifs[0];
      let zones = mondeCourant
        ? [...zonesDuMonde(mondeCourant), zoneSecrete(mondeCourant.id)].filter(
            (zone) => zone && idsDuButin(butinParCategorie(zone.id)).length,
          )
        : [];
      let htmlOnglets = mondesActifs
        .map((monde) => {
          let progression = progressionArmurerie(monde, collection);
          return `<button class="best-onglet${monde.id === mondeCourant?.id ? ` actif` : ``}" aria-pressed="${monde.id === mondeCourant?.id}" data-monde="${monde.id}">
            <b>${echapperHtml(monde.nom)}</b>
            <small>Objets ${progression.fait}/${progression.sur} · Légendaires ${progression.legendaires}</small>
          </button>`;
        })
        .join(``);
      let htmlZones = zones
        .map((zone, indice) => {
          let butinZone = butinParCategorie(zone.id);
          let idsZone = idsDuButin(butinZone);
          let pastille = pastilleCollection(
            butinZone.panoplies.flatMap((panoplie) => panoplie.ids),
            collection,
          );
          let imgBoss = MONSTRES[bossDeZone(zone)[0]]?.img;
          return `<button class="best-zone${indice === indexZone ? ` actif` : ``}" data-zone="${indice}">
            ${imgBoss ? `<img src="${cheminAsset(imgBoss)}" alt="" onerror="this.remove()" />` : `<span></span>`}
            <span class="best-zone-txt"><b>${echapperHtml(zone.nom)}</b><small>Objets ${idsZone.filter((id) => collection[id]).length}/${idsZone.length}</small></span>
            ${pastille ? `<span class="best-pastille${pastille.complete ? ` complete` : ``}" title="Pièces des panoplies de la zone">${pastille.texte}</span>` : ``}
          </button>`;
        })
        .join(``);
      let htmlDetail = ``;
      let zoneCourante = zones[indexZone];
      if (zoneCourante) {
        let butinCourant = butinParCategorie(zoneCourante.id);
        let idsCourants = idsDuButin(butinCourant);
        let boss = bossDeZone(zoneCourante)
          .map((bossId) => MONSTRES[bossId]?.nom ?? bossId)
          .join(` et `);
        htmlDetail = `<div class="best-titre"><h2>${echapperHtml(zoneCourante.nom)}</h2>
            <small>${zoneCourante.secret ? `Donjon secret (il s'ouvre avec une clé)` : `Zone ${numeroZone(zoneCourante.id)}`} · Objets ${idsCourants.filter((id) => collection[id]).length}/${idsCourants.length}</small>
            <span class="armu-legende"><span class="armu-r-texte-commun">Commun</span><span class="armu-r-texte-rare">Rare</span><span class="armu-r-texte-epique">Épique</span><span class="armu-r-texte-legendaire">Légendaire</span></span></div>
          ${butinCourant.panoplies
            .map((panoplie) =>
              htmlSection(
                `${panoplie.nom} · ${OU_PANOPLIE[panoplie.ou]}${PANOPLIES[panoplie.nom]?.niveau ? ` · niv. ${PANOPLIES[panoplie.nom].niveau} dans Dofus` : ``}`,
                descriptionPanoplie(panoplie.nom) || `Panoplie`,
                panoplie.ids.map((id) => htmlObjet(id)),
              ),
            )
            .join(``)}
          ${htmlSection(
            `Butin des combats`,
            `Tombe dans les combats de la zone`,
            butinCourant.combats.map((id) => htmlObjet(id)),
          )}
          ${htmlSection(
            `Butin des combats durs`,
            `Exclusif aux combats d'élite de la zone`,
            butinCourant.elites.map((id) => htmlObjet(id)),
          )}
          ${htmlSection(
            `Butin du boss`,
            boss ? `Lâché par ${boss}` : `Lâché au donjon`,
            butinCourant.boss.map((objet) =>
              htmlObjet(objet.id, objet.aussiElite ? `aussi en combat dur` : ``),
            ),
          )}`;
      }
      afficherEcran(`
        <h1>Armurerie</h1>
        <div class="best-onglets" role="group" aria-label="Mondes">${htmlOnglets}</div>
        <div class="best-vue">
          <nav class="best-zones" aria-label="Zones du monde">${htmlZones}</nav>
          <section class="best-detail"><button type="button" class="best-vers-zones secondaire">↑ Zones</button>${htmlDetail}</section>
        </div>
        ${mondesVides.length ? `<p class="muet monde-verrouille">${mondesVides.map((monde) => echapperHtml(monde.nom)).join(`, `)} : aucun objet pour l'instant</p>` : ``}
        ${barreRetour(`armu-retour`)}
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
      racine.querySelector(`.best-vers-zones`)?.addEventListener(`click`, () => {
        const zone =
          racine.querySelector(`.best-zone.actif`) ?? racine.querySelector(`.best-zones`);
        zone?.scrollIntoView({ block: `center`, behavior: comportementDefilement() });
        zone?.focus({ preventScroll: true });
      });
      racine.querySelector(`#armu-retour`)?.addEventListener(`click`, () => resolve());
    };
    afficher();
  });
}
