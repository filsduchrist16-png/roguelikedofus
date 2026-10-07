import { CLASSES, EQUIPEMENTS } from "../../data/index.js";
import {
  bonusEquipement,
  compterPanoplies,
  desequiper,
  equiperObjet,
  peutEquiper,
  pvMaxPerso,
} from "../../jeu/run.js";
import { numeroZoneObjet } from "../../jeu/economie.js";
import {
  NOMS_SLOTS,
  SLOTS,
  afficherEcran,
  attrTipObjet,
  barreRetour,
  classeRarete,
  echapperHtml,
  htmlChipsObjet,
  htmlComparaisonObjet,
  htmlNomObjet,
  imgObjet,
  imgSymboleClasse,
  racine,
  resumeBonus,
} from "../commun.js";
let triArmurerie = `toile`;
function trierInventaire(e) {
  let t = (inst) => EQUIPEMENTS[inst.id]?.nom ?? inst.id;
  let n = (inst) => SLOTS.indexOf(EQUIPEMENTS[inst.id]?.slot ?? `arme`);
  return e
    .map((inst, i) => ({
      inst,
      i,
    }))
    .sort(
      (e, r) =>
        (triArmurerie === `toile`
          ? [numeroZoneObjet(e.inst.id) - numeroZoneObjet(r.inst.id), n(e.inst) - n(r.inst)]
          : [n(e.inst) - n(r.inst), numeroZoneObjet(e.inst.id) - numeroZoneObjet(r.inst.id)]
        ).find((e) => e !== 0) ?? t(e.inst).localeCompare(t(r.inst)),
    );
}
export function ecranEquipement(e, t) {
  return new Promise((resolve) => {
    let r = 0;
    let i = () => {
      let a = racine.querySelector(`.equip-inv`)?.scrollTop ?? 0;
      let o = document.scrollingElement?.scrollTop ?? 0;
      let s = e[r];
      let c = e
        .map(
          (e, t) => `<button class="equip-onglet ${t === r ? `sel` : ``}" data-perso="${t}">
          <img src="${imgSymboleClasse(e.classeId)}" alt="" onerror="this.remove()" />${echapperHtml(CLASSES[e.classeId].nom)}</button>`,
        )
        .join(``);
      let l = SLOTS.map((e) => {
        let t = s.equipement[e];
        let n = t ? EQUIPEMENTS[t.id] : undefined;
        return `<div class="equip-slot ${n ? `rempli` : `vide`}${classeRarete(t)}" data-slot="${e}" ${n ? `data-desequip="${e}" draggable="true"` : ``}>
          <span class="slot-nom">${NOMS_SLOTS[e]}</span>
          ${n && t ? `<img class="slot-img" src="${imgObjet(n.id)}" alt="" onerror="this.remove()" /><span class="slot-item">${htmlNomObjet(t)}<small>${htmlChipsObjet(t, s.classeId)}</small></span>` : `<span class="slot-vide-txt">— vide —</span>`}
        </div>`;
      }).join(``);
      let d = t.length
        ? trierInventaire(t)
            .map(({ inst, i }) => {
              let n = EQUIPEMENTS[inst.id];
              let r = peutEquiper(s, inst.id);
              return `<button class="item-carte${classeRarete(inst)}${r ? `` : ` inequipable`}" data-index="${i}" draggable="true"${r ? attrTipObjet(inst.id) : ` title="Équipable uniquement sur un personnage de la ligne avant"`}>
              <img src="${imgObjet(inst.id)}" alt="" loading="lazy" onerror="this.remove()" />
              <span class="item-nom">${htmlNomObjet(inst)}<small>T${numeroZoneObjet(inst.id)} · ${NOMS_SLOTS[n.slot]} ${htmlChipsObjet(inst, s.classeId)}</small>${r ? htmlComparaisonObjet(inst, s) : ``}</span>
            </button>`;
            })
            .join(``)
        : `<p class="muet">Inventaire vide : gagne des combats pour trouver de l'équipement.</p>`;
      let f = bonusEquipement(s);
      let p = resumeBonus(f.stats, f.pvBonus, f.resistances) || `aucun bonus`;
      afficherEcran(`
        <h1>Équipement</h1>
        <div class="equip-onglets">${c}</div>
        <div class="equip-corps">
          <div class="equip-col">
            <h3>${echapperHtml(CLASSES[s.classeId].nom)} · PV max ${pvMaxPerso(s)}</h3>
            <div class="equip-slots">${l}</div>
            ${Object.entries(compterPanoplies(s))
              .map(([e, t]) => {
                if (t >= 4) {
                  return `<p class="equip-pano complete">${echapperHtml(e)} 4/4 : +1 PA</p>`;
                }
                return `<p class="equip-pano muet">${echapperHtml(e)} ${t}/4</p>`;
              })
              .join(``)}
            <p class="equip-total muet">Bonus total : ${p}</p>
          </div>
          <div class="equip-col">
            <h3>Inventaire (${t.length})
              <span class="equip-tri">Tri :
                <button id="tri-toile" class="tri-btn${triArmurerie === `toile` ? ` actif` : ``}" aria-pressed="${triArmurerie === `toile`}" title="Trier par toile d'obtention">Toile</button>
                <button id="tri-type" class="tri-btn${triArmurerie === `type` ? ` actif` : ``}" aria-pressed="${triArmurerie === `type`}" title="Trier par type d'objet">Type</button>
              </span>
            </h3>
            <div class="equip-inv">${d}</div>
          </div>
        </div>
        ${barreRetour(`equip-retour`, `Retour au plateau`)}
      `);
      let m = (e) => {
        if (e >= 0 && e < t.length) {
          equiperObjet(t, s, e);
          i();
        }
      };
      let h = (e) => {
        desequiper(t, s, e);
        i();
      };
      racine.querySelectorAll(`.equip-onglet`).forEach((e) =>
        e.addEventListener(`click`, () => {
          r = Number(e.dataset.perso);
          i();
        }),
      );
      document.getElementById(`tri-toile`)?.addEventListener(`click`, () => {
        triArmurerie = `toile`;
        i();
      });
      document.getElementById(`tri-type`)?.addEventListener(`click`, () => {
        triArmurerie = `type`;
        i();
      });
      racine.querySelectorAll(`.item-carte`).forEach((e) => {
        let t = Number(e.dataset.index);
        e.addEventListener(`click`, () => m(t));
        e.addEventListener(`dragstart`, (n) => {
          n.dataTransfer.setData(`text/plain`, `inv:${t}`);
          n.dataTransfer.effectAllowed = `move`;
          e.classList.add(`drag-src`);
        });
        e.addEventListener(`dragend`, () => e.classList.remove(`drag-src`));
      });
      racine.querySelectorAll(`.equip-slot`).forEach((e) => {
        let slot = e.dataset.slot;
        if (e.classList.contains(`rempli`)) {
          e.addEventListener(`click`, () => h(slot));
          e.addEventListener(`dragstart`, (n) => {
            n.dataTransfer.setData(`text/plain`, `slot:${slot}`);
            n.dataTransfer.effectAllowed = `move`;
            e.classList.add(`drag-src`);
          });
          e.addEventListener(`dragend`, () => e.classList.remove(`drag-src`));
        }
        e.addEventListener(`dragover`, (t) => {
          if (t.dataTransfer?.types.includes(`text/plain`)) {
            t.preventDefault();
            e.classList.add(`drop-cible`);
          }
        });
        e.addEventListener(`dragleave`, () => e.classList.remove(`drop-cible`));
        e.addEventListener(`drop`, (t) => {
          t.preventDefault();
          e.classList.remove(`drop-cible`);
          let n = t.dataTransfer.getData(`text/plain`);
          if (n.startsWith(`inv:`)) {
            m(Number(n.slice(4)));
          }
        });
      });
      let g = racine.querySelector(`.equip-inv`);
      if (g) {
        g.addEventListener(`dragover`, (e) => {
          if (e.dataTransfer?.types.includes(`text/plain`)) {
            e.preventDefault();
            g.classList.add(`drop-cible`);
          }
        });
        g.addEventListener(`dragleave`, () => g.classList.remove(`drop-cible`));
        g.addEventListener(`drop`, (e) => {
          e.preventDefault();
          g.classList.remove(`drop-cible`);
          let t = e.dataTransfer.getData(`text/plain`);
          if (t.startsWith(`slot:`)) {
            h(t.slice(5));
          }
        });
      }
      document.getElementById(`equip-retour`)?.addEventListener(`click`, () => resolve());
      let _ = racine.querySelector(`.equip-inv`);
      if (_) {
        _.scrollTop = a;
      }
      if (document.scrollingElement) {
        document.scrollingElement.scrollTop = o;
      }
    };
    i();
  });
}
