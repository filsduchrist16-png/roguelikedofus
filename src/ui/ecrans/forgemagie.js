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
  classeRarete,
  echapperHtml,
  htmlChipsObjet,
  htmlKamas,
  htmlMetaObjet,
  htmlNomObjet,
  imgObjet,
  libelleDelta,
  racine,
} from "../commun.js";
// « Équipés seulement » : gardé d'une visite à l'autre pendant la session
let equipesSeulement = false;
const ELEMENTS = [`terre`, `feu`, `eau`, `air`];
const moyenneArme = (inst) => {
  const a = EQUIPEMENTS[inst.id]?.tiers?.[inst.rarete]?.attaque;
  return a ? (a.baseMin + a.baseMax) / 2 : 0;
};
const kamasTexte = (n) => `${n.toLocaleString(`fr-FR`)} k`;
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
  for (const k of stats) {
    ajouter(k, (apres.stats?.[k] ?? 0) - (inst.stats?.[k] ?? 0));
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
    .map((d) => {
      const v = Math.round(d.valeur * 10) / 10;
      const libelle = d.cle === `adaptatif` ? ` aux 2 caracs d'élément ★` : libelleDelta(d.cle);
      return `<span class="${v > 0 ? `delta-plus` : `delta-moins`}">${v > 0 ? `+` : `−`}${Math.abs(v)}${libelle}</span>`;
    })
    .join(` `);
}
// « ▲ Cra après forge » : les héros pour qui l'objet du sac, une fois forgé, serait une amélioration.
function htmlBadgesApresForge(apercu, persos) {
  const heros = herosAmeliores(apercu, persos);
  return heros.length
    ? `<span class="badges-heros" title="Amélioration nette pour ces héros, une fois l'objet forgé">${heros
        .map(
          (p) =>
            `<span class="badge-heros">▲ ${echapperHtml(CLASSES[p.classeId]?.nom ?? p.classeId)} après forge</span>`,
        )
        .join(``)}</span>`
    : ``;
}
export function ecranForgemagie(e, t) {
  return new Promise((resolve) => {
    // carte à faire clignoter après une forge : { inst, ok }
    let flash = null;
    let a = () => {
      const nomHeros = (p) => CLASSES[p.classeId]?.nom ?? p.classeId;
      // d'abord les pièces portées, par héros ; puis l'inventaire regroupé (« ×N »)
      const sections = e.persos.map((p) => ({
        titre: echapperHtml(nomHeros(p)),
        entrees: Object.values(p.equipement)
          .filter((x) => !!x && rareteSuivante(x))
          .map((inst) => ({ inst, insts: [inst], porte: true })),
      }));
      const sac = grouperInventaire(e.inventaire)
        .filter((g) => rareteSuivante(g.inst))
        .map((g) => ({
          inst: g.inst,
          insts: g.indices.map((i) => e.inventaire[i]),
          nb: g.indices.length,
          porte: false,
        }));
      if (!equipesSeulement) {
        sections.push({
          titre: `Inventaire (${sac.reduce((x, g) => x + g.nb, 0)})`,
          entrees: sac,
        });
      }
      const o = sections.flatMap((s) => s.entrees);
      let index = 0;
      const htmlEntree = ({ inst, insts, nb, porte }) => {
        const r = index++;
        const suivante = rareteSuivante(inst);
        const apercu = instancierObjet(inst.id, suivante);
        const prix = prixForge(inst);
        const prixTemeraire = prixForge(inst, true);
        // la carte forgée (ou son groupe « ×N ») clignote après re-rendu
        const classeFlash =
          flash && insts.includes(flash.inst) ? (flash.ok ? ` flash-ok` : ` flash-ko`) : ``;
        return `<div class="item-carte forge-carte${classeRarete(inst)}${classeFlash}" data-carte="${r}"${attrTipObjet(inst.id)}>
              <img src="${imgObjet(inst.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${htmlNomObjet(inst)}${nb > 1 ? ` <span class="item-qte">×${nb}</span>` : ``}<small><span class="ic-meta">${htmlMetaObjet(inst)}</span> ${htmlChipsObjet(inst)}</small>
                <small class="forge-apercu">→ <span class="inom-${suivante}">${RARETES_INFO[suivante].nom}</span> : ${htmlDeltasForge(deltasForge(inst, apercu))}</small>
                ${porte ? `` : htmlBadgesApresForge(apercu, e.persos)}
              </span>
              <span class="forge-boutons">
                <button class="secondaire" data-forge="${r}" ${e.kamas < prix ? `disabled` : ``} title="Forge garantie${e.kamas < prix ? ` : il manque ${kamasTexte(prix - e.kamas)}` : ``}"><small class="forge-lib">Forger · garanti</small>${htmlKamas(prix)}</button>
                <button class="secondaire forge-temeraire" data-temeraire="${r}" ${e.kamas < prixTemeraire ? `disabled` : ``} title="Forgemage téméraire : ${Math.round(ECONOMIE.forgeTemeraire.pEchec * 100)} % d'échec (kamas perdus, objet intact)${e.kamas < prixTemeraire ? ` · il manque ${kamasTexte(prixTemeraire - e.kamas)}` : ``}"><small class="forge-lib">🎲 Téméraire · ${Math.round(ECONOMIE.forgeTemeraire.pEchec * 100)} % d'échec</small>${htmlKamas(prixTemeraire)}</button>
              </span>
            </div>`;
      };
      let s = o.length
        ? sections
            .filter((sec) => sec.entrees.length)
            .map(
              (sec) =>
                `<h4 class="forge-section">${sec.titre}</h4>${sec.entrees.map(htmlEntree).join(``)}`,
            )
            .join(``)
        : `<p class="muet">${equipesSeulement ? `Rien à forger parmi les objets équipés.` : `Rien à forger : tout ton équipement à rareté est déjà au maximum.`}</p>`;
      afficherEnGardantScroll(`
        <h1>Forgemagie</h1>
        <p class="sous-titre">Le Forgemage monte un objet au palier de rareté supérieur, même équipé. Son apprenti téméraire fait moitié prix… mais rate ${Math.round(ECONOMIE.forgeTemeraire.pEchec * 100)} % de ses forges.</p>
        <div class="hdv-solde forge-solde">${htmlKamas(e.kamas)}</div>
        <div class="forge-filtres"><button id="forge-filtre" class="${equipesSeulement ? `primaire` : `secondaire`}" aria-pressed="${equipesSeulement}" title="${equipesSeulement ? `Afficher aussi l'inventaire` : `N'afficher que les objets équipés par l'équipe`}">⚔️ Équipés seulement</button></div>
        <div class="equip-inv forge-liste">${s}</div>
        ${barreRetour(`forge-retour`, `Retour au plateau`)}
      `);
      if (flash) {
        const carte = racine.querySelector(`.forge-carte.flash-ok, .forge-carte.flash-ko`);
        setTimeout(() => carte?.classList.remove(`flash-ok`, `flash-ko`), 1000);
        flash = null;
      }
      let c = (n, temeraire) => {
        let s = o[n]?.inst;
        if (!s) {
          return;
        }
        const nom = EQUIPEMENTS[s.id]?.nom ?? s.id;
        const prix = prixForge(s, temeraire);
        let c = forgerObjet(e, s, temeraire, Math.random);
        if (c === `forge`) {
          // un palier supérieur peut réduire la Vitalité : les PV actuels ne dépassent pas le nouveau max
          for (const perso of e.persos) {
            perso.pvActuels = Math.min(perso.pvActuels, pvMaxPerso(perso));
          }
          afficherBandeau(
            `✨ ${nom} → ${RARETES_INFO[s.rarete].nom} (−${kamasTexte(prix)}, reste ${kamasTexte(e.kamas)})`,
          );
          if (t) {
            enregistrerCollection(t, [s]);
          }
          flash = { inst: s, ok: true };
        } else if (c === `echec`) {
          afficherBandeau(
            `💥 Forge ratée : −${kamasTexte(prix)}, objet intact (reste ${kamasTexte(e.kamas)})`,
          );
          flash = { inst: s, ok: false };
        }
        a();
      };
      racine
        .querySelectorAll(`[data-forge]`)
        .forEach((e) => e.addEventListener(`click`, () => c(Number(e.dataset.forge), false)));
      racine
        .querySelectorAll(`[data-temeraire]`)
        .forEach((e) => e.addEventListener(`click`, () => c(Number(e.dataset.temeraire), true)));
      document.getElementById(`forge-filtre`)?.addEventListener(`click`, () => {
        equipesSeulement = !equipesSeulement;
        a();
      });
      document.getElementById(`forge-retour`)?.addEventListener(`click`, () => resolve());
    };
    a();
  });
}
