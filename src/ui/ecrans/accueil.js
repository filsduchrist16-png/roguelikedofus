import { MONDES } from "../../data/index.js";
import { DIFFICULTES, DIFFICULTE_MAX, reliquesDuMonde } from "../../jeu/config.js";
import { progressionArchisMonde } from "../../jeu/quetes.js";
import {
  ascensionMonde,
  mondeJouable,
  mondePrecedentTermine,
  statsMonde,
} from "../../sauvegarde/meta.js";
import {
  IMG_ABANDONNER,
  IMG_ARMURERIE,
  IMG_BESTIAIRE,
  IMG_DOFUS,
  IMG_ENCYCLOPEDIE,
  IMG_ETOILE,
  IMG_JOUER,
  IMG_LOGO,
  IMG_PARAMETRES,
  IMG_SUCCES,
  afficherEcran,
  demanderConfirmation,
  echapperHtml,
  etoilesDifficulte,
  imgMonde,
  racine,
} from "../commun.js";
import { ecranParametres } from "./parametres.js";
import { ecranEncyclopedie } from "./encyclopedie.js";
import { ecranBestiaire } from "./bestiaire.js";
import { ecranArmurerie } from "./armurerie.js";
import { ecranSucces } from "./succes.js";
import { ecranRegles } from "./regles.js";
import { ecranMentionsLegales } from "./mentions.js";
import { ecranDofus } from "./dofus.js";
import { htmlProchainDofus } from "../prochainDofus.js";
const LIEN_DISCORD = `https://discord.gg/jxfWpRB7Rp`;
export function ecranAccueil(e, onReset, n = null) {
  return new Promise((resolve) => {
    let trancheId = n?.trancheId ?? `t1`;
    let ascension = 0;
    let o = () => {
      let s = ascensionMonde(e, trancheId);
      let c = n
        ? `<button id="btn-reprendre" class="btn-jouer btn-reprendre" title="Reprendre (zone ${n.zoneNum}/${n.nbZones}, ${echapperHtml(n.zoneNom)})"><img src="${IMG_JOUER}" alt="Reprendre" onerror="this.remove()" /></button>
           <button id="btn-abandon" class="btn-jouer btn-abandon" title="Abandonner la run"><img src="${IMG_ABANDONNER}" alt="Abandonner la run" onerror="this.replaceWith(this.alt)" /></button>`
        : `<button id="btn-start" class="btn-jouer" title="Lancer une run"><img src="${IMG_JOUER}" alt="Jouer" onerror="this.remove()" /></button>`;
      let l = (t) => {
        let n = ascensionMonde(e, t);
        let r = n === undefined ? 0 : Math.min(n + 1, DIFFICULTE_MAX);
        let o = t === trancheId;
        return DIFFICULTES.map((e, n) => {
          let i = n > r;
          let s = [`asc-etoile`, o && n <= ascension ? `pleine` : ``, i ? `verrou` : ``]
            .filter(Boolean)
            .join(` `);
          let c = i ? `Gagne une run en ${DIFFICULTES[r].nom} pour débloquer ${e.nom}` : e.nom;
          return `<button class="${s}" ${i ? `disabled` : `data-asc="${n}" data-asc-tranche="${t}"`} title="${echapperHtml(c)}" aria-label="${echapperHtml(e.nom)}">
            <img src="${IMG_ETOILE}" alt="" onerror="this.parentElement.textContent='★'" />
          </button>`;
        }).join(``);
      };
      let u = n
        ? ``
        : `<div class="asc-section">
          <div class="asc-textes">${DIFFICULTES.map(
            (
              e,
              t,
            ) => `<div class="asc-texte${t === ascension ? ` visible` : ``}" data-asc-texte="${t}">
            <p class="asc-nom">${echapperHtml(e.nom)}</p>
            <p class="asc-desc">${echapperHtml(e.desc)}</p>
          </div>`,
          ).join(``)}</div>
          ${s !== undefined && s >= 1 ? `<p class="asc-record">Meilleur palier : ${etoilesDifficulte(s)} ${echapperHtml(DIFFICULTES[s].nom)}</p>` : ``}
        </div>`;
      afficherEcran(
        `
        <div class="coin-gauche">
          <button id="btn-regles" class="btn-regles">Règles</button>
          <a class="btn-discord" href="${LIEN_DISCORD}" target="_blank" rel="noopener noreferrer" title="Rejoindre le Discord du jeu">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M20.32 4.37A19.8 19.8 0 0 0 15.39 2.8a13.7 13.7 0 0 0-.63 1.3 18.4 18.4 0 0 0-5.5 0 13.7 13.7 0 0 0-.64-1.3 19.7 19.7 0 0 0-4.93 1.53C.53 9.05-.32 13.6.1 18.1a19.9 19.9 0 0 0 6.04 3.05 14.6 14.6 0 0 0 1.29-2.1 12.9 12.9 0 0 1-2.04-.97l.5-.39a14.2 14.2 0 0 0 12.2 0l.5.39c-.65.39-1.33.71-2.04.98.37.74.8 1.44 1.29 2.1a19.8 19.8 0 0 0 6.04-3.06c.5-5.2-.84-9.7-3.56-13.73ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.95-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.95-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.94 2.42-2.16 2.42Z"/></svg>
            <span>Discord</span>
          </a>
        </div>
        <div class="coin-menu">
          <button id="btn-dofus" class="coin-param" data-lbl="Dofus" title="Dofus"><img src="${IMG_DOFUS}" alt="Dofus" onerror="this.remove()" /></button>
          <button id="btn-bestiaire" class="coin-param" data-lbl="Bestiaire" title="Bestiaire"><img src="${IMG_BESTIAIRE}" alt="Bestiaire" onerror="this.remove()" /></button>
          <button id="btn-encyclopedie" class="coin-param" data-lbl="Classes" title="Encyclopédie des classes"><img src="${IMG_ENCYCLOPEDIE}" alt="Encyclopédie" onerror="this.parentElement.textContent='📖'" /></button>
          <button id="btn-armurerie" class="coin-param" data-lbl="Armurerie" title="Armurerie"><img src="${IMG_ARMURERIE}" alt="Armurerie" onerror="this.parentElement.textContent='🛡️'" /></button>
          <button id="btn-succes" class="coin-param" data-lbl="Succès" title="Succès"><img src="${IMG_SUCCES}" alt="Succès" onerror="this.remove()" /></button>
          <button id="btn-settings" class="coin-param" data-lbl="Réglages" title="Paramètres"><img src="${IMG_PARAMETRES}" alt="Paramètres" onerror="this.remove()" /></button>
        </div>
        <img class="logo-accueil" src="${IMG_LOGO}" alt="Roguefus Lite" onerror="this.remove()" />
        <div class="mondes-rack">
          ${MONDES.map((t, r) => {
            let a = mondePrecedentTermine(e, t.id);
            let o = mondeJouable(e, t.id);
            let s = [
              `monde-carte`,
              t.id === trancheId ? `active` : ``,
              a ? `` : `locked`,
              a && !o ? `chantier` : ``,
              a && o ? `jouable` : ``,
            ]
              .filter(Boolean)
              .join(` `);
            let c = a
              ? o
                ? n && t.id === n.trancheId
                  ? `Run en cours`
                  : ``
                : `Bientôt`
              : `🔒 Finis le monde ${r}`;
            let u = n
              ? `Run en cours
Zone ${n.zoneNum}/${n.nbZones} : ${n.zoneNom}
Difficulté : ${DIFFICULTES[n.ascension]?.nom ?? `Normal`}`
              : ``;
            let d =
              a && o && !n
                ? `<span class="asc-rangee monde-etoiles" data-rangee="${t.id}">${l(t.id)}</span>`
                : ``;
            let f = statsMonde(e, t.id);
            let [p, m] = progressionArchisMonde(e.archis, t.id);
            let h = reliquesDuMonde(t.id);
            let length = h.filter((t) => e.reliques?.includes(t)).length;
            let _ = t.zones.length
              ? [
                  [`Toile max atteinte`, f.toileMax ? `${f.toileMax}/${t.zones.length}` : `—`],
                  [`Runs réussies`, String(f.victoires)],
                  [`Archimonstres`, m ? `${p}/${m}` : `—`],
                  [`Reliques`, h.length ? `${length}/${h.length}` : `—`],
                ]
              : [
                  [`Toile max atteinte`, `—`],
                  [`Runs réussies`, `—`],
                  [`Archimonstres`, `—`],
                  [`Reliques`, `—`],
                ];
            return `<div class="${s}" ${o && !n ? `data-tranche="${t.id}"` : ``}${t.id === n?.trancheId ? ` data-tip="${echapperHtml(u)}"` : ``}>
              <div class="monde-medaillon">
                <img class="monde-img" src="${imgMonde(r + 1)}" alt="" onerror="this.remove()" />
                ${d}${c ? `<span class="monde-badge">${c}</span>` : ``}
              </div>
              <span class="monde-nom">Monde ${r + 1}</span>
              <span class="monde-niveaux">Niveau ${t.niveaux[0]}${t.niveaux[1] === t.niveaux[0] ? `` : ` - ${t.niveaux[1]}`}</span>
              <span class="monde-stats">${_.map(([e, t]) => `<span>${e} : <b>${t}</b></span>`).join(``)}</span>
            </div>`;
          }).join(``)}
        </div>
        ${htmlProchainDofus(e)}
        ${u}
        <div class="boutons-ecran">
          ${c}
          
        </div>
        <div class="accueil-mentions">
          <p class="mention-ankama">Fangame non officiel. Les illustrations DOFUS appartiennent à Ankama. <button id="btn-disclaimer" class="btn-lien">Mentions légales</button> · Fait avec passion par Cora, Daaye et T.</p>
          <p class="bandeau-credits">🎨 Crédits : illustrations, icônes de sorts et symboles de classe © <b>Ankama Games</b> — DOFUS (<a href="https://www.dofus.com" target="_blank" rel="noopener noreferrer">dofus.com</a>), icônes récupérées via <a href="https://dofusdb.fr" target="_blank" rel="noopener noreferrer">DofusDB</a>.</p>
        </div>
      `,
        `ecran-accueil`,
      );
      document.getElementById(`btn-disclaimer`)?.addEventListener(`click`, async () => {
        await ecranMentionsLegales();
        o();
      });
      document.getElementById(`btn-settings`)?.addEventListener(`click`, async () => {
        await ecranParametres({
          nb: () => e.dofus.length,
          onReset,
        });
        o();
      });
      document.getElementById(`btn-regles`)?.addEventListener(`click`, async () => {
        await ecranRegles();
        o();
      });
      document.getElementById(`btn-succes`)?.addEventListener(`click`, async () => {
        await ecranSucces(e);
        o();
      });
      document.getElementById(`btn-bestiaire`)?.addEventListener(`click`, async () => {
        await ecranBestiaire(e);
        o();
      });
      document.getElementById(`btn-encyclopedie`)?.addEventListener(`click`, async () => {
        await ecranEncyclopedie();
        o();
      });
      document.getElementById(`btn-armurerie`)?.addEventListener(`click`, async () => {
        await ecranArmurerie(e);
        o();
      });
      document
        .querySelector(`.prochain-dofus`)
        ?.addEventListener(`click`, () => document.getElementById(`btn-succes`)?.click());
      document.getElementById(`btn-dofus`)?.addEventListener(`click`, async () => {
        await ecranDofus(e);
        o();
      });
      let d = [...racine.querySelectorAll(`[data-asc-texte]`)];
      let f = (e) => {
        d.forEach((t) => t.classList.toggle(`visible`, Number(t.dataset.ascTexte) === e));
      };
      let p = (e, t) => {
        e.querySelectorAll(`.asc-etoile`).forEach((e, n) => {
          if (!e.disabled) {
            e.classList.toggle(`pleine`, n <= t);
          }
        });
        f(Math.max(0, t));
      };
      racine.querySelectorAll(`[data-rangee]`).forEach((e) => {
        e.querySelectorAll(`.asc-etoile[data-asc]`).forEach((t) => {
          let n = Number(t.dataset.asc);
          t.addEventListener(`click`, (e) => {
            e.stopPropagation();
            trancheId = t.dataset.ascTranche;
            ascension = n;
            o();
          });
          t.addEventListener(`mouseenter`, () => p(e, n));
        });
        e.addEventListener(`mouseleave`, () => {
          p(e, e.dataset.rangee === trancheId ? ascension : -1);
          f(ascension);
        });
      });
      racine.querySelectorAll(`[data-tranche]`).forEach((e) =>
        e.addEventListener(`click`, () => {
          trancheId = e.dataset.tranche;
          ascension = 0;
          o();
        }),
      );
      document.getElementById(`btn-start`)?.addEventListener(`click`, () =>
        resolve({
          action: `nouvelle`,
          ascension,
          trancheId,
        }),
      );
      document.getElementById(`btn-reprendre`)?.addEventListener(`click`, () =>
        resolve({
          action: `reprendre`,
          ascension: 0,
          trancheId: n.trancheId,
        }),
      );
      document.getElementById(`btn-abandon`)?.addEventListener(`click`, async () => {
        if (
          await demanderConfirmation(
            `Abandonner la run en cours ? Elle sera comptée comme perdue.`,
            `Abandonner`,
          )
        ) {
          resolve({
            action: `abandonner`,
            ascension: 0,
            trancheId: n.trancheId,
          });
        }
      });
    };
    o();
  });
}
