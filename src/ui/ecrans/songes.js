// Écran « Songe — Étage N » entre deux étages des Songes infinis : équipe, affixes actifs, choix
// d'une récompense, palier (taverne, HDV) et accès à l'équipement.
import { BENEDICTIONS, objetsForgeables } from "../../jeu/rencontres.js";
import {
  CONFIG_SONGES,
  affixesAffiches,
  estEtageBoss,
  facteurSonge,
  recordSonges,
} from "../../jeu/songes.js";
import { EQUIPEMENTS } from "../../data/index.js";
import { htmlBarreEquipe } from "../barreEquipe.js";
import {
  IMG_CARACTERISTIQUES,
  IMG_FORMATION,
  IMG_INVENTAIRE,
  IMG_MENU,
  afficherEcran,
  attrTipObjet,
  cheminAsset,
  classeRarete,
  echapperHtml,
  htmlChipsObjet,
  htmlKamas,
  htmlMetaObjet,
  htmlNomObjet,
  imgObjet,
  racine,
} from "../commun.js";
import { ecranEquipement } from "./equipement.js";
import { ecranFormation } from "./formation.js";
import { ecranCaracteristiques } from "./caracteristiques.js";

export const IMG_SONGES = cheminAsset(`/assets/dofus/dofus_du_cauchemar.png`);
const pluriel = (nombre, mot) => `${nombre} ${mot}${nombre > 1 ? `s` : ``}`;

/** Pastilles des affixes de songe actifs (mêmes pastilles qu'en combat). */
export function htmlAffixesSonge(affixes) {
  const groupes = affixesAffiches(affixes);
  if (!groupes.length) {
    return `<p class="songe-aucun-affixe">Aucun affixe de songe pour l'instant.</p>`;
  }
  return `<div class="affixes-combat songe-affixes">${groupes
    .map(
      (affixe) =>
        `<span class="affixe-pastille" tabindex="0" data-tip="${echapperHtml(`${affixe.desc}${affixe.n > 1 ? ` (×${affixe.n}, cumulé)` : ``}, pour tous les ennemis.`)}">⚔ ${echapperHtml(affixe.nom)}</span>`,
    )
    .join(``)}</div>`;
}

function htmlRecompense(recompense, indice, run) {
  let contenu;
  switch (recompense.type) {
    case `objet`: {
      const inst = recompense.objet;
      if (!inst) {
        return ``;
      }
      contenu = `<span class="songe-rec-titre">🎒 Objet</span>
        <span class="songe-rec-objet${classeRarete(inst)}"><img src="${imgObjet(inst.id)}" alt="" loading="lazy" onerror="this.remove()" />
          <span class="item-nom">${htmlNomObjet(inst)}<small><span class="ic-meta">${htmlMetaObjet(inst)}</span> ${htmlChipsObjet(inst)}</small></span></span>`;
      return `<button class="songe-recompense" data-recompense="${indice}"${attrTipObjet(inst.id)}>${contenu}</button>`;
    }
    case `soin`:
      contenu = `<span class="songe-rec-titre">💤 Repos</span>
        <small>Héros debout : +${Math.round(recompense.pct * 100)} % de leurs PV max. Héros K.O. relevés à ${Math.round(recompense.releve * 100)} %.</small>`;
      break;
    case `kamas`:
      contenu = `<span class="songe-rec-titre">💰 Bourse du songe</span>
        <small>${htmlKamas(recompense.montant)} pour l'HDV des paliers.</small>`;
      break;
    default: {
      const benediction = BENEDICTIONS[recompense.benediction];
      if (benediction) {
        contenu = `<span class="songe-rec-titre">✨ ${echapperHtml(benediction.nom)}</span>
          <small>${echapperHtml(benediction.desc)} pour toute l'équipe, jusqu'à la fin du songe.</small>`;
      } else {
        const [objet] = objetsForgeables(run, 1);
        contenu = `<span class="songe-rec-titre">🔨 Forgemage du songe</span>
          <small>${objet ? `${echapperHtml(EQUIPEMENTS[objet.id]?.nom ?? objet.id)} monte d'un cran de rareté, sans risque.` : `Aucun objet à monter.`}</small>`;
      }
    }
  }
  return `<button class="songe-recompense" data-recompense="${indice}">${contenu}</button>`;
}

/**
 * @returns {Promise<{type: `combat` | `accueil` | `taverne` | `hdv`} | {type: `recompense`, indice: number}>}
 */
