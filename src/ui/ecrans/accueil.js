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
  ecranTactile,
  etoilesDifficulte,
  imgMonde,
  parametres,
  racine,
} from "../commun.js";
import { ecranParametres } from "./parametres.js";
import { ecranEncyclopedie } from "./encyclopedie.js";
import { ecranBestiaire } from "./bestiaire.js";
import { ecranArmurerie } from "./armurerie.js";
import { afficherBandeau, ecranSucces } from "./succes.js";
import { ecranRegles } from "./regles.js";
import { ecranMentionsLegales } from "./mentions.js";
import { ecranDofus } from "./dofus.js";
import { htmlProchainDofus } from "../prochainDofus.js";
import {
  envoyerNuage,
  nuagePlusRecent,
  raisonEchecNuage,
  recupererNuage,
} from "../../sauvegarde/nuage.js";
import { resumePartieLocale, texteResume } from "../../sauvegarde/export.js";
import { dateLisible } from "./parametres.js";
const LIEN_DISCORD = `https://discord.gg/jxfWpRB7Rp`;
const numeroMonde = (id) => MONDES.findIndex((m) => m.id === id) + 1;
// Plus haute difficulté ouverte dans ce monde (une run gagnée débloque la suivante).
function palierDebloque(meta, trancheId) {
  const a = ascensionMonde(meta, trancheId);
  return a === undefined ? 0 : Math.min(a + 1, DIFFICULTE_MAX);
}
const mondeOuvert = (meta, id) =>
  MONDES.some((m) => m.id === id) && mondePrecedentTermine(meta, id) && mondeJouable(meta, id);
