import { CLASSES, EQUIPEMENTS } from "../../data/index.js";
import {
  acheterObjet,
  annulerAchat,
  annulerVente,
  annulerVentes,
  prixRevente,
  vendreObjet,
  vendreTout,
} from "../../jeu/economie.js";
import { grouperInventaire, herosAmeliores, objetsInutiles } from "../../jeu/inventaire.js";
import { emplacementCible, equiperObjet } from "../../jeu/run.js";
import { enregistrerCollection } from "../../sauvegarde/meta.js";
import {
  afficherEnGardantScroll,
  attrTipObjet,
  boutonRetour,
  classeRarete,
  echapperHtml,
  htmlBadgesHeros,
  htmlChipsObjet,
  htmlKamas,
  htmlMetaObjet,
  htmlNomObjet,
  imgObjet,
  racine,
} from "../commun.js";
const nomObjet = (inst) => echapperHtml(EQUIPEMENTS[inst.id]?.nom ?? inst.id);
export function ecranHdv(e, t, n) {
  return new Promise((resolve) => {
    // vendre tout demande une confirmation (un seul appui vidait tout l'inventaire)
    let confirmerVenteTotale = false;
    // dernière opération annulable : { type: `vente`, inst, prix } · { type: `lot`, ventes }
    // · { type: `achat`, inst, prix, index, equipe?: { perso, emplacement, ancien } }
    let annulable = null;
    let i = () => {
      let a = t.length
        ? t
            .map((t, n) => {
              let r = e.kamas >= t.prix;
              return `<button class="item-carte hdv-achat${classeRarete(t.inst)}" data-achat="${n}" ${r ? `` : `disabled`}${attrTipObjet(t.inst.id)}>
              <img src="${imgObjet(t.inst.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${htmlNomObjet(t.inst)}<small><span class="ic-meta">${htmlMetaObjet(t.inst)}</span> ${htmlChipsObjet(t.inst)}</small>${htmlBadgesHeros(t.inst, e.persos)}</span>
              ${r ? `<span class="hdv-prix">${htmlKamas(t.prix)}</span>` : `<span class="hdv-prix hdv-manque" title="Prix : ${t.prix.toLocaleString(`fr-FR`)} k">il manque ${htmlKamas(t.prix - e.kamas)}</span>`}
            </button>`;
            })
            .join(``)
        : `<p class="muet">Rayons vides, reviens à un prochain Hôtel de vente.</p>`;
      const inutiles = objetsInutiles(e);
      // les objets que « Vendre l'inutile » vendrait d'abord, marqués d'une pastille grise
      const groupes = grouperInventaire(e.inventaire).map((g) => ({
        ...g,
        inutile: inutiles.includes(g.inst),
      }));
      groupes.sort((x, y) => Number(y.inutile) - Number(x.inutile));
      let o = e.inventaire.length
        ? groupes
            .map(
              ({
                inst: e_,
                indices,
                inutile,
              }) => `<button class="item-carte hdv-vente${classeRarete(e_)}${inutile ? ` hdv-inutile` : ``}" data-vente="${indices[0]}"${attrTipObjet(e_.id)}>
              <img src="${imgObjet(e_.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${htmlNomObjet(e_)}${indices.length > 1 ? ` <span class="item-qte">×${indices.length}</span>` : ``}${inutile ? ` <span class="pastille-inutile" title="N'améliore aucun héros : « Vendre l'inutile » le vendra">Inutile</span>` : ``}<small><span class="ic-meta">${htmlMetaObjet(e_)}</span> ${htmlChipsObjet(e_)}</small>${htmlBadgesHeros(e_, e.persos)}</span>
              <span class="hdv-prix vente">${htmlKamas(prixRevente(e_))}</span>
            </button>`,
            )
            .join(``)
        : `<p class="muet">Rien à vendre : l'équipement non équipé de l'inventaire se revend ici.</p>`;
      afficherEnGardantScroll(`
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
              ${
                inutiles.length
                  ? `<button id="hdv-vendre-inutile" class="secondaire hdv-tout" title="Vend les objets qui n'améliorent aucun héros (ni nettement, ni « plutôt mieux »)">Vendre l'inutile (${inutiles.length}) · ${htmlKamas(inutiles.reduce((acc, item) => acc + prixRevente(item), 0))}</button>`
                  : ``
              }
              ${e.inventaire.length ? `<button id="hdv-vendre-tout" class="secondaire hdv-tout${confirmerVenteTotale ? ` danger-arme` : ``}" title="Vendre tout l'inventaire (l'équipement porté n'est pas concerné)">${confirmerVenteTotale ? `Confirmer : tout vendre` : `Vendre tout`} · ${htmlKamas(e.inventaire.reduce((acc, item) => acc + prixRevente(item), 0))}</button>` : ``}
            </h3>
            <p class="equip-astuce muet">▲ : amélioration pour ce héros. Un appui vend l'objet ; la dernière opération peut être annulée.</p>
            <div class="equip-inv">${o}</div>
          </div>
        </div>
        <div class="boutons-ecran hdv-barre">${htmlBarreAnnulation()}${boutonRetour(`hdv-retour`, `Retour au plateau`)}</div>
      `);
      racine.querySelectorAll(`[data-achat]`).forEach((r) =>
        r.addEventListener(`click`, () => {
          let a = Number(r.dataset.achat);
          let o = t[a];
          if (o && acheterObjet(e, t, a)) {
            annulable = { type: `achat`, inst: o.inst, prix: o.prix, index: a };
            confirmerVenteTotale = false;
            if (n) {
              enregistrerCollection(n, [o.inst]);
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
            annulable = { type: `vente`, inst, prix };
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
        const ventes = e.inventaire.map((inst) => ({ inst, prix: prixRevente(inst) }));
        vendreTout(e);
        annulable = ventes.length ? { type: `lot`, ventes } : null;
        i();
      });
      document.getElementById(`hdv-vendre-inutile`)?.addEventListener(`click`, () => {
        const ventes = [];
        for (const inst of objetsInutiles(e)) {
          const prix = prixRevente(inst);
          if (vendreObjet(e, e.inventaire.indexOf(inst))) {
            ventes.push({ inst, prix });
          }
        }
        annulable = ventes.length ? { type: `lot`, ventes } : null;
        confirmerVenteTotale = false;
        i();
      });
      document.getElementById(`hdv-annuler`)?.addEventListener(`click`, () => {
        if (annuler()) {
          annulable = null;
        }
        i();
      });
      document.querySelectorAll(`[data-equiper-achat]`).forEach((b) =>
        b.addEventListener(`click`, () => {
          const perso = e.persos[Number(b.dataset.equiperAchat)];
          const index = e.inventaire.indexOf(annulable?.inst);
          if (!perso || index < 0) {
            return;
          }
          const emplacement = emplacementCible(perso, annulable.inst);
          const ancien = perso.equipement[emplacement];
          equiperObjet(e.inventaire, perso, index, emplacement);
          if (perso.equipement[emplacement] === annulable.inst) {
            annulable.equipe = { perso, emplacement, ancien };
          }
          i();
        }),
      );
      document.getElementById(`hdv-retour`)?.addEventListener(`click`, () => {
        resolve();
      });
    };
    // Annule la dernière opération ; un achat équipé est d'abord retiré (l'ancienne pièce revient).
    const annuler = () => {
      if (!annulable) {
        return false;
      }
      if (annulable.type === `vente`) {
        return annulerVente(e, annulable.inst, annulable.prix);
      }
      if (annulable.type === `lot`) {
        return annulerVentes(e, annulable.ventes);
      }
      const eq = annulable.equipe;
      if (eq && eq.perso.equipement[eq.emplacement] === annulable.inst) {
        const iAncien = eq.ancien ? e.inventaire.indexOf(eq.ancien) : -1;
        if (iAncien >= 0) {
          equiperObjet(e.inventaire, eq.perso, iAncien, eq.emplacement);
        } else {
          delete eq.perso.equipement[eq.emplacement];
          e.inventaire.push(annulable.inst);
        }
      }
      return annulerAchat(e, t, annulable.inst, annulable.prix, annulable.index);
    };
    // Barre d'annulation fixée en bas de l'écran, au-dessus du bouton Retour.
    const htmlBarreAnnulation = () => {
      if (!annulable) {
        return ``;
      }
      let texte = ``;
      let extra = ``;
      let possible = true;
      if (annulable.type === `vente`) {
        texte = `Vendu : <b>${nomObjet(annulable.inst)}</b> (+${htmlKamas(annulable.prix)})`;
        possible = e.kamas >= annulable.prix;
      } else if (annulable.type === `lot`) {
        const total = annulable.ventes.reduce((a, v) => a + v.prix, 0);
        const nb = annulable.ventes.length;
        const quoi = nb > 1 ? `${nb} objets` : nomObjet(annulable.ventes[0].inst);
        texte = `Vendu : <b>${quoi}</b> (+${htmlKamas(total)})`;
        possible = e.kamas >= total;
      } else {
        texte = `Acheté : <b>${nomObjet(annulable.inst)}</b> (−${htmlKamas(annulable.prix)})`;
        if (annulable.equipe) {
          texte += ` · équipé sur ${echapperHtml(CLASSES[annulable.equipe.perso.classeId]?.nom ?? ``)}`;
        } else if (e.inventaire.includes(annulable.inst)) {
          extra = herosAmeliores(annulable.inst, e.persos)
            .map(
              (p) =>
                `<button class="primaire petit" data-equiper-achat="${e.persos.indexOf(p)}">Équiper sur ${echapperHtml(CLASSES[p.classeId]?.nom ?? p.classeId)}</button>`,
            )
            .join(``);
        }
      }
      const libelle =
        annulable.type === `lot` && annulable.ventes.length > 1
          ? `Annuler (${annulable.ventes.length} objets)`
          : `Annuler`;
      return `<div class="hdv-snack" role="status">
        <span class="hdv-snack-texte">${texte} · solde ${htmlKamas(e.kamas)}</span>
        <span class="hdv-snack-boutons">${extra}<button id="hdv-annuler" class="secondaire petit" ${possible ? `` : `disabled title="Plus assez de kamas pour annuler"`}>${libelle}</button></span>
      </div>`;
    };
    i();
  });
}
