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
import { enregistrerCollection, sauverMeta } from "../../sauvegarde/meta.js";
import {
  comportementDefilement,
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
export function ecranHdv(run, offres, meta) {
  return new Promise((resolve) => {
    // vendre tout demande une confirmation (un seul appui vidait tout l'inventaire)
    let confirmerVenteTotale = false;
    // dernière opération annulable : { type: `vente`, inst, prix } · { type: `lot`, ventes }
    // · { type: `achat`, inst, prix, index, equipe?: { perso, emplacement, ancien } }
    let annulable = null;
    let afficher = () => {
      let htmlAchats = offres.length
        ? offres
            .map((offre, indice) => {
              let abordable = run.kamas >= offre.prix;
              return `<button class="item-carte hdv-achat${classeRarete(offre.inst)}" data-achat="${indice}" ${abordable ? `` : `disabled`}${attrTipObjet(offre.inst.id)}>
              <img src="${imgObjet(offre.inst.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${htmlNomObjet(offre.inst)}<small><span class="ic-meta">${htmlMetaObjet(offre.inst)}</span> ${htmlChipsObjet(offre.inst)}</small>${htmlBadgesHeros(offre.inst, run.persos)}</span>
              ${abordable ? `<span class="hdv-prix"><small class="hdv-verbe">Acheter</small>${htmlKamas(offre.prix)}</span>` : `<span class="hdv-prix hdv-manque" title="Prix : ${offre.prix.toLocaleString(`fr-FR`)} k">il manque ${htmlKamas(offre.prix - run.kamas)}</span>`}
            </button>`;
            })
            .join(``)
        : `<p class="muet">Rayons vides, reviens à un prochain Hôtel de vente.</p>`;
      const inutiles = objetsInutiles(run);
      // les objets que « Vendre l'inutile » vendrait d'abord, marqués d'une pastille grise
      const groupes = grouperInventaire(run.inventaire).map((groupe) => ({
        ...groupe,
        inutile: inutiles.includes(groupe.inst),
      }));
      groupes.sort((premier, second) => Number(second.inutile) - Number(premier.inutile));
      let htmlVentes = run.inventaire.length
        ? groupes
            .map(
              ({
                inst: objet,
                indices,
                inutile,
              }) => `<button class="item-carte hdv-vente${classeRarete(objet)}${inutile ? ` hdv-inutile` : ``}" data-vente="${indices[0]}"${attrTipObjet(objet.id)}>
              <img src="${imgObjet(objet.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${htmlNomObjet(objet)}${indices.length > 1 ? ` <span class="item-qte">×${indices.length}</span>` : ``}${inutile ? ` <span class="pastille-inutile" data-tip="N'améliore aucun héros : « Vendre l'inutile » le vendra">Inutile</span>` : ``}<small><span class="ic-meta">${htmlMetaObjet(objet)}</span> ${htmlChipsObjet(objet)}</small>${htmlBadgesHeros(objet, run.persos)}</span>
              <span class="hdv-prix vente"><small class="hdv-verbe">Vendre</small>${htmlKamas(prixRevente(objet))}</span>
            </button>`,
            )
            .join(``)
        : `<p class="muet">Rien à vendre : l'équipement non équipé de l'inventaire se revend ici.</p>`;
      afficherEnGardantScroll(`
        <h1>Hôtel de vente</h1>
        <p class="sous-titre">Tout le catalogue de la zone (exclusifs boss/élite compris) : local en épique+, zone suivante dès le rare. Revente à 50 % du prix.</p>
        <div class="hdv-solde">${htmlKamas(run.kamas)}</div>
        <div class="hdv-saut" role="group" aria-label="Aller à la liste">
          <button class="secondaire petit" data-saut="hdv-achats">Acheter (${offres.length})</button>
          <button class="secondaire petit" data-saut="hdv-ventes">Vendre (${run.inventaire.length})</button>
        </div>
        <div class="equip-corps">
          <div class="equip-col" id="hdv-achats">
            <h3>À acheter (${offres.length})</h3>
            <div class="equip-inv">${htmlAchats}</div>
          </div>
          <div class="equip-col" id="hdv-ventes">
            <h3>Ton inventaire (${run.inventaire.length})
              ${
                inutiles.length
                  ? `<button id="hdv-vendre-inutile" class="secondaire hdv-tout" title="Vend les objets qui n'améliorent aucun héros (ni nettement, ni « plutôt mieux »)">Vendre l'inutile (${inutiles.length}) · ${htmlKamas(inutiles.reduce((acc, item) => acc + prixRevente(item), 0))}</button>`
                  : ``
              }
              ${run.inventaire.length ? `<button id="hdv-vendre-tout" class="secondaire hdv-tout${confirmerVenteTotale ? ` danger-arme` : ``}" title="Vendre tout l'inventaire (l'équipement porté n'est pas concerné)">${confirmerVenteTotale ? `Confirmer : tout vendre` : `Vendre tout`} · ${htmlKamas(run.inventaire.reduce((acc, item) => acc + prixRevente(item), 0))}</button>` : ``}
            </h3>
            <p class="equip-astuce muet">▲ : amélioration pour ce héros. Un appui vend l'objet ; la dernière opération peut être annulée.</p>
            <div class="equip-inv">${htmlVentes}</div>
          </div>
        </div>
        <div class="boutons-ecran hdv-barre">${htmlBarreAnnulation()}${boutonRetour(`hdv-retour`, `Retour au plateau`)}</div>
      `);
      racine
        .querySelectorAll(`[data-saut]`)
        .forEach((bouton) =>
          bouton.addEventListener(`click`, () =>
            document
              .getElementById(bouton.dataset.saut)
              ?.scrollIntoView({ behavior: comportementDefilement(), block: `start` }),
          ),
        );
      racine.querySelectorAll(`[data-achat]`).forEach((bouton) =>
        bouton.addEventListener(`click`, () => {
          let indiceAchat = Number(bouton.dataset.achat);
          let offre = offres[indiceAchat];
          if (offre && acheterObjet(run, offres, indiceAchat)) {
            // rareté déjà en collection avant l'achat (pour la rétablir si l'achat est annulé)
            const collectionAvant = meta?.collection?.[offre.inst.id];
            annulable = {
              type: `achat`,
              inst: offre.inst,
              prix: offre.prix,
              index: indiceAchat,
              collectionAvant,
            };
            confirmerVenteTotale = false;
            if (meta) {
              enregistrerCollection(meta, [offre.inst]);
            }
            afficher();
          }
        }),
      );
      racine.querySelectorAll(`[data-vente]`).forEach((bouton) =>
        bouton.addEventListener(`click`, () => {
          let index = Number(bouton.dataset.vente);
          let inst = run.inventaire[index];
          let prix = inst ? prixRevente(inst) : 0;
          if (vendreObjet(run, index)) {
            annulable = { type: `vente`, inst, prix };
            confirmerVenteTotale = false;
            afficher();
          }
        }),
      );
      document.getElementById(`hdv-vendre-tout`)?.addEventListener(`click`, () => {
        if (!confirmerVenteTotale) {
          confirmerVenteTotale = true;
          afficher();
          return;
        }
        confirmerVenteTotale = false;
        const ventes = run.inventaire.map((inst) => ({ inst, prix: prixRevente(inst) }));
        vendreTout(run);
        annulable = ventes.length ? { type: `lot`, ventes } : null;
        afficher();
      });
      document.getElementById(`hdv-vendre-inutile`)?.addEventListener(`click`, () => {
        const ventes = [];
        for (const inst of objetsInutiles(run)) {
          const prix = prixRevente(inst);
          if (vendreObjet(run, run.inventaire.indexOf(inst))) {
            ventes.push({ inst, prix });
          }
        }
        annulable = ventes.length ? { type: `lot`, ventes } : null;
        confirmerVenteTotale = false;
        afficher();
      });
      document.getElementById(`hdv-annuler`)?.addEventListener(`click`, () => {
        if (annuler()) {
          annulable = null;
        }
        afficher();
      });
      document.querySelectorAll(`[data-equiper-achat]`).forEach((bouton) =>
        bouton.addEventListener(`click`, () => {
          const perso = run.persos[Number(bouton.dataset.equiperAchat)];
          const index = run.inventaire.indexOf(annulable?.inst);
          if (!perso || index < 0) {
            return;
          }
          const emplacement = emplacementCible(perso, annulable.inst);
          const ancien = perso.equipement[emplacement];
          equiperObjet(run.inventaire, perso, index, emplacement);
          if (perso.equipement[emplacement] === annulable.inst) {
            annulable.equipe = { perso, emplacement, ancien };
          }
          afficher();
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
        return annulerVente(run, annulable.inst, annulable.prix);
      }
      if (annulable.type === `lot`) {
        return annulerVentes(run, annulable.ventes);
      }
      const eq = annulable.equipe;
      if (eq && eq.perso.equipement[eq.emplacement] === annulable.inst) {
        const iAncien = eq.ancien ? run.inventaire.indexOf(eq.ancien) : -1;
        if (iAncien >= 0) {
          equiperObjet(run.inventaire, eq.perso, iAncien, eq.emplacement);
        } else {
          delete eq.perso.equipement[eq.emplacement];
          run.inventaire.push(annulable.inst);
        }
      }
      const annule = annulerAchat(run, offres, annulable.inst, annulable.prix, annulable.index);
      // un achat annulé ne reste pas dans la collection s'il n'y était pas avant
      if (annule && meta?.collection) {
        if (annulable.collectionAvant === undefined) {
          delete meta.collection[annulable.inst.id];
        } else {
          meta.collection[annulable.inst.id] = annulable.collectionAvant;
        }
        sauverMeta(meta);
      }
      return annule;
    };
    // Barre d'annulation fixée en bas de l'écran, au-dessus du bouton Retour.
    const htmlBarreAnnulation = () => {
      if (!annulable) {
        return ``;
      }
      let texte;
      let extra = ``;
      let possible = true;
      if (annulable.type === `vente`) {
        texte = `Vendu : <b>${nomObjet(annulable.inst)}</b> (+${htmlKamas(annulable.prix)})`;
        possible = run.kamas >= annulable.prix;
      } else if (annulable.type === `lot`) {
        const total = annulable.ventes.reduce((somme, vente) => somme + vente.prix, 0);
        const nb = annulable.ventes.length;
        const quoi = nb > 1 ? `${nb} objets` : nomObjet(annulable.ventes[0].inst);
        texte = `Vendu : <b>${quoi}</b> (+${htmlKamas(total)})`;
        possible = run.kamas >= total;
      } else {
        texte = `Acheté : <b>${nomObjet(annulable.inst)}</b> (−${htmlKamas(annulable.prix)})`;
        if (annulable.equipe) {
          texte += ` · équipé sur ${echapperHtml(CLASSES[annulable.equipe.perso.classeId]?.nom ?? ``)}`;
        } else if (run.inventaire.includes(annulable.inst)) {
          extra = herosAmeliores(annulable.inst, run.persos)
            .map(
              (perso) =>
                `<button class="primaire petit" data-equiper-achat="${run.persos.indexOf(perso)}">Équiper sur ${echapperHtml(CLASSES[perso.classeId]?.nom ?? perso.classeId)}</button>`,
            )
            .join(``);
        }
      }
      const libelle =
        annulable.type === `lot` && annulable.ventes.length > 1
          ? `Annuler (${annulable.ventes.length} objets)`
          : `Annuler`;
      return `<div class="hdv-snack" role="status">
        <span class="hdv-snack-texte">${texte} · solde ${htmlKamas(run.kamas)}${possible ? `` : ` · <b>plus assez de kamas pour annuler</b>`}</span>
        <span class="hdv-snack-boutons">${extra}<button id="hdv-annuler" class="secondaire petit" ${possible ? `` : `disabled`}>${libelle}</button></span>
      </div>`;
    };
    afficher();
  });
}
