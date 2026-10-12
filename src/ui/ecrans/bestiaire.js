import { MONDES, MONSTRES, RELIQUES } from "../../data/index.js";
import {
  MONSTRES_RARES,
  bossDeZone,
  monstresDeZone,
  reliquesDuMonde,
  zonesDuMonde,
  zoneSecrete,
} from "../../jeu/config.js";
import { numeroZone } from "../../jeu/economie.js";
import { CONFIG_ARCHI } from "../../jeu/config.js";
import { bonusJaugeArchi } from "../../jeu/run.js";
import {
  comportementDefilement,
  afficherEcran,
  barreRetour,
  cheminAsset,
  echapperHtml,
  racine,
} from "../commun.js";
import { pastilleReliques, rendreEnGardantScroll } from "../collection.js";
const ECRAN_ETROIT = `(max-width: 760px)`;
export function ecranBestiaire(e) {
  return new Promise((resolve) => {
    let n = e.reliques ?? [];
    let r = MONDES.filter((e) => e.zones.length > 0);
    let i = MONDES.filter((e) => e.zones.length === 0);
    let a = (e) => monstresDeZone(e).filter((e) => MONSTRES[e]?.archiNom);
    let o = (t) => t.filter((t) => e.archis.includes(t)).length;
    let s = (e) => {
      let t = new Set(zonesDuMonde(e).flatMap(a));
      for (let n of MONSTRES_RARES[e.id]?.especes ?? []) {
        if (MONSTRES[n]?.archiNom) {
          t.add(n);
        }
      }
      return {
        fait: o([...t]),
        sur: t.size,
      };
    };
    let c = r[0]?.id ?? ``;
    let l = 0;
    let u = (t) => {
      let n = MONSTRES[t];
      let r = !!n.archiNom && e.archis.includes(t);
      return `<div class="best-espece ${n.archiNom ? (r ? `capt` : `manquant`) : `simple`}" title="${echapperHtml(n.archiNom ? `${n.archiNom}, archimonstre de ${n.nom}` : `${n.nom} (pas d'archimonstre)`)}">
          <span class="best-espece-img">
            ${n.img ? `<img src="${cheminAsset(n.img)}" alt="" loading="lazy" onerror="this.remove()" />` : ``}
            ${r ? `<img class="archi-mark" src="${cheminAsset(`/assets/divers/Archmonster.webp`)}" alt="capturé" onerror="this.remove()" />` : ``}
          </span>
          <b>${echapperHtml(n.archiNom ?? n.nom)}</b>
          <small>${n.archiNom ? echapperHtml(n.nom) : `Pas d'archimonstre`}</small>
        </div>`;
    };
    let f = (e) => {
      let t = MONSTRES[e];
      let r = RELIQUES[e];
      let i = n.includes(e);
      return `<div class="best-boss">
          <div class="best-boss-carte">
            ${t.img ? `<img src="${cheminAsset(t.img)}" alt="" onerror="this.remove()" />` : ``}
            <span><em class="best-tag">Boss</em><b>${echapperHtml(t.nom)}</b></span>
          </div>
          ${
            r
              ? `<div class="best-relique ${i ? `eue` : `manquante`}">
            <span class="best-relique-halo"><img src="${cheminAsset(`/assets/reliques/${e}.png`)}" alt="" onerror="this.remove()" /></span>
            <span><em class="best-tag">${i ? `Relique obtenue` : `Relique`}</em>
              <b>${i ? echapperHtml(r.nom) : `???`}</b>
              <small>Lâchée rarement par ${echapperHtml(t.nom)}</small></span>
          </div>`
              : ``
          }
        </div>`;
    };
    let p = (e) => {
      if (e.length) {
        return `Archimonstres ${o(e)}/${e.length}`;
      }
      return `Aucun archimonstre`;
    };
    let m = () => {
      let e = r.find((e) => e.id === c) ?? r[0];
      let o = e ? [...zonesDuMonde(e), zoneSecrete(e.id)].filter(Boolean) : [];
      let h = (MONSTRES_RARES[e?.id ?? ``]?.especes ?? []).filter((e) => MONSTRES[e]);
      let g = r
        .map((t) => {
          let r = s(t);
          let i = reliquesDuMonde(t.id);
          return `<button class="best-onglet${t.id === e?.id ? ` actif` : ``}" aria-pressed="${t.id === e?.id}" data-monde="${t.id}">
            <b>${echapperHtml(t.nom)}</b>
            <small>${r.sur ? `Archimonstres ${r.fait}/${r.sur}` : `Pas d'archimonstre`} · Reliques ${i.filter((e) => n.includes(e)).length}/${i.length}</small>
          </button>`;
        })
        .join(``);
      let _ =
        o
          .map((e, t) => {
            let r = bossDeZone(e);
            let i = pastilleReliques(r, n);
            let o = MONSTRES[r[0]]?.img;
            return `<button class="best-zone${t === l ? ` actif` : ``}" data-zone="${t}">
            ${o ? `<img src="${cheminAsset(o)}" alt="" onerror="this.remove()" />` : `<span></span>`}
            <span class="best-zone-txt"><b>${echapperHtml(e.nom)}</b><small>${p(a(e))}</small></span>
            ${i ? `<span class="best-pastille${i.complete ? ` complete` : ``}" title="Reliques de la zone">${i.texte}</span>` : ``}
          </button>`;
          })
          .join(``) +
        (h.length
          ? `<button class="best-zone${l === o.length ? ` actif` : ``}" data-zone="${o.length}">
            ${MONSTRES[h[0]]?.img ? `<img src="${cheminAsset(MONSTRES[h[0]].img)}" alt="" onerror="this.remove()" />` : `<span></span>`}
            <span class="best-zone-txt"><b>Rencontres fortuites</b><small>${p(h.filter((e) => MONSTRES[e]?.archiNom))}</small></span>
          </button>`
          : ``);
      let v;
      if (l < o.length) {
        let e = o[l];
        let t = bossDeZone(e);
        let n = monstresDeZone(e).filter((e) => !t.includes(e));
        v = `<div class="best-titre"><h2>${echapperHtml(e.nom)}</h2>
            <small>${e.secret ? `Donjon secret (il s'ouvre avec une clé, après le boss d'une zone)` : `Zone ${numeroZone(e.id)}`} · ${p(a(e))}</small></div>
          <div class="best-boss-liste">${t.map(f).join(``)}</div>
          <h3 class="best-rubrique">Habitants</h3>
          <div class="best-especes">${n.map(u).join(``)}</div>`;
      } else {
        v = `<div class="best-titre"><h2>Rencontres fortuites</h2></div>
          <p class="muet">Ces vagabonds n'habitent aucun donjon : ils surgissent rarement au milieu d'un combat ordinaire, et toujours sous leur forme d'Archimonstre.</p>
          <div class="best-especes">${h.map(u).join(``)}</div>`;
      }
      afficherEcran(`
        <h1>Bestiaire</h1>
        <p class="best-jauge" data-tip="Chaque combat sans archimonstre inédit remplit la jauge ; elle se vide quand un archi jamais capturé apparaît.">🎯 Jauge de traque : <b>+${Math.round(bonusJaugeArchi(e.jaugeArchi) * 100)} %</b> de chance d'archi inédit${e.jaugeArchi ? ` (${e.jaugeArchi} combat${e.jaugeArchi > 1 ? `s` : ``} sans nouvel archi)` : ``} · les archis jamais capturés apparaissent ${CONFIG_ARCHI.multNouveau}× plus souvent</p>
        <div class="best-onglets" role="group" aria-label="Mondes">${g}</div>
        <div class="best-vue">
          <nav class="best-zones" aria-label="Zones du monde">${_}</nav>
          <section class="best-detail"><button type="button" class="best-vers-zones secondaire">↑ Zones</button>${v}</section>
        </div>
        ${i.length ? `<p class="muet monde-verrouille">${i.map((e) => echapperHtml(e.nom)).join(`, `)} : à venir</p>` : ``}
        ${barreRetour(`best-retour`)}
      `);
      racine.querySelectorAll(`[data-monde]`).forEach((e) =>
        e.addEventListener(`click`, () => {
          c = e.dataset.monde;
          l = 0;
          rendreEnGardantScroll(m, false);
        }),
      );
      racine.querySelectorAll(`[data-zone]`).forEach((e) =>
        e.addEventListener(`click`, () => {
          l = Number(e.dataset.zone);
          rendreEnGardantScroll(m, true);
          // téléphone : le détail est sous la liste des zones, on l'amène à l'écran
          if (window.matchMedia(ECRAN_ETROIT).matches) {
            racine
              .querySelector(`.best-detail`)
              ?.scrollIntoView({ block: `start`, behavior: comportementDefilement() });
          }
        }),
      );
      racine.querySelector(`.best-vers-zones`)?.addEventListener(`click`, () => {
        const zone =
          racine.querySelector(`.best-zone.actif`) ?? racine.querySelector(`.best-zones`);
        zone?.scrollIntoView({ block: `center`, behavior: comportementDefilement() });
        zone?.focus({ preventScroll: true });
      });
      racine.querySelector(`#best-retour`)?.addEventListener(`click`, () => resolve());
    };
    m();
  });
}
