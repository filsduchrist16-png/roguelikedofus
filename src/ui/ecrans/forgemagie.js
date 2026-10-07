import { CLASSES, EQUIPEMENTS } from "../../data/index.js";
import { ECONOMIE, RARETES_INFO } from "../../jeu/config.js";
import { instancierObjet, pvMaxPerso } from "../../jeu/run.js";
import { forgerObjet, prixForge, rareteSuivante } from "../../jeu/economie.js";
import { enregistrerCollection } from "../../sauvegarde/meta.js";
import {
  afficherEcran,
  attrTipObjet,
  barreRetour,
  classeRarete,
  echapperHtml,
  htmlChipsObjet,
  htmlKamas,
  htmlNomObjet,
  imgObjet,
  racine,
} from "../commun.js";
export function ecranForgemagie(e, t) {
  return new Promise((resolve) => {
    let r = ``;
    let i = false;
    let a = () => {
      let o = [
        ...(i
          ? []
          : e.inventaire.map((e) => ({
              inst: e,
              ou: `Inventaire`,
            }))),
        ...e.persos.flatMap((e) =>
          Object.values(e.equipement)
            .filter((e) => !!e)
            .map((t) => ({
              inst: t,
              ou: `Équipé : ${CLASSES[e.classeId].nom}`,
            })),
        ),
      ].filter((e) => rareteSuivante(e.inst));
      let s = o.length
        ? o
            .map(({ inst, ou }, r) => {
              let i = rareteSuivante(inst);
              let a = instancierObjet(inst.id, i);
              let o = prixForge(inst);
              let s = prixForge(inst, true);
              return `<div class="item-carte forge-carte${classeRarete(inst)}"${attrTipObjet(inst.id)}>
              <img src="${imgObjet(inst.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${htmlNomObjet(inst)}<small>${ou} ${htmlChipsObjet(inst)}</small>
                <small class="forge-apercu">→ <span class="inom-${i}">${RARETES_INFO[i].nom}</span> ${htmlChipsObjet(a)}</small>
              </span>
              <span class="forge-boutons">
                <button class="secondaire" data-forge="${r}" ${e.kamas < o ? `disabled` : ``} title="Forge garantie">${htmlKamas(o)}</button>
                <button class="secondaire forge-temeraire" data-temeraire="${r}" ${e.kamas < s ? `disabled` : ``} title="Forgemage téméraire : ${Math.round(ECONOMIE.forgeTemeraire.pEchec * 100)} % d'échec (kamas perdus, objet intact)">🎲 ${htmlKamas(s)}</button>
              </span>
            </div>`;
            })
            .join(``)
        : `<p class="muet">${i ? `Rien à forger parmi les objets équipés.` : `Rien à forger : tout ton équipement à rareté est déjà au maximum.`}</p>`;
      afficherEcran(`
        <h1>Forgemagie</h1>
        <p class="sous-titre">Le Forgemage monte un objet au palier de rareté supérieur, même équipé. Son apprenti téméraire fait moitié prix… mais rate ${Math.round(ECONOMIE.forgeTemeraire.pEchec * 100)} % de ses forges.</p>
        <div class="hdv-solde">${htmlKamas(e.kamas)}</div>
        <div class="forge-filtres"><button id="forge-filtre" class="${i ? `primaire` : `secondaire`}" title="${i ? `Afficher aussi l'inventaire` : `N'afficher que les objets équipés par l'équipe`}">⚔️ Équipés seulement</button></div>
        ${r ? `<p class="forge-message">${r}</p>` : ``}
        <div class="equip-inv forge-liste">${s}</div>
        ${barreRetour(`forge-retour`, `Retour au plateau`)}
      `);
      let c = (n, i) => {
        let s = o[n]?.inst;
        if (!s) {
          return;
        }
        let c = forgerObjet(e, s, i, Math.random);
        if (c === `forge`) {
          // un palier supérieur peut réduire la Vitalité : les PV actuels ne dépassent pas le nouveau max
          for (const perso of e.persos) {
            perso.pvActuels = Math.min(perso.pvActuels, pvMaxPerso(perso));
          }
          r = `✨ ${echapperHtml(EQUIPEMENTS[s.id]?.nom ?? s.id)} forgé en <span class="inom-${s.rarete}">${RARETES_INFO[s.rarete].nom}</span> !`;
          if (t) {
            enregistrerCollection(t, [s]);
          }
        } else if (c === `echec`) {
          r = `💥 La forge téméraire échoue… l'objet est intact, les kamas sont perdus.`;
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
        i = !i;
        a();
      });
      document.getElementById(`forge-retour`)?.addEventListener(`click`, () => resolve());
    };
    a();
  });
}
