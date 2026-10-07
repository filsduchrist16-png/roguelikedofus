import { EQUIPEMENTS } from "../../data/index.js";
import {
  acheterObjet,
  annulerVente,
  prixRevente,
  vendreObjet,
  vendreTout,
} from "../../jeu/economie.js";
import { grouperInventaire } from "../../jeu/inventaire.js";
import { enregistrerCollection } from "../../sauvegarde/meta.js";
import {
  NOMS_SLOTS,
  afficherEcran,
  attrTipObjet,
  barreRetour,
  classeRarete,
  echapperHtml,
  htmlBadgesHeros,
  htmlChipsObjet,
  htmlKamas,
  htmlNomObjet,
  imgObjet,
  racine,
} from "../commun.js";
export function ecranHdv(e, t, n) {
  return new Promise((resolve) => {
    // vendre tout demande une confirmation (un seul appui vidait tout l'inventaire)
    let confirmerVenteTotale = false;
    // dernière vente, pour pouvoir l'annuler
    let derniereVente = null;
    let i = () => {
      let a = t.length
        ? t
            .map((t, n) => {
              let r = e.kamas >= t.prix;
              return `<button class="item-carte hdv-achat${classeRarete(t.inst)}" data-achat="${n}" ${r ? `` : `disabled`}${attrTipObjet(t.inst.id)}>
              <img src="${imgObjet(t.inst.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${htmlNomObjet(t.inst)}<small>${NOMS_SLOTS[EQUIPEMENTS[t.inst.id].slot]} ${htmlChipsObjet(t.inst)}</small>${htmlBadgesHeros(t.inst, e.persos)}</span>
              <span class="hdv-prix">${htmlKamas(t.prix)}</span>
            </button>`;
            })
            .join(``)
        : `<p class="muet">Rayons vides, reviens à un prochain Hôtel de vente.</p>`;
      let o = e.inventaire.length
        ? grouperInventaire(e.inventaire)
            .map(
              ({
                inst: e_,
                indices,
              }) => `<button class="item-carte hdv-vente${classeRarete(e_)}" data-vente="${indices[0]}"${attrTipObjet(e_.id)}>
              <img src="${imgObjet(e_.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${htmlNomObjet(e_)}${indices.length > 1 ? ` <span class="item-qte">×${indices.length}</span>` : ``}<small>${NOMS_SLOTS[EQUIPEMENTS[e_.id].slot]} ${htmlChipsObjet(e_)}</small>${htmlBadgesHeros(e_, e.persos)}</span>
              <span class="hdv-prix vente">${htmlKamas(prixRevente(e_))}</span>
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
              ${e.inventaire.length ? `<button id="hdv-vendre-tout" class="secondaire hdv-tout${confirmerVenteTotale ? ` danger-arme` : ``}" title="Vendre tout l'inventaire (l'équipement porté n'est pas concerné)">${confirmerVenteTotale ? `Confirmer : tout vendre` : `Vendre tout`} · ${htmlKamas(e.inventaire.reduce((acc, item) => acc + prixRevente(item), 0))}</button>` : ``}
            </h3>
            ${derniereVente ? `<div class="hdv-annuler" role="status">Vendu : <b>${echapperHtml(EQUIPEMENTS[derniereVente.inst.id]?.nom ?? ``)}</b> (+${htmlKamas(derniereVente.prix)}) <button id="hdv-annuler" class="secondaire">Annuler</button></div>` : ``}
            <p class="equip-astuce muet">▲ : amélioration pour ce héros. Un appui vend l'objet ; la dernière vente peut être annulée.</p>
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
            derniereVente = null;
            if (n && o) {
              enregistrerCollection(n, [o]);
            }
            i();
          }
        }),
      );
      racine.querySelectorAll(`[data-vente]`).forEach((t) =>
        t.addEventListener(`click`, () => {
          let index = Number(t.dataset.vente);
          let inst = e.inventaire[index];
          let prix = inst ? prixRevente(inst) : 0;
          if (vendreObjet(e, index)) {
            derniereVente = { inst, prix };
            confirmerVenteTotale = false;
            i();
          }
        }),
      );
      document.getElementById(`hdv-vendre-tout`)?.addEventListener(`click`, () => {
        if (!confirmerVenteTotale) {
          confirmerVenteTotale = true;
          i();
          return;
        }
        confirmerVenteTotale = false;
        derniereVente = null;
        vendreTout(e);
        i();
      });
      document.getElementById(`hdv-annuler`)?.addEventListener(`click`, () => {
        if (derniereVente && annulerVente(e, derniereVente.inst, derniereVente.prix)) {
          derniereVente = null;
          i();
        }
      });
      document.getElementById(`hdv-retour`)?.addEventListener(`click`, () => resolve());
    };
    i();
  });
}
