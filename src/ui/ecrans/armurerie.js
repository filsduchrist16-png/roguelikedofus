import { EQUIPEMENTS, MONDES, MONSTRES, PANOPLIES } from "../../data/index.js";

const OU_PANOPLIE = { combats: `combats`, elites: `combats durs`, boss: `boss` };
import { RARETES_INFO, bossDeZone, zonesDuMonde, zoneSecrete } from "../../jeu/config.js";
import { numeroZone } from "../../jeu/economie.js";
import { descriptionPanoplie } from "../../jeu/panoplies.js";
import {
  NOMS_SLOTS,
  afficherEcran,
  attrTipObjet,
  barreRetour,
  cheminAsset,
  echapperHtml,
  imgObjet,
  racine,
} from "../commun.js";
import {
  butinParCategorie,
  pastilleCollection,
  progressionArmurerie,
  rendreEnGardantScroll,
} from "../collection.js";
const ECRAN_ETROIT = `(max-width: 760px)`;
export function ecranArmurerie(e) {
  return new Promise((resolve) => {
    let n = e.collection ?? {};
    let r = (e) => [
      ...e.panoplies.flatMap((p) => p.ids),
      ...e.combats,
      ...e.elites,
      ...e.boss.map((e) => e.id),
    ];
    let i = MONDES.filter((e) => progressionArmurerie(e, n).sur > 0);
    let a = MONDES.filter((e) => progressionArmurerie(e, n).sur === 0);
    let o = i[0]?.id ?? ``;
    let s = 0;
    let c = (e, t = ``) => {
      let r = EQUIPEMENTS[e];
      let i = n[e];
      return `<div class="armu-objet${i ? ` eu rarete-${i}` : ``}"${attrTipObjet(e)}>
          <img src="${imgObjet(e)}" alt="" loading="lazy" onerror="this.remove()" />
          <b>${echapperHtml(r.nom)}</b>
          <small>${NOMS_SLOTS[r.slot]}${t ? ` · ${echapperHtml(t)}` : ``}</small>
          <span class="armu-rarete${i ? ` armu-r-${i}` : ``}">${i ? RARETES_INFO[i].nom : `Jamais obtenu`}</span>
        </div>`;
    };
    let l = (e, t, n) => {
      if (n.length) {
        return `<div class="armu-section">
          <div class="armu-section-tete"><h3 class="best-rubrique">${echapperHtml(e)}</h3><small>${echapperHtml(t)}</small></div>
          <div class="armu-objets">${n.join(``)}</div>
        </div>`;
      }
      return ``;
    };
    let u = () => {
      let e = i.find((e) => e.id === o) ?? i[0];
      let f = e
        ? [...zonesDuMonde(e), zoneSecrete(e.id)].filter(
            (e) => e && r(butinParCategorie(e.id)).length,
          )
        : [];
      let p = i
        .map((t) => {
          let r = progressionArmurerie(t, n);
          return `<button class="best-onglet${t.id === e?.id ? ` actif` : ``}" aria-pressed="${t.id === e?.id}" data-monde="${t.id}">
            <b>${echapperHtml(t.nom)}</b>
            <small>Objets ${r.fait}/${r.sur} · Légendaires ${r.legendaires}</small>
          </button>`;
        })
        .join(``);
      let m = f
        .map((e, t) => {
          let i = butinParCategorie(e.id);
          let a = r(i);
          let o = pastilleCollection(
            i.panoplies.flatMap((p) => p.ids),
            n,
          );
          let c = MONSTRES[bossDeZone(e)[0]]?.img;
          return `<button class="best-zone${t === s ? ` actif` : ``}" data-zone="${t}">
            ${c ? `<img src="${cheminAsset(c)}" alt="" onerror="this.remove()" />` : `<span></span>`}
            <span class="best-zone-txt"><b>${echapperHtml(e.nom)}</b><small>Objets ${a.filter((e) => n[e]).length}/${a.length}</small></span>
            ${o ? `<span class="best-pastille${o.complete ? ` complete` : ``}" title="Pièces des panoplies de la zone">${o.texte}</span>` : ``}
          </button>`;
        })
        .join(``);
      let h = ``;
      let g = f[s];
      if (g) {
        let e = butinParCategorie(g.id);
        let t = r(e);
        let i = bossDeZone(g)
          .map((e) => MONSTRES[e]?.nom ?? e)
          .join(` et `);
        h = `<div class="best-titre"><h2>${echapperHtml(g.nom)}</h2>
            <small>${g.secret ? `Donjon secret (il s'ouvre avec une clé)` : `Zone ${numeroZone(g.id)}`} · Objets ${t.filter((e) => n[e]).length}/${t.length}</small>
            <span class="armu-legende"><span class="armu-r-texte-commun">Commun</span><span class="armu-r-texte-rare">Rare</span><span class="armu-r-texte-epique">Épique</span><span class="armu-r-texte-legendaire">Légendaire</span></span></div>
          ${e.panoplies
            .map((p) =>
              l(
                `${p.nom} · ${OU_PANOPLIE[p.ou]}${PANOPLIES[p.nom]?.niveau ? ` · niv. ${PANOPLIES[p.nom].niveau} dans Dofus` : ``}`,
                descriptionPanoplie(p.nom) || `Panoplie`,
                p.ids.map((e) => c(e)),
              ),
            )
            .join(``)}
          ${l(
            `Butin des combats`,
            `Tombe dans les combats de la zone`,
            e.combats.map((e) => c(e)),
          )}
          ${l(
            `Butin des combats durs`,
            `Exclusif aux combats d'élite de la zone`,
            e.elites.map((e) => c(e)),
          )}
          ${l(
            `Butin du boss`,
            i ? `Lâché par ${i}` : `Lâché au donjon`,
            e.boss.map((e) => c(e.id, e.aussiElite ? `aussi en combat dur` : ``)),
          )}`;
      }
      afficherEcran(`
        <h1>Armurerie</h1>
        <div class="best-onglets" role="group" aria-label="Mondes">${p}</div>
        <div class="best-vue">
          <nav class="best-zones" aria-label="Zones du monde">${m}</nav>
          <section class="best-detail"><button type="button" class="best-vers-zones secondaire">↑ Zones</button>${h}</section>
        </div>
        ${a.length ? `<p class="muet monde-verrouille">${a.map((e) => echapperHtml(e.nom)).join(`, `)} : aucun objet pour l'instant</p>` : ``}
        ${barreRetour(`armu-retour`)}
      `);
      racine.querySelectorAll(`[data-monde]`).forEach((e) =>
        e.addEventListener(`click`, () => {
          o = e.dataset.monde;
          s = 0;
          rendreEnGardantScroll(u, false);
        }),
      );
      racine.querySelectorAll(`[data-zone]`).forEach((e) =>
        e.addEventListener(`click`, () => {
          s = Number(e.dataset.zone);
          rendreEnGardantScroll(u, true);
          // téléphone : le détail est sous la liste des zones, on l'amène à l'écran
          if (window.matchMedia(ECRAN_ETROIT).matches) {
            racine
              .querySelector(`.best-detail`)
              ?.scrollIntoView({ block: `start`, behavior: `smooth` });
          }
        }),
      );
      racine.querySelector(`.best-vers-zones`)?.addEventListener(`click`, () => {
        const zone =
          racine.querySelector(`.best-zone.actif`) ?? racine.querySelector(`.best-zones`);
        zone?.scrollIntoView({ block: `center`, behavior: `smooth` });
        zone?.focus({ preventScroll: true });
      });
      racine.querySelector(`#armu-retour`)?.addEventListener(`click`, () => resolve());
    };
    u();
  });
}
