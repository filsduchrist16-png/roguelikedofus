import { EQUIPEMENTS } from "../../data/index.js";
import { acheterObjet, prixRevente, vendreObjet, vendreTout } from "../../jeu/economie.js";
import { enregistrerCollection } from "../../sauvegarde/meta.js";
import {
  NOMS_SLOTS,
  afficherEcran,
  barreRetour,
  classeRarete,
  htmlChipsObjet,
  htmlKamas,
  htmlNomObjet,
  imgObjet,
  racine,
} from "../commun.js";
export function ecranHdv(e, t, n) {
  return new Promise((resolve) => {
    let i = () => {
      let a = t.length
        ? t
            .map((t, n) => {
              let r = e.kamas >= t.prix;
              return `<button class="item-carte hdv-achat${classeRarete(t.inst)}" data-achat="${n}" ${r ? `` : `disabled`}>
              <img src="${imgObjet(t.inst.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${htmlNomObjet(t.inst)}<small>${NOMS_SLOTS[EQUIPEMENTS[t.inst.id].slot]} ${htmlChipsObjet(t.inst)}</small></span>
              <span class="hdv-prix">${htmlKamas(t.prix)}</span>
            </button>`;
            })
            .join(``)
        : `<p class="muet">Rayons vides, reviens à un prochain Hôtel de vente.</p>`;
      let o = e.inventaire.length
        ? e.inventaire
            .map(
              (e, t) => `<button class="item-carte hdv-vente${classeRarete(e)}" data-vente="${t}">
              <img src="${imgObjet(e.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${htmlNomObjet(e)}<small>${NOMS_SLOTS[EQUIPEMENTS[e.id].slot]} ${htmlChipsObjet(e)}</small></span>
              <span class="hdv-prix vente">${htmlKamas(prixRevente(e))}</span>
            </button>`,
            )
            .join(``)
        : `<p class="muet">Rien à vendre : l'équipement non équipé de l'inventaire se revend ici.</p>`;
      afficherEcran(`
        <h1>Hôtel de vente</h1>
        <p class="sous-titre">Tout le catalogue de la zone (exclusifs boss/élite compris) : local en épique+, zone suivante dès le rare. Revente à 50 % du prix.</p>
        <div class="hdv-solde">${htmlKamas(e.kamas)}</div>
        <div class="equip-corps">
          <div class="equip-col">
            <h3>À vendre (${t.length})</h3>
            <div class="equip-inv">${a}</div>
          </div>
          <div class="equip-col">
            <h3>Ton inventaire (${e.inventaire.length})
              ${e.inventaire.length ? `<button id="hdv-vendre-tout" class="secondaire hdv-tout" title="Vendre tout l'inventaire (l'équipement porté n'est pas concerné)">Vendre tout · ${htmlKamas(e.inventaire.reduce((acc, item) => acc + prixRevente(item), 0))}</button>` : ``}
            </h3>
            <div class="equip-inv">${o}</div>
          </div>
        </div>
        ${barreRetour(`hdv-retour`, `Retour au plateau`)}
      `);
      racine.querySelectorAll(`[data-achat]`).forEach((r) =>
        r.addEventListener(`click`, () => {
          let a = Number(r.dataset.achat);
          let o = t[a]?.inst;
          if (acheterObjet(e, t, a)) {
            if (n && o) {
              enregistrerCollection(n, [o]);
            }
            i();
          }
        }),
      );
      racine.querySelectorAll(`[data-vente]`).forEach((t) =>
        t.addEventListener(`click`, () => {
          if (vendreObjet(e, Number(t.dataset.vente))) {
            i();
          }
        }),
      );
      document.getElementById(`hdv-vendre-tout`)?.addEventListener(`click`, () => {
        if (vendreTout(e) > 0) {
          i();
        }
      });
      document.getElementById(`hdv-retour`)?.addEventListener(`click`, () => resolve());
    };
    i();
  });
}