export function ecranSonge(run, meta, onModif = () => {}) {
  return new Promise((resolve) => {
    const afficher = () => {
      const etage = run.etage;
      const offre = run.offreSonge?.length ? run.offreSonge : null;
      const palier = run.palierSonge;
      const boss = estEtageBoss(etage);
      const prochainAffixe = Math.ceil(etage / CONFIG_SONGES.affixeTous) * CONFIG_SONGES.affixeTous;
      const record = recordSonges(meta);
      const nbObjets = run.inventaire.length;
      afficherEcran(
        `
        <div class="songe-tete">
          <img class="songe-embleme" src="${IMG_SONGES}" alt="" onerror="this.remove()" />
          <div>
            <h1>Songe — Étage ${etage}</h1>
            <p class="songe-sous-titre">${pluriel(etage - 1, `étage`)} franchi${etage > 2 ? `s` : ``} · Record : ${pluriel(record, `étage`)}</p>
          </div>
        </div>
        ${htmlBarreEquipe(run.persos, run.kamas)}
        <section class="songe-bloc">
          <h2>${boss ? `👑 Étage ${etage} : boss du songe` : `⚔ Étage ${etage}`}</h2>
          <p class="songe-info">Puissance des monstres : ×${facteurSonge(etage).toFixed(2).replace(`.`, `,`)}${boss ? ` (boss ramené à la force d'un boss du Monde 5)` : ``}. Prochain affixe après l'étage ${prochainAffixe}, palier après l'étage ${Math.ceil(etage / CONFIG_SONGES.palierTous) * CONFIG_SONGES.palierTous}.</p>
          <h3 class="songe-h3">Affixes de songe actifs</h3>
          ${htmlAffixesSonge(run.affixesSonge)}
        </section>
        ${
          palier
            ? `<section class="songe-bloc songe-palier">
          <h2>🏕️ Palier</h2>
          <p class="songe-info">Le boss est tombé : équipe soignée à 100 %. Une halte à la taverne (recruter) et à l'Hôtel de vente, une fois chacune.</p>
          <div class="songe-palier-choix">
            <button id="songe-taverne" class="secondaire"${palier.taverne ? ` disabled` : ``}>🍺 Taverne${palier.taverne ? ` (faite)` : ``}</button>
            <button id="songe-hdv" class="secondaire"${palier.hdv ? ` disabled` : ``}>🏪 Hôtel de vente${palier.hdv ? ` (fait)` : ``}</button>
          </div>
        </section>`
            : ``
        }
        ${
          offre
            ? `<section class="songe-bloc">
          <h2>Choisis une récompense</h2>
          <div class="songe-recompenses">${offre.map((recompense, indice) => htmlRecompense(recompense, indice, run)).join(``)}</div>
        </section>`
            : ``
        }
        <div class="songe-outils">
          <button id="songe-equip" class="secondaire songe-outil"><img src="${IMG_INVENTAIRE}" alt="" onerror="this.remove()" />Équipement${nbObjets ? ` (${nbObjets})` : ``}</button>
          <button id="songe-formation" class="secondaire songe-outil"><img src="${IMG_FORMATION}" alt="" onerror="this.remove()" />Formation</button>
          <button id="songe-stats" class="secondaire songe-outil"><img src="${IMG_CARACTERISTIQUES}" alt="" onerror="this.remove()" />Stats</button>
        </div>
        <div class="boutons-ecran songe-boutons">
          <button id="songe-accueil" class="aside-icone btn-retour" title="Retour à l'accueil (la tentative reste sauvegardée)"><img src="${IMG_MENU}" alt="Accueil" onerror="this.remove()" /></button>
          <button id="songe-combat" class="primaire songe-entrer"${offre ? ` disabled` : ``}>${offre ? `Choisis d'abord une récompense` : `🌙 Entrer dans l'étage ${etage}`}</button>
        </div>
      `,
        `ecran-songe`,
      );
      racine
        .querySelectorAll(`[data-recompense]`)
        .forEach((bouton) =>
          bouton.addEventListener(`click`, () =>
            resolve({ type: `recompense`, indice: Number(bouton.dataset.recompense) }),
          ),
        );
      const sousEcran = (id, action) =>
        document.getElementById(id)?.addEventListener(`click`, async () => {
          await action();
          onModif();
          afficher();
        });
      sousEcran(`songe-equip`, () => ecranEquipement(run.persos, run.inventaire));
      sousEcran(`songe-formation`, () => ecranFormation(run.persos));
      sousEcran(`songe-stats`, () =>
        ecranCaracteristiques(run.persos, undefined, undefined, true, meta),
      );
      document
        .getElementById(`songe-taverne`)
        ?.addEventListener(`click`, () => resolve({ type: `taverne` }));
      document
        .getElementById(`songe-hdv`)
        ?.addEventListener(`click`, () => resolve({ type: `hdv` }));
      document
        .getElementById(`songe-accueil`)
        ?.addEventListener(`click`, () => resolve({ type: `accueil` }));
      document.getElementById(`songe-combat`)?.addEventListener(`click`, () => {
        if (!run.offreSonge?.length) {
          resolve({ type: `combat` });
        }
      });
    };
    afficher();
  });
}
