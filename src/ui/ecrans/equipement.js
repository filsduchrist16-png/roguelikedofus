import { CLASSES, EQUIPEMENTS, PANOPLIES } from "../../data/index.js";
import {
  bonusPanoplie,
  descriptionPanoplie,
  paliersPanoplie,
  taillePanoplie,
  texteBonusPanoplie,
} from "../../jeu/panoplies.js";
import {
  bonusEquipement,
  compterPanoplies,
  desequiper,
  emplacementPossible,
  equiperObjet,
  pvMaxPerso,
} from "../../jeu/run.js";
import { emplacementsDuType, typeDeEmplacement } from "../../jeu/emplacements.js";
import { numeroZoneObjet } from "../../jeu/economie.js";
import { RARETES, RARETES_INFO } from "../../jeu/config.js";
import { comparerObjet, equiperMeilleur, grouperInventaire } from "../../jeu/inventaire.js";
import { texteObtentionObjet } from "../../jeu/obtention.js";
import {
  EMPLACEMENTS,
  NOMS_EMPLACEMENTS,
  NOMS_SLOTS,
  SLOTS,
  VERDICTS,
  afficherEcran,
  barreRetour,
  classeRarete,
  echapperHtml,
  ecranTactile,
  htmlBadgesHeros,
  htmlChipsObjet,
  htmlComparaisonObjet,
  htmlDeltas,
  htmlNomObjet,
  imgObjet,
  imgSymboleClasse,
  racine,
  htmlMetaObjet,
  resumeBonus,
} from "../commun.js";
let triArmurerie = `toile`;
let filtreSlot = `tout`;
const ORDRE_VERDICT = [`mieux`, `mitige`, `egal`, `moins`, `impossible`];
const TRIS = [
  [`toile`, `Tier`, `Trier par Tier (toile d'obtention), les plus hauts d'abord`],
  [`type`, `Type`, `Trier par emplacement`],
  [`rarete`, `Rareté`, `Légendaires d'abord`],
  [`interet`, `Intérêt`, `Les améliorations pour le héros choisi d'abord`],
];
function trierGroupes(groupes, perso) {
  const nom = (inst) => EQUIPEMENTS[inst.id]?.nom ?? inst.id;
  const slot = (inst) => SLOTS.indexOf(EQUIPEMENTS[inst.id]?.slot ?? `arme`);
  const toile = (inst) => numeroZoneObjet(inst.id);
  const rarete = (inst) => -RARETES.indexOf(inst.rarete);
  const interet = (g) => ORDRE_VERDICT.indexOf(g.comparaison.verdict);
  const criteres = {
    toile: (a, b) => [
      toile(b.inst) - toile(a.inst),
      rarete(a.inst) - rarete(b.inst),
      slot(a.inst) - slot(b.inst),
    ],
    type: (a, b) => [slot(a.inst) - slot(b.inst), toile(a.inst) - toile(b.inst)],
    rarete: (a, b) => [rarete(a.inst) - rarete(b.inst), toile(b.inst) - toile(a.inst)],
    interet: (a, b) => [interet(a) - interet(b), toile(b.inst) - toile(a.inst)],
  }[triArmurerie];
  return groupes.sort(
    (a, b) => criteres(a, b).find((x) => x !== 0) ?? nom(a.inst).localeCompare(nom(b.inst)),
  );
}
const nomClasse = (perso) => CLASSES[perso.classeId].nom;
function htmlVerdict(verdict) {
  const v = VERDICTS[verdict];
  return `<span class="verdict verdict-${verdict}">${v.icone} ${v.texte}</span>`;
}
// Fiche d'un objet : tout ce qu'il donne, d'où il vient, et ce qu'il changerait pour chaque héros.
function htmlFicheObjet(inst, persos, perso, porteePar, quantite, emplacementPorte) {
  const def = EQUIPEMENTS[inst.id];
  // pour un anneau : proposer aussi de remplacer l'autre anneau porté
  const autreAnneau = (p, c) => {
    const autre = emplacementsDuType(def.slot).find((k) => k !== c.emplacement);
    if (!autre || !p.equipement[c.emplacement] || !emplacementPossible(p, inst, autre)) {
      return ``;
    }
    const porte = p.equipement[autre];
    return `<button class="secondaire petit" data-equiper-sur="${persos.indexOf(p)}" data-emplacement="${autre}">À la place de ${echapperHtml(EQUIPEMENTS[porte?.id]?.nom ?? NOMS_EMPLACEMENTS[autre])}</button>`;
  };
  const lignesHeros = porteePar
    ? `<p class="fiche-porte">Porté par <b>${echapperHtml(nomClasse(porteePar))}</b>${emplacementPorte && emplacementPorte !== def.slot ? ` (${NOMS_EMPLACEMENTS[emplacementPorte]})` : ``}.</p>
       <div class="fiche-actions"><button class="secondaire" data-retirer="${emplacementPorte ?? def.slot}">Retirer (retourne dans l'inventaire)</button></div>`
    : `<h4 class="fiche-sous-titre">Sur quel héros ?</h4>
       <ul class="fiche-heros">${persos
         .map((p, i) => {
           const c = comparerObjet(inst, p);
           const actuel = c.actuel
             ? `remplace ${echapperHtml(EQUIPEMENTS[c.actuel.id]?.nom ?? c.actuel.id)}`
             : `emplacement vide`;
           return `<li class="${p === perso ? `courant` : ``}">
             <span class="fiche-heros-nom"><img src="${imgSymboleClasse(p.classeId)}" alt="" onerror="this.remove()" />${echapperHtml(nomClasse(p))}</span>
             ${htmlVerdict(c.verdict)}
             <span class="fiche-heros-detail">${c.verdict === `impossible` ? `Équipable seulement en ligne avant.` : `${actuel} : ${htmlDeltas(c.deltas) || `aucun changement de stats`}`}</span>
             <span class="fiche-heros-boutons"><button class="primaire" data-equiper-sur="${i}" data-emplacement="${c.emplacement ?? ``}" ${c.verdict === `impossible` ? `disabled` : ``}>Équiper</button>${c.verdict === `impossible` ? `` : autreAnneau(p, c)}</span>
           </li>`;
         })
         .join(``)}</ul>`;
  return `<div class="fiche-fond" data-fermer-fiche></div>
    <section class="fiche-objet${classeRarete(inst)}" role="dialog" aria-modal="true" aria-label="${echapperHtml(def.nom)}">
      <div class="fiche-tete">
        <img class="fiche-img" src="${imgObjet(inst.id)}" alt="" onerror="this.remove()" />
        <div class="fiche-titre">
          <h3>${htmlNomObjet(inst)}${quantite > 1 ? ` <span class="item-qte">×${quantite}</span>` : ``}</h3>
          <span class="muet ic-meta">${htmlMetaObjet(inst)} · trouvé en toile ${numeroZoneObjet(inst.id)}${def.panoplie ? ` · ${echapperHtml(def.panoplie)}` : ``}</span>
        </div>
        <button class="fiche-fermer" data-fermer-fiche aria-label="Fermer">✕</button>
      </div>
      <div class="fiche-chips">${htmlChipsObjet(inst, perso.classeId)}</div>
      ${lignesHeros}
      <p class="fiche-obtention">${echapperHtml(texteObtentionObjet(inst.id)).replace(/\n/g, `<br>`)}</p>
    </section>`;
}
export function ecranEquipement(e, t) {
  return new Promise((resolve) => {
    let r = 0;
    // objet ouvert dans la fiche : { inst } (inventaire) ou { slot } (porté)
    let selection = null;
    let messageAuto = ``;
    let i = () => {
      let a = racine.querySelector(`.equip-inv`)?.scrollTop ?? 0;
      let o = document.scrollingElement?.scrollTop ?? 0;
      let s = e[r];
      let groupes = grouperInventaire(t).map((g) => ({
        ...g,
        comparaison: comparerObjet(g.inst, s),
      }));
      let c = e
        .map((p, idx) => {
          const portes = EMPLACEMENTS.filter((slot) => p.equipement[slot]).length;
          const ameliorations = groupes.filter(
            (g) => comparerObjet(g.inst, p).verdict === `mieux`,
          ).length;
          return `<button class="equip-onglet ${idx === r ? `sel` : ``}" data-perso="${idx}" aria-pressed="${idx === r}">
          <img src="${imgSymboleClasse(p.classeId)}" alt="" onerror="this.remove()" />
          <span class="onglet-texte">${echapperHtml(nomClasse(p))}<small>${portes}/${EMPLACEMENTS.length} équipés${ameliorations ? ` · <b class="onglet-mieux">▲ ${ameliorations}</b>` : ``}</small></span></button>`;
        })
        .join(``);
      // les 8 emplacements en grille compacte : icône, emplacement, Tier ; la fiche donne le détail
      let l = EMPLACEMENTS.map((slot) => {
        let inst = s.equipement[slot];
        let n = inst ? EQUIPEMENTS[inst.id] : undefined;
        const type = typeDeEmplacement(slot);
        const dispo = groupes.some(
          (g) => EQUIPEMENTS[g.inst.id]?.slot === type && g.comparaison.verdict !== `impossible`,
        );
        const mieux = groupes.some(
          (g) =>
            EQUIPEMENTS[g.inst.id]?.slot === type &&
            g.comparaison.verdict === `mieux` &&
            g.comparaison.emplacement === slot,
        );
        return n && inst
          ? `<div class="equip-slot rempli${classeRarete(inst)}" data-slot="${slot}" data-desequip="${slot}" draggable="true" role="button" tabindex="0" aria-label="${NOMS_EMPLACEMENTS[slot]} : ${echapperHtml(n.nom)}, voir la fiche" title="${echapperHtml(n.nom)}">
              <span class="ic-visuel"><img src="${imgObjet(n.id)}" alt="" onerror="this.remove()" />${mieux ? `<b class="slot-mieux" title="Un objet de l'inventaire ferait mieux">▲</b>` : ``}</span>
              <span class="slot-nom">${NOMS_EMPLACEMENTS[slot]}</span>
              <span class="slot-objet ic-nom">${htmlNomObjet(inst)}</span>
              <b class="ic-tier">T${numeroZoneObjet(inst.id)}</b>
            </div>`
          : `<div class="equip-slot vide" data-slot="${slot}" role="button" tabindex="0" aria-label="${NOMS_EMPLACEMENTS[slot]} vide${dispo ? ` : objets disponibles` : ``}">
              <span class="ic-visuel">${dispo ? `<b class="slot-mieux" title="Objet disponible dans l'inventaire">▲</b>` : ``}</span>
              <span class="slot-nom">${NOMS_EMPLACEMENTS[slot]}</span>
              <span class="slot-vide-txt">${dispo ? `à équiper` : `vide`}</span>
            </div>`;
      }).join(``);
      const compteSlot = (slot) => t.filter((inst) => EQUIPEMENTS[inst.id]?.slot === slot).length;
      let filtres = [
        [`tout`, `Tout`, t.length],
        ...SLOTS.map((slot) => [slot, NOMS_SLOTS[slot], compteSlot(slot)]),
      ]
        .map(
          ([id, nom, n]) =>
            `<button class="filtre-btn${filtreSlot === id ? ` actif` : ``}" data-filtre="${id}" aria-pressed="${filtreSlot === id}" ${n || id === `tout` ? `` : `disabled`}>${nom} <small>${n}</small></button>`,
        )
        .join(``);
      let visibles = trierGroupes(
        groupes.filter((g) => filtreSlot === `tout` || EQUIPEMENTS[g.inst.id]?.slot === filtreSlot),
        s,
      );
      let d = visibles.length
        ? visibles
            .map(({ inst, indices, comparaison }) => {
              let n = EQUIPEMENTS[inst.id];
              let possible = comparaison.verdict !== `impossible`;
              return `<button class="item-carte ic${classeRarete(inst)}${possible ? `` : ` inequipable`}" data-index="${indices[0]}" draggable="${possible}" aria-label="${echapperHtml(n.nom)} : voir la fiche">
              <span class="ic-visuel"><img src="${imgObjet(inst.id)}" alt="" loading="lazy" onerror="this.remove()" /></span>
              <span class="ic-corps">
                <span class="ic-ligne1"><span class="ic-nom">${htmlNomObjet(inst)}${indices.length > 1 ? ` <span class="item-qte">×${indices.length}</span>` : ``}</span>${htmlVerdict(comparaison.verdict)}</span>
                <span class="ic-meta">${htmlMetaObjet(inst)}</span>
                <span class="ic-stats">${htmlChipsObjet(inst, s.classeId)}</span>
                ${possible ? htmlComparaisonObjet(inst, s) : ``}${htmlBadgesHeros(inst, e, s)}
              </span>
            </button>`;
            })
            .join(``)
        : t.length
          ? `<p class="muet">Aucun objet de ce type.</p>`
          : `<p class="muet">Inventaire vide : gagne des combats pour trouver de l'équipement.</p>`;
      let f = bonusEquipement(s);
      let p = resumeBonus(f.stats, f.pvBonus, f.resistances) || `aucun bonus`;
      let fiche = ``;
      if (selection?.inst && t.includes(selection.inst)) {
        fiche = htmlFicheObjet(
          selection.inst,
          e,
          s,
          null,
          groupes.find((g) => g.indices.some((x) => t[x] === selection.inst))?.indices.length ?? 1,
        );
      } else if (selection?.slot && s.equipement[selection.slot]) {
        fiche = htmlFicheObjet(s.equipement[selection.slot], e, s, s, 1, selection.slot);
      } else {
        selection = null;
      }
      afficherEcran(`
        <h1>Équipement</h1>
        <div class="equip-onglets">${c}</div>
        <div class="equip-corps">
          <div class="equip-col">
            <h3 class="equip-titre-heros">${echapperHtml(nomClasse(s))} · PV max ${pvMaxPerso(s)}
              ${groupes.some((g) => e.some((p) => comparerObjet(g.inst, p).verdict === `mieux`)) ? `<button id="equip-auto" class="primaire petit" title="Équipe sur chaque héros les objets de l'inventaire qui sont une nette amélioration">⚡ Équiper le meilleur</button>` : ``}
            </h3>
            ${messageAuto ? `<p class="equip-auto-msg" role="status">${messageAuto}</p>` : ``}
            <div class="equip-slots grille">${l}</div>
            ${Object.entries(compterPanoplies(s))
              .map(([nom, nb]) => {
                const b = bonusPanoplie(nom, nb);
                const prochain = paliersPanoplie(nom).find((k) => k > nb);
                const suite = prochain
                  ? ` · à ${prochain} pièces : ${texteBonusPanoplie(PANOPLIES[nom].paliers[prochain])}`
                  : ``;
                return `<p class="equip-pano${b ? ` complete` : ` muet`}" title="${echapperHtml(descriptionPanoplie(nom))}">⬡ ${echapperHtml(nom)} ${nb}/${taillePanoplie(nom)}${b ? ` : ${texteBonusPanoplie(b)}` : ``}${suite}</p>`;
              })
              .join(``)}
            <p class="equip-total">Bonus total : ${p}</p>
          </div>
          <div class="equip-col">
            <h3>Inventaire (${t.length})</h3>
            <div class="equip-outils">
              <div class="equip-filtres" role="group" aria-label="Filtrer par emplacement">${filtres}</div>
              <div class="equip-tri" role="group" aria-label="Trier">Tri :
                ${TRIS.map(([id, nom, aide]) => `<button class="tri-btn${triArmurerie === id ? ` actif` : ``}" data-tri="${id}" aria-pressed="${triArmurerie === id}" title="${aide}">${nom}</button>`).join(``)}
              </div>
            </div>
            <p class="equip-astuce muet">Touche un objet pour voir sa fiche et l'équiper sur n'importe quel héros${ecranTactile() ? `` : ` (double-clic : équiper directement, ou glisser-déposer)`}.</p>
            <div class="equip-inv">${d}</div>
          </div>
        </div>
        ${barreRetour(`equip-retour`, `Retour au plateau`)}
      `);
      // la fiche va directement dans <body> : l'écran (flou d'arrière-plan) piégerait position:fixed
      document.getElementById(`fiche-equip`)?.remove();
      if (fiche) {
        const conteneur = document.createElement(`div`);
        conteneur.id = `fiche-equip`;
        conteneur.innerHTML = fiche;
        document.body.appendChild(conteneur);
      }
      let m = (e, emplacement) => {
        if (e >= 0 && e < t.length) {
          equiperObjet(t, s, e, emplacement);
          selection = null;
          i();
        }
      };
      let h = (e) => {
        desequiper(t, s, e);
        selection = null;
        i();
      };
      document.getElementById(`equip-auto`)?.addEventListener(`click`, () => {
        const n = equiperMeilleur({ inventaire: t, persos: e });
        messageAuto = n
          ? `✓ ${n} objet${n > 1 ? `s` : ``} équipé${n > 1 ? `s` : ``} (seulement les nettes améliorations ; les objets « mitigés » restent à ton choix).`
          : `Rien à améliorer.`;
        selection = null;
        i();
        messageAuto = ``;
      });
      racine.querySelectorAll(`.equip-onglet`).forEach((e) =>
        e.addEventListener(`click`, () => {
          r = Number(e.dataset.perso);
          i();
        }),
      );
      racine.querySelectorAll(`[data-tri]`).forEach((b) =>
        b.addEventListener(`click`, () => {
          triArmurerie = b.dataset.tri;
          i();
        }),
      );
      racine.querySelectorAll(`[data-filtre]`).forEach((b) =>
        b.addEventListener(`click`, () => {
          filtreSlot = b.dataset.filtre;
          i();
        }),
      );
      // emplacement vide : on filtre l'inventaire sur cet emplacement et on y descend
      racine.querySelectorAll(`.equip-slot.vide`).forEach((b) =>
        b.addEventListener(`click`, () => {
          filtreSlot = typeDeEmplacement(b.dataset.slot);
          i();
          racine
            .querySelector(`.equip-outils`)
            ?.scrollIntoView({ block: `start`, behavior: `smooth` });
        }),
      );
      racine.querySelectorAll(`.item-carte`).forEach((e) => {
        let t_ = Number(e.dataset.index);
        e.addEventListener(`click`, () => {
          selection = { inst: t[t_] };
          i();
        });
        e.addEventListener(`dblclick`, () => m(t_));
        e.addEventListener(`dragstart`, (n) => {
          n.dataTransfer.setData(`text/plain`, `inv:${t_}`);
          n.dataTransfer.effectAllowed = `move`;
          e.classList.add(`drag-src`);
        });
        e.addEventListener(`dragend`, () => e.classList.remove(`drag-src`));
      });
      racine.querySelectorAll(`.equip-slot`).forEach((e) => {
        let slot = e.dataset.slot;
        if (e.classList.contains(`rempli`)) {
          const ouvrir = () => {
            selection = { slot };
            i();
          };
          e.addEventListener(`click`, ouvrir);
          e.addEventListener(`keydown`, (ev) => {
            if (ev.key === `Enter` || ev.key === ` `) {
              ev.preventDefault();
              ouvrir();
            }
          });
          e.addEventListener(`dblclick`, () => h(slot));
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
            // déposé sur un emplacement précis (utile pour choisir l'anneau à remplacer)
            const idx = Number(n.slice(4));
            m(idx, emplacementPossible(s, t[idx], slot) ? slot : undefined);
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
      // fiche ouverte
      document.querySelectorAll(`[data-fermer-fiche]`).forEach((b) =>
        b.addEventListener(`click`, () => {
          selection = null;
          i();
        }),
      );
      document.querySelectorAll(`[data-equiper-sur]`).forEach((b) =>
        b.addEventListener(`click`, () => {
          const idx = Number(b.dataset.equiperSur);
          const index = t.indexOf(selection.inst);
          if (index >= 0) {
            equiperObjet(t, e[idx], index, b.dataset.emplacement || undefined);
          }
          r = idx;
          selection = null;
          i();
        }),
      );
      document
        .querySelector(`[data-retirer]`)
        ?.addEventListener(`click`, (ev) => h(ev.currentTarget.dataset.retirer));
      document.querySelector(`.fiche-fermer`)?.focus({ preventScroll: true });
      document.getElementById(`equip-retour`)?.addEventListener(`click`, () => {
        document.removeEventListener(`keydown`, echap, true);
        document.getElementById(`fiche-equip`)?.remove();
        resolve();
      });
      let _ = racine.querySelector(`.equip-inv`);
      if (_) {
        _.scrollTop = a;
      }
      if (document.scrollingElement) {
        document.scrollingElement.scrollTop = o;
      }
    };
    // Échap ferme d'abord la fiche ouverte (sans quitter l'écran) : écouté en phase de capture
    const echap = (ev) => {
      if (ev.key === `Escape` && selection) {
        ev.preventDefault();
        ev.stopPropagation();
        selection = null;
        i();
      }
    };
    document.addEventListener(`keydown`, echap, true);
    i();
  });
}