// Ce qu'il faut faire pour débloquer la difficulté n dans ce monde (palier : plus haute ouverte).
// Une victoire n'ouvre que le palier suivant : au-delà, on rappelle par où commencer.
export function conditionVerrou(trancheId, palier, n) {
  const monde = `Monde ${numeroMonde(trancheId)}`;
  if (n <= palier + 1) {
    return `🔒 Gagne une run du ${monde} en ${DIFFICULTES[n - 1].nom} pour débloquer ${DIFFICULTES[n].nom}.`;
  }
  return `🔒 Gagne une run du ${monde} en ${DIFFICULTES[n - 1].nom} pour débloquer ${DIFFICULTES[n].nom}. Les paliers s'ouvrent un à un : commence par gagner en ${DIFFICULTES[palier].nom}.`;
}
export function ecranAccueil(e, onReset, n = null) {
  return new Promise((resolve) => {
    // dernier départ retenu (monde et difficulté), s'il est encore possible
    const depart = parametres.dernierDepart;
    let trancheId =
      n?.trancheId ??
      (depart?.trancheId && mondeOuvert(e, depart.trancheId) ? depart.trancheId : `t1`);
    let ascension = n
      ? 0
      : Math.max(0, Math.min(Math.trunc(depart?.ascension) || 0, palierDebloque(e, trancheId)));
    // élément à refocaliser après un nouveau rendu (navigation au clavier)
    let focusApres = null;
    let o = () => {
      let s = ascensionMonde(e, trancheId);
      let diff = DIFFICULTES[ascension] ?? DIFFICULTES[0];
      let recap = n
        ? `Reprendre · Zone ${n.zoneNum}/${n.nbZones} : ${n.zoneNom}`
        : `Monde ${numeroMonde(trancheId)} · ${`★`.repeat(ascension + 1)} ${diff.nom}`;
      let c = n
        ? `<button id="btn-reprendre" class="btn-jouer btn-reprendre" aria-label="${echapperHtml(recap)}"><img src="${IMG_JOUER}" alt="Reprendre" onerror="this.remove()" /></button>
           <button id="btn-abandon" class="btn-jouer btn-abandon" title="Abandonner la run"><img src="${IMG_ABANDONNER}" alt="Abandonner la run" onerror="this.replaceWith(this.alt)" /></button>`
        : `<button id="btn-start" class="btn-jouer" aria-label="${echapperHtml(`Jouer : ${recap}`)}"><img src="${IMG_JOUER}" alt="Jouer" onerror="this.remove()" /></button>`;
      c += `<p class="jouer-recap${diff.effets.mortDefinitive && !n ? ` mort-definitive` : ``}">${echapperHtml(recap)}</p>`;
      let l = (t) => {
        let r = palierDebloque(e, t);
        let o = t === trancheId;
        return DIFFICULTES.map((e, n) => {
          let i = n > r;
          let s = [`asc-etoile`, o && n <= ascension ? `pleine` : ``, i ? `verrou` : ``]
            .filter(Boolean)
            .join(` `);
          return `<button class="${s}" ${i ? `aria-disabled="true" data-verrou="${n}" data-palier="${r}"` : `data-asc="${n}"`} data-asc-tranche="${t}" aria-label="${echapperHtml(i ? `${e.nom} (verrouillé)` : e.nom)}"${o && n === ascension ? ` aria-pressed="true"` : ``}>
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
            <p class="asc-desc" data-desc="${echapperHtml(e.desc)}">${echapperHtml(e.desc)}</p>
          </div>`,
          ).join(``)}</div>
          ${s !== undefined && s >= 1 ? `<p class="asc-record">Meilleur palier : ${etoilesDifficulte(s)} ${echapperHtml(DIFFICULTES[s].nom)}</p>` : ``}
        </div>`;
      afficherEcran(
        `
        <div class="coin-gauche">
          <h1 class="sr-only">Roguefus Lite</h1>
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
          <button id="btn-settings" class="coin-param" data-lbl="Paramètres" title="Paramètres"><img src="${IMG_PARAMETRES}" alt="Paramètres" onerror="this.remove()" /></button>
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
                  [`Zone max atteinte`, f.toileMax ? `${f.toileMax}/${t.zones.length}` : `—`],
                  [`Runs réussies`, String(f.victoires)],
                  [`Archimonstres`, m ? `${p}/${m}` : `—`],
                  [`Reliques`, h.length ? `${length}/${h.length}` : `—`],
                ]
              : [
                  [`Zone max atteinte`, `—`],
                  [`Runs réussies`, `—`],
                  [`Archimonstres`, `—`],
                  [`Reliques`, `—`],
                ];
            let choisissable = o && !n;
            return `<div class="${s}" ${choisissable ? `data-tranche="${t.id}" role="button" tabindex="0" aria-pressed="${t.id === trancheId}"` : ``}${t.id === n?.trancheId ? ` data-tip="${echapperHtml(u)}"` : ``}>
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
        ${u}
        ${htmlProchainDofus(e)}
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
      // l'encart « Dofus à portée » ouvre les Succès sur le Dofus touché
      document.querySelector(`.prochain-dofus`)?.addEventListener(`click`, async (ev) => {
        // au toucher, une quête ouvre son indice (« où la faire ») au lieu de quitter l'écran
        if (ecranTactile() && ev.target.closest(`.pd-quetes li[data-tip]`)) {
          return;
        }
        const id = ev.target.closest(`[data-dofus]`)?.dataset.dofus;
        await ecranSucces(e, id ? `d:${id}` : undefined);
        o();
      });
      // une partie plus récente envoyée depuis l'autre appareil (sauvegarde en ligne)
      nuagePlusRecent()
        .then((info) => {
          const ecran = document.querySelector(`.ecran-accueil`);
          if (!info || !ecran || ecran.querySelector(`.nuage-bandeau`)) {
            return;
          }
          const div = document.createElement(`div`);
          div.className = `nuage-bandeau`;
          div.innerHTML = htmlBandeauNuage(info);
          ecran.prepend(div);
          brancherBandeauNuage(div, info);
        })
        .catch(() => {});
      document.getElementById(`btn-dofus`)?.addEventListener(`click`, async () => {
        await ecranDofus(e);
        o();
      });
      let d = [...racine.querySelectorAll(`[data-asc-texte]`)];
      // texte de difficulté affiché ; condition : message de déblocage à la place de la description
      let f = (e, condition = null) => {
        d.forEach((t) => {
          let visible = Number(t.dataset.ascTexte) === e;
          t.classList.toggle(`visible`, visible);
          let desc = t.querySelector(`.asc-desc`);
          if (desc) {
            desc.textContent = visible && condition ? condition : desc.dataset.desc;
            desc.classList.toggle(`asc-condition`, visible && !!condition);
          }
        });
      };
      // message de déblocage affiché : seul un autre survol ou clic l'efface (pas le mouseleave)
      let conditionAffichee = false;
      // pendant le défilement qui suit le clic, un survol « subi » ne doit pas l'effacer
      let conditionDepuis = 0;
      let p = (e, t, texte = true) => {
        e.querySelectorAll(`.asc-etoile`).forEach((e, n) => {
          if (!e.classList.contains(`verrou`)) {
            e.classList.toggle(`pleine`, n <= t);
          }
        });
        if (texte) {
          f(Math.max(0, t));
        }
      };
      // fait remonter la section au-dessus de la barre « Jouer » collante
      let montrerSection = () => {
        let section = racine.querySelector(`.asc-section`);
        if (!section) {
          return;
        }
        let barre = racine.querySelector(`.ecran-accueil > .boutons-ecran`);
        let bas = barre ? barre.getBoundingClientRect().top : window.innerHeight;
        bas = Math.min(bas, window.innerHeight) - 8;
        let r = section.getBoundingClientRect();
        let delta = r.bottom > bas ? r.bottom - bas : r.top < 0 ? r.top - 8 : 0;
        if (delta) {
          window.scrollBy({ top: delta, behavior: `smooth` });
        }
      };
      racine.querySelectorAll(`[data-rangee]`).forEach((e) => {
        e.querySelectorAll(`.asc-etoile[data-asc]`).forEach((t) => {
          let n = Number(t.dataset.asc);
          t.addEventListener(`click`, (e) => {
            e.stopPropagation();
            trancheId = t.dataset.ascTranche;
            ascension = n;
            focusApres = `.asc-etoile[data-asc="${n}"][data-asc-tranche="${trancheId}"]`;
            o();
          });
          t.addEventListener(`mouseenter`, () => {
            if (ecranTactile() || performance.now() - conditionDepuis < 900) {
              return;
            }
            conditionAffichee = false;
            p(e, n);
          });
        });
        // étoile verrouillée : dire comment la débloquer plutôt que ne rien faire
        e.querySelectorAll(`.asc-etoile[data-verrou]`).forEach((t) => {
          t.addEventListener(`click`, (ev) => {
            ev.stopPropagation();
            let n = Number(t.dataset.verrou);
            f(n, conditionVerrou(t.dataset.ascTranche, Number(t.dataset.palier), n));
            conditionAffichee = true;
            conditionDepuis = performance.now();
            montrerSection();
          });
        });
        // survol à la souris seulement : au toucher, le défilement ne doit pas effacer le message
        e.addEventListener(`mouseleave`, () => {
          if (ecranTactile()) {
            return;
          }
          p(e, e.dataset.rangee === trancheId ? ascension : -1, false);
          if (!conditionAffichee) {
            f(ascension);
          }
        });
      });
      racine.querySelectorAll(`[data-tranche]`).forEach((e) => {
        e.addEventListener(`click`, () => {
          // un appui à côté d'une étoile sur le monde déjà choisi ne remet pas la difficulté à zéro
          if (e.dataset.tranche !== trancheId) {
            trancheId = e.dataset.tranche;
            ascension = 0;
          }
          focusApres = document.activeElement === e ? `[data-tranche="${trancheId}"]` : null;
          o();
        });
        e.addEventListener(`keydown`, (ev) => {
          if ((ev.key === `Enter` || ev.key === ` `) && ev.target === e) {
            ev.preventDefault();
            e.click();
          }
        });
      });
      if (focusApres) {
        racine.querySelector(focusApres)?.focus({ preventScroll: true });
        focusApres = null;
      }
      document.getElementById(`btn-start`)?.addEventListener(`click`, async () => {
        if (
          DIFFICULTES[ascension]?.effets.mortDefinitive &&
          !(await demanderConfirmation(
            `Mort définitive : un héros tombé est perdu pour la run. Lancer ?`,
            `Lancer`,
          ))
        ) {
          return;
        }
        resolve({
          action: `nouvelle`,
          ascension,
          trancheId,
        });
      });
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

// Bandeau « partie plus récente en ligne » : ce que contient chaque partie, et confirmation avant
// de remplacer l'une par l'autre.
function htmlBandeauNuage(info) {
  let ici = ``;
  try {
    ici = texteResume(resumePartieLocale());
  } catch {}
  const enLigne = info.resume ? texteResume(info.resume) : `contenu inconnu (ancien envoi)`;
  return `<span>☁️ Une partie plus récente est en ligne (envoyée depuis ${echapperHtml(info.appareil ?? `un autre appareil`)} le ${echapperHtml(dateLisible(info.date))}).
      <small class="nuage-compare"><span>Ici : <b>${echapperHtml(ici || `—`)}</b></span><span>En ligne : <b>${echapperHtml(enLigne)}</b></span></small>
      <small class="nuage-pause">Synchro auto en pause en attendant ton choix.</small></span>
    <span class="setting-actions"><button class="primaire" data-nuage="recuperer">Récupérer</button><button class="secondaire" data-nuage="garder">Garder celle d'ici</button></span>`;
}
function brancherBandeauNuage(div, info) {
  const enLigne = info.resume ? texteResume(info.resume) : `partie en ligne`;
  div.querySelector(`[data-nuage="recuperer"]`).addEventListener(`click`, async (ev) => {
    const b = ev.currentTarget;
    if (
      !(await demanderConfirmation(
        `Récupérer la partie en ligne (${enLigne}) ? Elle remplacera celle d'ici, qui reste récupérable dans Paramètres (« Annuler le dernier import »).`,
        `Récupérer`,
      ))
    ) {
      return;
    }
    b.disabled = true;
    // recupererNuage garde une copie de secours de la partie d'ici avant d'écrire
    if (await recupererNuage().catch(() => false)) {
      location.reload();
    } else {
      b.disabled = false;
      div.firstElementChild.textContent = `Récupération impossible : ${raisonEchecNuage() || `erreur inconnue`}. Réessaie dans un moment.`;
    }
  });
  div.querySelector(`[data-nuage="garder"]`).addEventListener(`click`, async (ev) => {
    const b = ev.currentTarget;
    if (
      !(await demanderConfirmation(
        `Garder la partie d'ici ? Elle sera envoyée en ligne et remplacera celle de l'autre appareil (${enLigne}).`,
        `Garder celle d'ici`,
      ))
    ) {
      return;
    }
    b.disabled = true;
    try {
      await envoyerNuage();
      div.remove();
    } catch {
      // le bandeau reste : le joueur peut réessayer
      b.disabled = false;
      afficherBandeau(
        `✗ Envoi impossible pour l'instant : ta partie n'est pas partie en ligne. Réessaie dans un moment.`,
      );
    }
  });
}
