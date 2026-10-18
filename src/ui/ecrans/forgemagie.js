import { CLASSES, EQUIPEMENTS } from "../../data/index.js";
import { ECONOMIE, RARETES_INFO } from "../../jeu/config.js";
import { instancierObjet, pvMaxPerso } from "../../jeu/run.js";
import { forgerObjet, prixForge, rareteSuivante } from "../../jeu/economie.js";
import { grouperInventaire, herosAmeliores } from "../../jeu/inventaire.js";
import { enregistrerCollection } from "../../sauvegarde/meta.js";
import { afficherBandeau } from "./succes.js";
import {
  afficherEnGardantScroll,
  attrTipObjet,
  barreRetour,
  brancherSectionsRepliables,
  classeRarete,
  echapperHtml,
  htmlChipsObjet,
  htmlKamas,
  htmlMetaObjet,
  htmlNomObjet,
  htmlSectionRepliable,
  imgObjet,
  libelleDelta,
  racine,
} from "../commun.js";
// « Équipés seulement » : gardé d'une visite à l'autre pendant la session
let equipesSeulement = false;
const ELEMENTS = [`terre`, `feu`, `eau`, `air`];
const moyenneArme = (inst) => {
  const attaque = EQUIPEMENTS[inst.id]?.tiers?.[inst.rarete]?.attaque;
  return attaque ? (attaque.baseMin + attaque.baseMax) / 2 : 0;
};
const kamasTexte = (montant) => `${montant.toLocaleString(`fr-FR`)} k`;
// Ce que la forge change : seulement l'écart avec le palier suivant (stats, PA, résistances, arme).
export function deltasForge(inst, apres) {
  const deltas = [];
  const ajouter = (cle, valeur) => {
    if (valeur) {
      deltas.push({ cle, valeur });
    }
  };
  ajouter(`adaptatif`, (apres.adaptatif ?? 0) - (inst.adaptatif ?? 0));
  const stats = new Set([...Object.keys(inst.stats ?? {}), ...Object.keys(apres.stats ?? {})]);
  for (const stat of stats) {
    ajouter(stat, (apres.stats?.[stat] ?? 0) - (inst.stats?.[stat] ?? 0));
  }
  ajouter(`pa`, (apres.pa ?? 0) - (inst.pa ?? 0));
  for (const el of ELEMENTS) {
    ajouter(
      `res_${el}`,
      Math.round(((apres.resistances?.[el] ?? 0) - (inst.resistances?.[el] ?? 0)) * 100),
    );
  }
  ajouter(`attaque`, moyenneArme(apres) - moyenneArme(inst));
  return deltas;
}
function htmlDeltasForge(deltas) {
  if (!deltas.length) {
    return `<span class="muet">mêmes stats</span>`;
  }
  return deltas
    .map((delta) => {
      const arrondi = Math.round(delta.valeur * 10) / 10;
      const libelle =
        delta.cle === `adaptatif` ? ` aux 2 caracs d'élément ★` : libelleDelta(delta.cle);
      return `<span class="${arrondi > 0 ? `delta-plus` : `delta-moins`}">${arrondi > 0 ? `+` : `−`}${Math.abs(arrondi)}${libelle}</span>`;
    })
    .join(` `);
}
// « ▲ Cra après forge » : les héros pour qui l'objet du sac, une fois forgé, serait une amélioration.
function htmlBadgesApresForge(apercu, persos) {
  const heros = herosAmeliores(apercu, persos);
  return heros.length
    ? `<span class="badges-heros" title="Amélioration nette pour ces héros, une fois l'objet forgé">${heros
        .map(
          (perso) =>
            `<span class="badge-heros">▲ ${echapperHtml(CLASSES[perso.classeId]?.nom ?? perso.classeId)} après forge</span>`,
        )
        .join(``)}</span>`
    : ``;
}
export function ecranForgemagie(run, meta) {
  return new Promise((resolve) => {
    // carte à faire clignoter après une forge : { inst, ok }
    let flash = null;
    let afficher = () => {
      const nomHeros = (perso) => CLASSES[perso.classeId]?.nom ?? perso.classeId;
      // d'abord les pièces portées, par héros ; puis l'inventaire regroupé (« ×N »)
      const sections = run.persos.map((perso) => ({
        cle: `forge-${perso.classeId}`,
        titre: echapperHtml(nomHeros(perso)),
        entrees: Object.values(perso.equipement)
          .filter((objet) => !!objet && rareteSuivante(objet))
          .map((inst) => ({ inst, insts: [inst], porte: true })),
      }));
      const sac = grouperInventaire(run.inventaire)
        .filter((groupe) => rareteSuivante(groupe.inst))
        .map((groupe) => ({
          inst: groupe.inst,
          insts: groupe.indices.map((indice) => run.inventaire[indice]),
          nb: groupe.indices.length,
          porte: false,
        }));
      if (!equipesSeulement) {
        sections.push({
          // l'inventaire (souvent long) est replié d'office : son titre donne le nombre d'objets
          cle: `forge-inventaire`,
          replie: true,
          sac: true,
          titre: `Inventaire (${sac.reduce((somme, groupe) => somme + groupe.nb, 0)})`,
          entrees: sac,
        });
      }
      const entrees = sections.flatMap((section) => section.entrees);
      let index = 0;
      // kamas manquants, écrits dans le bouton (comme à l'HDV) : un title ne s'affiche pas au toucher
      const manque = (prix) =>
        run.kamas < prix
          ? `<span class="hdv-manque">il manque ${htmlKamas(prix - run.kamas)}</span>`
          : ``;
      const htmlEntree = ({ inst, insts, nb, porte }) => {
        const numero = index++;
        const suivante = rareteSuivante(inst);
        const apercu = instancierObjet(inst.id, suivante);
        const prix = prixForge(inst);
        const prixTemeraire = prixForge(inst, true);
        // la carte forgée (ou son groupe « ×N ») clignote après re-rendu
        const classeFlash =
          flash && insts.includes(flash.inst) ? (flash.ok ? ` flash-ok` : ` flash-ko`) : ``;
        return `<div class="item-carte forge-carte${classeRarete(inst)}${classeFlash}" data-carte="${numero}"${attrTipObjet(inst.id)}>
              <img src="${imgObjet(inst.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${htmlNomObjet(inst)}${nb > 1 ? ` <span class="item-qte">×${nb}</span>` : ``}<small><span class="ic-meta">${htmlMetaObjet(inst)}</span> ${htmlChipsObjet(inst)}</small>
                <small class="forge-apercu">→ <span class="inom-${suivante}">${RARETES_INFO[suivante].nom}</span> : ${htmlDeltasForge(deltasForge(inst, apercu))}</small>
                ${porte ? `` : htmlBadgesApresForge(apercu, run.persos)}
              </span>
              <span class="forge-boutons">
                <button class="secondaire" data-forge="${numero}" ${run.kamas < prix ? `disabled` : ``} title="Forge garantie"><small class="forge-lib">Forger · garanti</small>${htmlKamas(prix)}${manque(prix)}</button>
                <button class="secondaire forge-temeraire" data-temeraire="${numero}" ${run.kamas < prixTemeraire ? `disabled` : ``} title="Forgemagie téméraire : ${Math.round(ECONOMIE.forgeTemeraire.pEchec * 100)} % d'échec (kamas perdus, objet intact)"><small class="forge-lib">🎲 Téméraire · ${Math.round(ECONOMIE.forgeTemeraire.pEchec * 100)} % d'échec</small>${htmlKamas(prixTemeraire)}${manque(prixTemeraire)}</button>
              </span>
            </div>`;
      };
      let htmlListe = entrees.length
        ? sections
            .filter((sec) => sec.entrees.length)
            .map((sec) =>
              htmlSectionRepliable(
                sec.cle,
                `<h4 class="forge-section">${sec.titre}${sec.sac ? `` : ` <small>(${sec.entrees.length} à forger)</small>`}</h4>`,
                `<div class="forge-groupe">${sec.entrees.map(htmlEntree).join(``)}</div>`,
                !sec.replie,
              ),
            )
            .join(``)
        : `<p class="muet">${equipesSeulement ? `Rien à forger parmi les objets équipés.` : `Rien à forger : tout ton équipement à rareté est déjà au maximum.`}</p>`;
      afficherEnGardantScroll(`
        <h1>Forgemagie</h1>
        <p class="sous-titre">La Forgemagie monte un objet au palier de rareté supérieur, même équipé. Sa version téméraire fait moitié prix… mais rate ${Math.round(ECONOMIE.forgeTemeraire.pEchec * 100)} % des forges.</p>
        <div class="hdv-solde forge-solde">${htmlKamas(run.kamas)}</div>
        <div class="forge-filtres"><button id="forge-filtre" class="${equipesSeulement ? `primaire` : `secondaire`}" aria-pressed="${equipesSeulement}" title="${equipesSeulement ? `Afficher aussi l'inventaire` : `N'afficher que les objets équipés par l'équipe`}">⚔️ Équipés seulement</button></div>
        <div class="equip-inv forge-liste">${htmlListe}</div>
        ${barreRetour(`forge-retour`, `Retour au plateau`)}
      `);
      if (flash) {
        const carte = racine.querySelector(`.forge-carte.flash-ok, .forge-carte.flash-ko`);
        setTimeout(() => carte?.classList.remove(`flash-ok`, `flash-ko`), 1000);
        flash = null;
      }
      let forger = (numeroCarte, temeraire) => {
        let objet = entrees[numeroCarte]?.inst;
        if (!objet) {
          return;
        }
        const nom = EQUIPEMENTS[objet.id]?.nom ?? objet.id;
        const prix = prixForge(objet, temeraire);
        let issue = forgerObjet(run, objet, temeraire, Math.random);
        if (issue === `forge`) {
          // un palier supérieur peut réduire la Vitalité : les PV actuels ne dépassent pas le nouveau max
          for (const perso of run.persos) {
            perso.pvActuels = Math.min(perso.pvActuels, pvMaxPerso(perso));
          }
          afficherBandeau(
            `✨ ${nom} → ${RARETES_INFO[objet.rarete].nom} (−${kamasTexte(prix)}, reste ${kamasTexte(run.kamas)})`,
          );
          if (meta) {
            enregistrerCollection(meta, [objet]);
          }
          flash = { inst: objet, ok: true };
        } else if (issue === `echec`) {
          afficherBandeau(
            `💥 Forge ratée : −${kamasTexte(prix)}, objet intact (reste ${kamasTexte(run.kamas)})`,
          );
          flash = { inst: objet, ok: false };
        }
        afficher();
      };
      racine
        .querySelectorAll(`[data-forge]`)
        .forEach((bouton) =>
          bouton.addEventListener(`click`, () => forger(Number(bouton.dataset.forge), false)),
        );
      racine
        .querySelectorAll(`[data-temeraire]`)
        .forEach((bouton) =>
          bouton.addEventListener(`click`, () => forger(Number(bouton.dataset.temeraire), true)),
        );
      document.getElementById(`forge-filtre`)?.addEventListener(`click`, () => {
        equipesSeulement = !equipesSeulement;
        afficher();
      });
      document.getElementById(`forge-retour`)?.addEventListener(`click`, () => resolve());
      brancherSectionsRepliables();
    };
    afficher();
  });
}
