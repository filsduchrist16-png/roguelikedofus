import { DOFUS, SUCCES } from "../../data/index.js";
import {
  contexteMeta,
  dofusDeSucces,
  etatQuete,
  nouvelEtatQuetes,
  progressionSucces,
  trouverQuete,
} from "../../jeu/quetes.js";
import { decrireQuete, mondeDuDofus } from "../../jeu/obtention.js";
import {
  comportementDefilement,
  afficherEcran,
  barreContinuer,
  barreRetour,
  cheminAsset,
  echapperHtml,
  parametres,
} from "../commun.js";
import {
  CLES_TUTO,
  normaliserVuTuto,
  sauverParametres,
  tutoVu,
} from "../../sauvegarde/parametres.js";
import { dofusAPortee } from "../prochainDofus.js";
const ECRAN_ETROIT = `(max-width: 900px)`;
function succesParDofus() {
  let e = new Map();
  for (let [t, n] of Object.entries(SUCCES)) {
    let r = dofusDeSucces(n);
    if (r) {
      e.set(r, t);
    }
  }
  return e;
}
// Succès sans Dofus, regroupés par rubrique (Général, puis les donjons de chaque monde).
function rubriques(ids) {
  const groupes = new Map();
  for (const id of ids) {
    const titre = SUCCES[id].categorie?.rubrique ?? `Général`;
    groupes.set(titre, [...(groupes.get(titre) ?? []), id]);
  }
  return [...groupes].sort(([a], [b]) =>
    a === `Général` ? -1 : b === `Général` ? 1 : a.localeCompare(b),
  );
}
// selection (facultatif) : « d:<id du Dofus> » ou « g:<id du succès> » à ouvrir directement.
export function ecranSucces(e, selection) {
  const e_meta = e;
  return new Promise((resolve) => {
    let n = e.quetes ?? nouvelEtatQuetes();
    let r = contexteMeta(e);
    let i = succesParDofus();
    let a = Object.keys(DOFUS);
    let o = [...a.filter((e) => i.has(e)), ...a.filter((e) => !i.has(e))];
    let s = Object.keys(SUCCES)
      .filter((e) => dofusDeSucces(SUCCES[e]) === undefined)
      .sort();
    let c = (t) => e.dofus.some((e) => e.id === t);
    let l = Object.values(SUCCES).reduce((acc, item) => acc + item.quetes.length, 0);
    let u = [...i.values()];
    let length = u.filter((e) => progressionSucces(n, SUCCES[e]).complet).length;
    // par défaut, le Dofus non obtenu le plus avancé
    let valide = (sel) =>
      typeof sel === `string` &&
      ((sel.startsWith(`d:`) && DOFUS[sel.slice(2)]) ||
        (sel.startsWith(`g:`) && SUCCES[sel.slice(2)]));
    let vise = dofusAPortee(e)[0];
    let f = valide(selection)
      ? selection
      : vise
        ? `d:${vise.id}`
        : o.length
          ? `d:${o[0]}`
          : `g:${s[0]}`;
    let p = (faites, total) => {
      let n = total ? Math.round((faites / total) * 100) : 0;
      return `<span class="succes-barre"><span class="${n >= 100 ? `pleine` : ``}" style="width:${n}%"></span></span>`;
    };
    let m = (e) => {
      let t = i.get(e);
      let r = t ? progressionSucces(n, SUCCES[t]) : undefined;
      let a = [
        `succes-carte`,
        f === `d:${e}` ? `actif` : ``,
        r ? `` : `a-venir`,
        r?.complet ? `complet` : ``,
      ]
        .filter(Boolean)
        .join(` `);
      let img = DOFUS[e].img;
      return `<button class="${a}" data-sel="d:${e}" aria-pressed="${f === `d:${e}`}">
        <span class="succes-halo">${img ? `<img src="${cheminAsset(img)}" alt="" onerror="this.remove()" />` : ``}</span>
        <span class="succes-carte-nom">${echapperHtml(DOFUS[e].nom)}</span>
        ${r ? p(r.faites, r.total) : ``}
        <span class="succes-carte-progres">${c(e) ? `✓ Obtenu` : r ? (r.complet ? `⏳ En attente` : `${r.faites} / ${r.total} quêtes`) : `Bientôt`}</span>
        ${mondeDuDofus(e) ? `<span class="succes-carte-monde">${echapperHtml(mondeDuDofus(e).nom)} · niv. ${DOFUS[e].niveau}</span>` : ``}
      </button>`;
    };
    let h = (e) => {
      let t = progressionSucces(n, SUCCES[e]);
      return `<button class="${[
        `succes-carte-general`,
        f === `g:${e}` ? `actif` : ``,
        t.complet ? `complet` : ``,
      ]
        .filter(Boolean)
        .join(` `)}" data-sel="g:${e}" aria-pressed="${f === `g:${e}`}">
        <span class="succes-general-tete"><span>${echapperHtml(SUCCES[e].nom)}</span><b>${t.complet ? `✓` : `${t.faites}/${t.total}`}</b></span>
        ${p(t.faites, t.total)}
      </button>`;
    };
    let _ = (e) =>
      `<ul class="quete-liste">${e.quetes
        .map((e) => {
          let t = etatQuete(n, e, r);
          let i = t.compteur
            ? `<span class="quete-compteur">${t.compteur[0]}/${t.compteur[1]}</span>`
            : ``;
          const d = decrireQuete(e);
          const aide = t.faite
            ? ``
            : `<span class="quete-aide">${d.lignes.map(([etiq, texte]) => `<span class="quete-ligne-aide"><b>${echapperHtml(etiq)}</b> ${echapperHtml(texte)}</span>`).join(``)}</span>`;
          return `<li class="quete-ligne${t.faite ? ` faite` : ``}">
        <span class="quete-coche" aria-hidden="true">${t.faite ? `✓` : ``}</span><span class="sr-only">${t.faite ? `Quête faite : ` : `Quête à faire : `}</span>
        <span class="quete-nom"><span class="quete-titre">${echapperHtml(d.titre)}</span>${d.lore ? `<em class="quete-lore">« ${echapperHtml(d.lore)} »</em>` : ``}${aide}</span>${i}
      </li>`;
        })
        .join(``)}</ul>`;
    let v = () => {
      if (f.startsWith(`d:`)) {
        let e = f.slice(2);
        let t = DOFUS[e];
        let r = i.get(e);
        let a = r ? SUCCES[r] : undefined;
        let o = `<div class="succes-panneau-tete">
          ${t.img ? `<img class="${a ? `` : `a-venir`}" src="${cheminAsset(t.img)}" alt="" onerror="this.remove()" />` : ``}
          <div><h2>${echapperHtml(t.nom)}</h2><p class="succes-effet">${echapperHtml(t.desc)}</p>
          ${mondeDuDofus(e) ? `<p class="succes-niveau">Niveau ${t.niveau} dans Dofus · s'obtient dans le ${echapperHtml(mondeDuDofus(e).nom)}${a ? ` · succès « ${echapperHtml(a.nom)} »` : ``}</p>` : ``}</div>
        </div>`;
        if (!a) {
          return `${o}<p class="succes-a-venir">Ce Dofus n'a pas encore de groupe de quêtes.</p>`;
        }
        let s = progressionSucces(n, a);
        let prerequis = ``;
        return `${o}${c(e) ? `<span class="succes-statut obtenu">Dofus obtenu</span>` : `<span class="succes-statut">${s.faites} / ${s.total} quêtes pour l'obtenir</span>`}${prerequis}${_(a)}`;
      }
      let e = SUCCES[f.slice(2)];
      let t = progressionSucces(n, e);
      return `<div class="succes-panneau-tete"><div><h2>${echapperHtml(e.nom)}</h2></div></div>
        <span class="succes-statut">${t.faites} / ${t.total} quêtes · sans récompense</span>
        ${_(e)}`;
    };
    let ee = () => {
      afficherEcran(`
        <h1>Succès</h1>
        <p class="sous-titre">${n.faites.filter((e) => trouverQuete(e)).length} / ${l} quêtes · ${length} / ${u.length} Dofus</p>
        <div class="succes-vue">
          <div class="succes-galerie">
            <div class="succes-cartes">${o.map(m).join(``)}</div>
            ${rubriques(s)
              .map(
                ([titre, ids]) => `<h2 class="succes-rubrique">${echapperHtml(titre)}</h2>
            <div class="succes-generaux">${ids.map(h).join(``)}</div>`,
              )
              .join(``)}
          </div>
          <aside class="succes-panneau"><button type="button" class="succes-vers-liste secondaire">↑ Liste</button>${v()}</aside>
        </div>
        ${barreRetour(`succes-retour`)}
      `);
      document.querySelectorAll(`[data-sel]`).forEach((e) =>
        e.addEventListener(`click`, () => {
          let t = document.querySelector(`.succes-galerie`)?.scrollTop ?? 0;
          f = e.dataset.sel;
          ee();
          let n = document.querySelector(`.succes-galerie`);
          if (n) {
            n.scrollTop = t;
          }
          // Sur téléphone, le détail est sous la galerie : on l'amène à l'écran.
          if (window.matchMedia(ECRAN_ETROIT).matches) {
            document
              .querySelector(`.succes-panneau`)
              ?.scrollIntoView({ behavior: comportementDefilement(), block: `start` });
          }
        }),
      );
      // téléphone : retour à la carte active dans la liste
      document.querySelector(`.succes-vers-liste`)?.addEventListener(`click`, () => {
        const carte = document.querySelector(`.succes-galerie .actif`);
        carte?.scrollIntoView({ behavior: comportementDefilement(), block: `center` });
        carte?.focus({ preventScroll: true });
      });
      document.getElementById(`succes-retour`)?.addEventListener(`click`, () => resolve());
    };
    ee();
    // la carte active est visible dans la galerie (PC : la galerie défile seule) ; sur téléphone,
    // un Dofus demandé depuis l'accueil ouvre directement son détail
    const galerie = document.querySelector(`.succes-galerie`);
    const carte = galerie?.querySelector(`.actif`);
    if (window.matchMedia(ECRAN_ETROIT).matches) {
      if (valide(selection)) {
        document.querySelector(`.succes-panneau`)?.scrollIntoView({ block: `start` });
      }
    } else if (galerie && carte) {
      const g = galerie.getBoundingClientRect();
      const c = carte.getBoundingClientRect();
      if (c.top < g.top || c.bottom > g.bottom) {
        galerie.scrollTop += c.top - g.top - (g.height - c.height) / 2;
      }
    }
  });
}
export function ecranSuccesObtenu(e, t, meta) {
  return new Promise((resolve) => {
    let r = dofusDeSucces(e);
    let i = r && t ? DOFUS[r]?.nom : undefined;
    let texte = i ? `Tu obtiens le ${echapperHtml(i)}.` : `Toutes ses quêtes sont accomplies.`;
    afficherEcran(`
      <h1>🏆 Succès : ${echapperHtml(e.nom)}</h1>
      ${i ? `<img class="succes-dofus-img" src="${cheminAsset(DOFUS[r].img)}" alt="" onerror="this.remove()" />` : ``}
      <p class="sous-titre">${texte}</p>
      ${barreContinuer(`succes-ok`)}
    `);
    document.getElementById(`succes-ok`)?.addEventListener(`click`, () => resolve());
  });
}
// Un Dofus dont le succès était déjà terminé arrive (ancienne sauvegarde).
export function ecranDofusDebloque(id) {
  return new Promise((resolve) => {
    afficherEcran(`
      <h1>🥚 ${echapperHtml(DOFUS[id].nom)}</h1>
      <img class="succes-dofus-img" src="${cheminAsset(DOFUS[id].img)}" alt="" onerror="this.remove()" />
      <p class="sous-titre">Son succès est terminé : le ${echapperHtml(DOFUS[id].nom)} rejoint ta collection. ${echapperHtml(DOFUS[id].desc)}</p>
      ${barreContinuer(`succes-ok`)}
    `);
    document.getElementById(`succes-ok`)?.addEventListener(`click`, () => resolve());
  });
}
// Durée d'affichage d'un bandeau (ms) : doublée quand le texte dépasse 60 caractères.
export const dureeBandeau = (texte) => (String(texte ?? ``).length > 60 ? 8000 : 4000);
// Bandeau temporaire (quête accomplie, défi…) : 3 au plus à l'écran, les plus anciens partent.
// Le survol (ou le toucher maintenu) met le décompte en pause.
export function afficherBandeau(texte) {
  let t = document.getElementById(`bandeaux-quete`);
  if (!t) {
    t = document.createElement(`div`);
    t.id = `bandeaux-quete`;
    t.setAttribute(`role`, `status`);
    document.body.appendChild(t);
  }
  let n = document.createElement(`div`);
  n.className = `bandeau-quete`;
  n.textContent = texte;
  t.appendChild(n);
  while (t.children.length > 3) {
    t.firstElementChild.remove();
  }
  let reste = dureeBandeau(texte);
  let debut = 0;
  let minuteur = null;
  const lancer = () => {
    debut = Date.now();
    minuteur = setTimeout(
      () => {
        n.classList.add(`sortie`);
        minuteur = setTimeout(() => n.remove(), 400);
      },
      Math.max(0, reste - 400),
    );
  };
  n.addEventListener(`pointerenter`, () => {
    clearTimeout(minuteur);
    reste = Math.max(1500, reste - (Date.now() - debut));
    n.classList.remove(`sortie`);
  });
  n.addEventListener(`pointerleave`, lancer);
  lancer();
}
// Astuce de première partie : un bandeau non bloquant, une seule fois par moment clé (`cle`).
export function afficherAstuce(cle, texte) {
  if (!parametres.vuTuto || tutoVu(parametres.vuTuto, cle)) {
    return;
  }
  parametres.vuTuto = { ...normaliserVuTuto(parametres.vuTuto), [cle]: true };
  sauverParametres(parametres);
  afficherBandeau(`💡 ${texte}`);
}
// « Revoir les astuces » (Paramètres) : toutes les astuces redeviennent disponibles.
export function reinitialiserAstuces() {
  parametres.vuTuto = Object.fromEntries(CLES_TUTO.map((k) => [k, false]));
  sauverParametres(parametres);
}
export function afficherBandeauQuete(e) {
  afficherBandeau(`✓ Quête accomplie : ${e}`);
}
