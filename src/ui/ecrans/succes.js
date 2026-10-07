import { DOFUS, SUCCES } from "../../data/index.js";
import {
  contexteMeta,
  dofusDeSucces,
  etatQuete,
  nouvelEtatQuetes,
  progressionSucces,
  trouverQuete,
} from "../../jeu/quetes.js";
import {
  afficherEcran,
  barreContinuer,
  barreRetour,
  cheminAsset,
  echapperHtml,
} from "../commun.js";
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
export function ecranSucces(e) {
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
    let f = o.length ? `d:${o[0]}` : `g:${s[0]}`;
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
      return `<button class="${a}" data-sel="d:${e}">
        <span class="succes-halo">${img ? `<img src="${cheminAsset(img)}" alt="" onerror="this.remove()" />` : ``}</span>
        <span class="succes-carte-nom">${echapperHtml(DOFUS[e].nom)}</span>
        ${r ? p(r.faites, r.total) : ``}
        <span class="succes-carte-progres">${r ? (r.complet ? `✓ Obtenu` : `${r.faites} / ${r.total} quêtes`) : `Bientôt`}</span>
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
        .join(` `)}" data-sel="g:${e}">
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
          return `<li class="quete-ligne${t.faite ? ` faite` : ``}">
        <span class="quete-coche" aria-label="${t.faite ? `faite` : `à faire`}">${t.faite ? `✓` : ``}</span>
        <span class="quete-nom">${echapperHtml(e.nom)}</span>${i}
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
          <div><h2>${echapperHtml(t.nom)}</h2><p class="succes-effet">${echapperHtml(t.desc)}</p></div>
        </div>`;
        if (!a) {
          return `${o}<p class="succes-a-venir">Ce Dofus n'a pas encore de groupe de quêtes.</p>`;
        }
        let s = progressionSucces(n, a);
        return `${o}${c(e) ? `<span class="succes-statut obtenu">Dofus obtenu</span>` : `<span class="succes-statut">${s.faites} / ${s.total} quêtes pour l'obtenir</span>`}${_(a)}`;
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
            ${
              s.length
                ? `<h2 class="succes-rubrique">Général</h2>
            <div class="succes-generaux">${s.map(h).join(``)}</div>`
                : ``
            }
          </div>
          <aside class="succes-panneau">${v()}</aside>
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
        }),
      );
      document.getElementById(`succes-retour`)?.addEventListener(`click`, () => resolve());
    };
    ee();
  });
}
export function ecranSuccesObtenu(e, t) {
  return new Promise((resolve) => {
    let r = dofusDeSucces(e);
    let i = r && t ? DOFUS[r]?.nom : undefined;
    afficherEcran(`
      <h1>🏆 Succès : ${echapperHtml(e.nom)}</h1>
      <p class="sous-titre">${i ? `Tu obtiens le ${echapperHtml(i)}.` : `Toutes ses quêtes sont accomplies.`}</p>
      ${barreContinuer(`succes-ok`)}
    `);
    document.getElementById(`succes-ok`)?.addEventListener(`click`, () => resolve());
  });
}
export function afficherBandeauQuete(e) {
  let t = document.getElementById(`bandeaux-quete`);
  if (!t) {
    t = document.createElement(`div`);
    t.id = `bandeaux-quete`;
    document.body.appendChild(t);
  }
  let n = document.createElement(`div`);
  n.className = `bandeau-quete`;
  n.textContent = `✓ Quête accomplie : ${e}`;
  t.appendChild(n);
  setTimeout(() => n.remove(), 4000);
}
