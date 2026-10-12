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
import {
  comparerObjet,
  equiperMeilleur,
  planEquiper,
  grouperInventaire,
  nomEffet,
} from "../../jeu/inventaire.js";
import { PA_MAX_EQUIPEMENT } from "../../jeu/emplacements.js";
import { afficherBandeau } from "./succes.js";
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
  htmlDeltas,
  htmlNomObjet,
  imgObjet,
  imgSymboleClasse,
  photoEquipement,
  racine,
  restaurerEquipement,
  htmlMetaObjet,
  NOMS_ELEMENTS,
  NOMS_STATS,
} from "../commun.js";
let triArmurerie = `toile`;
let filtreSlot = `tout`;
const ORDRE_VERDICT = [`mieux`, `mitige`, `egal`, `moins`, `impossible`];
const TRIS = [
  [`toile`, `Tier`, `Trier par Tier (toile d'obtention), les plus hauts d'abord`],
  [`type`, `Type`, `Trier par emplacement`],
  [`rarete`, `Rareté`, `Légendaires d'abord`],
  [`interet`, `Intérêt`, `Le plus gros gain chiffré d'abord, tous héros confondus`],
];
function trierGroupes(groupes, perso) {
  const nom = (inst) => EQUIPEMENTS[inst.id]?.nom ?? inst.id;
  const slot = (inst) => SLOTS.indexOf(EQUIPEMENTS[inst.id]?.slot ?? `arme`);
  const toile = (inst) => numeroZoneObjet(inst.id);
  const rarete = (inst) => -RARETES.indexOf(inst.rarete);
  const interet = (g) => g.meilleurScore;
  const criteres = {
    toile: (a, b) => [
      toile(b.inst) - toile(a.inst),
      rarete(a.inst) - rarete(b.inst),
      slot(a.inst) - slot(b.inst),
    ],
    type: (a, b) => [slot(a.inst) - slot(b.inst), toile(a.inst) - toile(b.inst)],
    rarete: (a, b) => [rarete(a.inst) - rarete(b.inst), toile(b.inst) - toile(a.inst)],
    interet: (a, b) => [
      interet(b) - interet(a),
      ORDRE_VERDICT.indexOf(a.comparaison.verdict) - ORDRE_VERDICT.indexOf(b.comparaison.verdict),
      toile(b.inst) - toile(a.inst),
    ],
  }[triArmurerie];
  return groupes.sort(
    (a, b) => criteres(a, b).find((x) => x !== 0) ?? nom(a.inst).localeCompare(nom(b.inst)),
  );
}
const nomClasse = (perso) => CLASSES[perso.classeId].nom;
const signe = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : `±0`);
// Un objet « mieux » qui n'ajoute ni PA ni dégâts n'est pas équipé d'office : on le dit au lieu
// d'afficher un « mieux » trompeur.
const TEXTE_COURT_PAS_SUR = `sans dégâts en plus`;
const TEXTE_PAS_SUR = `Meilleur en stats de survie, mais il n'ajoute ni PA ni dégâts : « Équiper le meilleur » ne le met pas. À toi de voir.`;
// Verdict d'une comparaison ; un « mitigé » est chiffré : plutôt mieux ou plutôt moins.
function htmlVerdict(c) {
  const v = VERDICTS[c.verdict];
  if (c.verdict === `mieux` && !c.sure) {
    return `<span class="verdict verdict-mitige tendance-moins" data-tip="${TEXTE_PAS_SUR}">${v.icone} Mieux en stats, mais ${TEXTE_COURT_PAS_SUR}</span>`;
  }
  if (c.verdict === `mitige` && c.score) {
    const texte = c.tendance === `plus` ? `Plutôt mieux` : `Plutôt moins`;
    return `<span class="verdict verdict-mitige tendance-${c.tendance}" data-tip="Gains et pertes : bilan chiffré ${signe(c.score)}">${v.icone} ${texte} (${signe(c.score)})</span>`;
  }
  return `<span class="verdict verdict-${c.verdict}">${v.icone} ${v.texte}</span>`;
}
// Deltas de stats, puis effets spéciaux gagnés (+ riposte) ou perdus (− riposte).
function htmlDeltasObjet(deltas) {
  const stats = htmlDeltas(deltas.filter((d) => !d.cle.startsWith(`effet_`)));
  const effets = deltas
    .filter((d) => d.cle.startsWith(`effet_`))
    .map(
      (d) =>
        `<span class="${d.valeur > 0 ? `delta-plus` : `delta-moins`} delta-effet">${d.valeur > 0 ? `+` : `−`} ${echapperHtml(nomEffet(d.cle.slice(6)))}</span>`,
    )
    .join(` `);
  return [stats, effets].filter(Boolean).join(` `);
}
// Priorité d'affichage d'un delta : PA, dégâts d'arme, effets, stats utiles, puis PV, résistances, le reste.
function prioriteDelta(d) {
  if (d.cle === `pa`) {
    return 0;
  }
  if (d.cle === `attaque`) {
    return 1;
  }
  if (d.cle.startsWith(`effet_`)) {
    return 2;
  }
  if (!d.utile) {
    return 9;
  }
  if (d.cle === `prospection`) {
    return 8;
  }
  if (d.cle === `pv`) {
    return 6;
  }
  return d.cle.startsWith(`res_`) ? 7 : 4;
}
// Les `max` changements les plus importants (PA et dégâts en tête), le reste en « +N autres ».
function htmlDeltasCompacts(deltas, max = 4) {
  const tries = [...deltas].sort(
    (a, b) => prioriteDelta(a) - prioriteDelta(b) || Math.abs(b.valeur) - Math.abs(a.valeur),
  );
  const visibles = tries.slice(0, max);
  const reste = tries.slice(max);
  const un = (d) => {
    const html = htmlDeltasObjet([d]);
    return d.cle === `pa` || d.cle === `attaque` ? `<b class="delta-cle">${html}</b>` : html;
  };
  const autres = reste.length
    ? ` <span class="delta-autres" data-tip="${echapperHtml(reste.map((d) => htmlDeltasObjet([d]).replace(/<[^>]+>/g, ``)).join(`, `))}">+${reste.length} autre${reste.length > 1 ? `s` : ``}</span>`
    : ``;
  return visibles.map(un).join(` `) + autres;
}
// Verdict en deux mots pour les cartes (le détail chiffré est dans la fiche).
function htmlVerdictCourt(c) {
  const v = VERDICTS[c.verdict];
  if (c.verdict === `mieux` && !c.sure) {
    return `<span class="verdict verdict-mitige tendance-moins" data-tip="${TEXTE_PAS_SUR}">${v.icone} ${TEXTE_COURT_PAS_SUR}</span>`;
  }
  const texte =
    c.verdict === `mieux`
      ? `Mieux`
      : c.verdict === `moins`
        ? `Moins`
        : c.verdict === `mitige`
          ? c.tendance === `plus`
            ? `Plutôt mieux`
            : `Plutôt moins`
          : v.texte;
  return `<span class="verdict verdict-${c.verdict}${c.tendance ? ` tendance-${c.tendance}` : ``}" title="${v.texte}${c.score ? ` (${signe(c.score)})` : ``}">${v.icone} ${texte}</span>`;
}
// Progression de panoplie qu'apporterait un objet pour ce héros : « ⬡ Rat Blanc 1→2/7 », palier atteint ou non.
function htmlPanoCarte(inst, perso) {
  const nom = EQUIPEMENTS[inst.id]?.panoplie;
  if (!nom) {
    return ``;
  }
  const portees = Object.values(perso.equipement).filter(Boolean);
  const nb = compterPanoplies(perso)[nom] ?? 0;
  const dejaPorte = portees.some((x) => x.id === inst.id);
  const court = nom.replace(/^Panoplie (du |de la |de l'|des |de |d')?/i, ``);
  if (dejaPorte) {
    return `<span class="ic-pano">⬡ ${echapperHtml(court)} ${nb}/${taillePanoplie(nom)}</span>`;
  }
  const apres = nb + 1;
  const palier = paliersPanoplie(nom).includes(apres);
  const bonus = palier ? bonusPanoplie(nom, apres) : null;
  return `<span class="ic-pano${palier ? ` palier` : ``}" data-tip="${echapperHtml(nom)}">⬡ ${echapperHtml(court)} ${nb}→${apres}/${taillePanoplie(nom)}${bonus ? ` : ${texteBonusPanoplie(bonus).replace(/\+(\d+) PA/, `<b class="pano-pa">+$1 PA</b>`)}` : ``}</span>`;
}
function htmlComparaison(c) {
  if (c.verdict === `impossible`) {
    return `<span class="item-delta"><span class="delta-ref">Équipable seulement en ligne avant.</span></span>`;
  }
  const ref = c.actuel
    ? `À la place de ${echapperHtml(EQUIPEMENTS[c.actuel.id]?.nom ?? c.actuel.id)} (T${numeroZoneObjet(c.actuel.id)})`
    : `Emplacement vide`;
  return `<span class="item-delta"><span class="delta-ref">${ref} :</span> ${htmlDeltasObjet(c.deltas) || `<span class="muet">aucun changement de stats</span>`}</span>`;
}
// « Bonus total » avec le vrai signe (−10 Agilité, pas +-10) et les PA d'équipement.
const NOMS_BONUS = { ...NOMS_STATS, crit: `% Critique` };
// Pastilles du « Bonus total » (PA d'abord).
function htmlBonusTotal(b) {
  const pastille = (cls, texte) => `<span class="ichip ${cls}">${texte}</span>`;
  const r = [];
  if (b.paBonus) {
    r.push(pastille(`ichip-pa`, `${signe(b.paBonus)} PA`));
  }
  if (b.pvBonus) {
    r.push(pastille(`ichip-vitalite`, `${signe(b.pvBonus)} PV`));
  }
  for (const [k, v] of Object.entries(b.stats)) {
    if (v) {
      r.push(pastille(`ichip-${k}${v < 0 ? ` malus` : ``}`, `${signe(v)} ${NOMS_BONUS[k] ?? k}`));
    }
  }
  for (const [el, v] of Object.entries(b.resistances)) {
    if (v) {
      r.push(
        pastille(
          `ichip-res elem-${el}${v < 0 ? ` malus` : ``}`,
          `${signe(Math.round(v * 100))} % ${NOMS_ELEMENTS[el] ?? el}`,
        ),
      );
    }
  }
  return r.length ? r.join(``) : `<span class="muet">aucun bonus</span>`;
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
             ${htmlVerdict(c)}
             <span class="fiche-heros-detail">${c.verdict === `impossible` ? `Équipable seulement en ligne avant.` : `${actuel} : ${htmlDeltasCompacts(c.deltas, 6) || `aucun changement de stats`}`}</span>
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
          <span class="muet ic-meta">${htmlMetaObjet(inst)}${def.panoplie ? ` · ⬡ ${echapperHtml(def.panoplie)}` : ``}</span>
        </div>
        <button class="fiche-fermer" data-fermer-fiche aria-label="Fermer">✕</button>
      </div>
      <div class="fiche-chips">${htmlChipsObjet(inst, perso.classeId)}</div>
      ${lignesHeros}
      <details class="fiche-obtention"><summary>Où le trouver</summary><p>${echapperHtml(texteObtentionObjet(inst.id)).replace(/\n/g, `<br>`)}</p></details>
    </section>`;
}
export function ecranEquipement(e, t) {
  // à chaque ouverture, le filtre repart sur « Tout » (le tri, lui, est gardé)
  filtreSlot = `tout`;
  return new Promise((resolve) => {
    let r = 0;
    // PC : un clic ouvre la fiche après un court délai, annulé par un double-clic (équiper/retirer)
    let minuterieClic = null;
    // objet ouvert dans la fiche : { inst } (inventaire) ou { slot } (porté)
    let selection = null;
    let messageAuto = ``;
    // photo de l'équipement avant « Équiper le meilleur » : sert au bouton Annuler (un seul rendu)
    let annulerAuto = null;
    // élément qui a ouvert la fiche : le focus lui revient à la fermeture (clavier, lecteur d'écran)
    let origineFiche = null;
    // sélecteur retrouvant un élément après un redessin (identifiant ou attribut data-*)
    const cleFocus = (el) => {
      if (!el) {
        return null;
      }
      if (el.id) {
        return `#${el.id}`;
      }
      for (const attr of [`index`, `slot`, `filtre`, `tri`, `perso`]) {
        if (el.dataset?.[attr] !== undefined) {
          return `[data-${attr}="${el.dataset[attr]}"]`;
        }
      }
      return null;
    };
    let i = () => {
      // l'élément qui a le focus : dans la fiche, c'est celui qui l'a ouverte
      const actif = document.activeElement;
      const dansFiche = !!actif?.closest?.(`#fiche-equip`);
      const cleActif = dansFiche
        ? origineFiche
        : racine.contains(actif)
          ? cleFocus(actif.closest?.(`button, [role="button"]`))
          : null;
      const photoAnnul = annulerAuto;
      annulerAuto = null;
      let a = racine.querySelector(`.equip-inv`)?.scrollTop ?? 0;
      let o = document.scrollingElement?.scrollTop ?? 0;
      let s = e[r];
      clearTimeout(minuterieClic);
      let groupes = grouperInventaire(t).map((g) => {
        const scores = e
          .map((p) => comparerObjet(g.inst, p))
          .filter((c) => c.verdict !== `impossible`)
          .map((c) => c.score);
        return {
          ...g,
          comparaison: comparerObjet(g.inst, s),
          meilleurScore: scores.length ? Math.max(...scores) : -Infinity,
        };
      });
      const plan = planEquiper({ inventaire: t }, e);
      let c = e
        .map((p, idx) => {
          const portes = EMPLACEMENTS.filter((slot) => p.equipement[slot]).length;
          const ameliorations = plan.filter((m) => m.perso === p).length;
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
        const mieux = plan.some((m) => m.perso === s && m.emplacement === slot);
        return n && inst
          ? `<div class="equip-slot rempli${classeRarete(inst)}" data-slot="${slot}" data-desequip="${slot}" draggable="true" role="button" tabindex="0" aria-label="${NOMS_EMPLACEMENTS[slot]} : ${echapperHtml(n.nom)}, voir la fiche" title="${echapperHtml(n.nom)}">
              <span class="ic-visuel"><img src="${imgObjet(n.id)}" alt="" onerror="this.remove()" />${mieux ? `<b class="slot-mieux" data-tip="Un objet de l'inventaire ferait mieux">▲</b>` : ``}</span>
              <span class="slot-nom">${NOMS_EMPLACEMENTS[slot]}</span>
              <span class="slot-objet ic-nom">${htmlNomObjet(inst)}</span>
              <b class="ic-tier">T${numeroZoneObjet(inst.id)}</b>
            </div>`
          : `<div class="equip-slot vide" data-slot="${slot}" role="button" tabindex="0" aria-label="${NOMS_EMPLACEMENTS[slot]} vide${dispo ? ` : objets disponibles` : ``}">
              <span class="ic-visuel">${dispo ? `<b class="slot-mieux" data-tip="Objet disponible dans l'inventaire">▲</b>` : ``}</span>
              <span class="slot-nom">${NOMS_EMPLACEMENTS[slot]}</span>
              <span class="slot-vide-txt">${dispo ? `à équiper` : `vide`}</span>
            </div>`;
      }).join(``);
      const compteSlot = (slot) => t.filter((inst) => EQUIPEMENTS[inst.id]?.slot === slot).length;
      // un filtre devenu vide (objet équipé, vendu) ne bloque pas l'inventaire : retour à « Tout »
      if (filtreSlot !== `tout` && compteSlot(filtreSlot) === 0) {
        filtreSlot = `tout`;
      }
      let filtres = [
        [`tout`, `Tout`, t.length],
        ...SLOTS.map((slot) => [slot, NOMS_SLOTS[slot], compteSlot(slot)]),
      ]
        .map(
          ([id, nom, n]) =>
            `<button class="filtre-btn${filtreSlot === id ? ` actif` : ``}" data-filtre="${id}" aria-pressed="${filtreSlot === id}" ${n || id === `tout` || filtreSlot === id ? `` : `disabled`}>${nom} <small>${n}</small></button>`,
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
              <span class="ic-visuel"><img src="${imgObjet(inst.id)}" alt="" loading="lazy" onerror="this.remove()" />${indices.length > 1 ? `<b class="ic-qte">×${indices.length}</b>` : ``}</span>
              <span class="ic-corps">
                <span class="ic-ligne1"><span class="ic-nom">${htmlNomObjet(inst)}</span>${possible ? htmlVerdictCourt(comparaison) : ``}</span>
                <span class="ic-meta">${htmlMetaObjet(inst)}</span>
                ${possible ? `<span class="ic-cmp">${comparaison.actuel ? `<span class="delta-ref" data-tip="Remplace ${echapperHtml(EQUIPEMENTS[comparaison.actuel.id]?.nom ?? comparaison.actuel.id)}">↔ ${echapperHtml(EQUIPEMENTS[comparaison.actuel.id]?.nom ?? comparaison.actuel.id)}</span>` : `<span class="delta-ref">Emplacement vide</span>`}<span class="ic-deltas">${htmlDeltasCompacts(comparaison.deltas) || `<span class="muet">aucun changement</span>`}</span></span>` : `<span class="ic-stats">${htmlChipsObjet(inst, s.classeId)}</span><span class="delta-ref">Équipable seulement en ligne avant.</span>`}
                ${htmlPanoCarte(inst, s)}${htmlBadgesHeros(inst, e, s)}
              </span>
            </button>`;
            })
            .join(``)
        : t.length
          ? `<p class="muet equip-vide">Aucun objet de ce type. <button class="secondaire petit" data-filtre="tout">Voir tout (${t.length})</button></p>`
          : ``; // inventaire vide : le message « sac vide » est affiché plus bas, une seule fois
      let f = bonusEquipement(s);
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
      const nbAuto = plan.length;
      const boutonAuto = `<button id="equip-auto" class="primaire petit"${nbAuto ? `` : ` disabled`} title="${nbAuto ? `Équipe sur chaque héros les objets qui font gagner des PA (objet ou panoplie qui se complète) ou des dégâts, sans en faire perdre` : `Rien à améliorer dans l'inventaire pour le moment`}">⚡ Équiper le meilleur${nbAuto ? ` (${nbAuto})` : ``}</button>`;
      afficherEcran(`
        <h1>Équipement</h1>
        <div class="equip-onglets">${c}</div>
        <div class="equip-corps">
          <div class="equip-col">
            <h3 class="equip-titre-heros"><span>${echapperHtml(nomClasse(s))}</span>
              ${boutonAuto}
            </h3>
            <p class="equip-resume"><span class="resume-pa" data-tip="PA de base ${CLASSES[s.classeId].pa} + équipement ${f.paBonus} (max +${PA_MAX_EQUIPEMENT})"><b>${CLASSES[s.classeId].pa + f.paBonus}</b> PA <small>(équip. +${f.paBonus}/${PA_MAX_EQUIPEMENT})</small></span><span class="resume-pv"><b>${pvMaxPerso(s)}</b> PV max</span></p>
            ${messageAuto ? `<p class="equip-auto-msg" role="status">${messageAuto}${photoAnnul ? ` · <button id="equip-annuler" class="secondaire petit">Annuler</button>` : ``}</p>` : ``}
            <div class="equip-slots grille">${l}</div>
            ${Object.entries(compterPanoplies(s))
              .map(([nom, nb]) => {
                const b = bonusPanoplie(nom, nb);
                const taille = taillePanoplie(nom);
                const prochain = paliersPanoplie(nom).find((k) => k > nb);
                const avecPa = (txt) => txt.replace(/\+(\d+) PA/, `<b class="pano-pa">+$1 PA</b>`);
                const pastilles = Array.from(
                  { length: taille },
                  (_, k) => `<i class="${k < nb ? `on` : ``}"></i>`,
                ).join(``);
                const suite = prochain
                  ? `<span class="pano-suite">Encore ${prochain - nb} pièce${prochain - nb > 1 ? `s` : ``} : ${avecPa(texteBonusPanoplie(PANOPLIES[nom].paliers[prochain]))}</span>`
                  : `<span class="pano-suite">Panoplie au maximum</span>`;
                return `<div class="equip-pano${b ? ` complete` : ``}" data-tip="${echapperHtml(descriptionPanoplie(nom))}">
                  <span class="pano-tete"><span class="pano-nom">⬡ ${echapperHtml(nom)}</span><span class="pano-pastilles" aria-label="${nb} pièces sur ${taille}">${pastilles}</span><b class="pano-nb">${nb}/${taille}</b></span>
                  ${b ? `<span class="pano-actif">Actif (${b.palier} p.) : ${avecPa(texteBonusPanoplie(b))}</span>` : ``}
                  ${suite}
                </div>`;
              })
              .join(``)}
            <div class="equip-total"><span class="equip-total-titre">Bonus total</span><div class="ichips">${htmlBonusTotal(f)}</div></div>
          </div>
          <div class="equip-col equip-col-inv">
            <h3>Inventaire (${t.length})</h3>
            ${
              t.length
                ? `<div class="equip-outils">
              <div class="equip-filtres" role="group" aria-label="Filtrer par emplacement">${filtres}</div>
              <div class="equip-tri" role="group" aria-label="Trier">Tri :
                ${TRIS.map(([id, nom, aide]) => `<button class="tri-btn${triArmurerie === id ? ` actif` : ``}" data-tri="${id}" aria-pressed="${triArmurerie === id}" title="${aide}">${nom}</button>`).join(``)}
              </div>
            </div>
            <p class="equip-astuce muet">Les chiffres comparent chaque objet à ce que porte ${echapperHtml(nomClasse(s))}. ${ecranTactile() ? `Touche un objet : fiche et choix du héros.` : `Clic : fiche · double-clic : équiper · glisser-déposer possible.`}</p>`
                : `<p class="equip-vide muet">🎒 Ton sac est vide. Les objets viennent des combats, des coffres et de l'HDV : ils apparaîtront ici.</p>`
            }
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
      let m = (e, emplacement, confirmer = false) => {
        if (e >= 0 && e < t.length) {
          const inst = t[e];
          equiperObjet(t, s, e, emplacement);
          selection = null;
          i();
          if (confirmer && !t.includes(inst)) {
            afficherBandeau(`✓ ${EQUIPEMENTS[inst.id]?.nom ?? inst.id} équipé sur ${nomClasse(s)}`);
          }
        }
      };
      let h = (e, confirmer = false) => {
        const inst = s.equipement[e];
        desequiper(t, s, e);
        selection = null;
        i();
        if (confirmer && inst) {
          afficherBandeau(`↩ ${EQUIPEMENTS[inst.id]?.nom ?? inst.id} retiré (dans l'inventaire)`);
        }
      };
      // clic simple : fiche tout de suite sur tactile, après 250 ms sur PC (laisse place au double-clic)
      const clicDiffere = (ouvrir) => {
        clearTimeout(minuterieClic);
        if (ecranTactile()) {
          ouvrir();
        } else {
          minuterieClic = setTimeout(ouvrir, 250);
        }
      };
      const doubleClic = (action) => {
        clearTimeout(minuterieClic);
        if (!ecranTactile()) {
          action();
        }
      };
      document.getElementById(`equip-auto`)?.addEventListener(`click`, () => {
        const photo = photoEquipement({ inventaire: t, persos: e });
        const n = equiperMeilleur({ inventaire: t, persos: e });
        messageAuto = n
          ? `✓ ${n} objet${n > 1 ? `s` : ``} équipé${n > 1 ? `s` : ``} (PA et dégâts d'abord ; les échanges douteux restent à ton choix).`
          : `Rien à améliorer.`;
        annulerAuto = n ? photo : null;
        selection = null;
        i();
        messageAuto = ``;
      });
      // Annuler : remet les anciens objets (échanges de planEquiper : `remplace`) comme avant
      document.getElementById(`equip-annuler`)?.addEventListener(`click`, () => {
        restaurerEquipement({ inventaire: t, persos: e }, photoAnnul);
        messageAuto = `↩ Équipement remis comme avant.`;
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
      racine.querySelectorAll(`.equip-slot.vide`).forEach((b) => {
        b.addEventListener(`click`, () => {
          filtreSlot = typeDeEmplacement(b.dataset.slot);
          i();
          racine
            .querySelector(`.equip-outils`)
            ?.scrollIntoView({ block: `start`, behavior: `smooth` });
        });
        // clavier : Entrée et Espace font comme le clic
        b.addEventListener(`keydown`, (ev) => {
          if (ev.key === `Enter` || ev.key === ` `) {
            ev.preventDefault();
            b.click();
          }
        });
      });
      racine.querySelectorAll(`.item-carte`).forEach((e) => {
        let t_ = Number(e.dataset.index);
        e.addEventListener(`click`, (ev) => {
          // clavier (Entrée) : pas de double-clic possible, ouverture immédiate
          origineFiche = cleFocus(e);
          if (ev.detail === 0) {
            selection = { inst: t[t_] };
            i();
            return;
          }
          if (ev.detail > 1) {
            return;
          }
          clicDiffere(() => {
            selection = { inst: t[t_] };
            i();
          });
        });
        e.addEventListener(`dblclick`, () => doubleClic(() => m(t_, undefined, true)));
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
            origineFiche = cleFocus(e);
            selection = { slot };
            i();
          };
          e.addEventListener(`click`, (ev) => {
            if (ev.detail > 1) {
              return;
            }
            clicDiffere(ouvrir);
          });
          e.addEventListener(`keydown`, (ev) => {
            if (ev.key === `Enter` || ev.key === ` `) {
              ev.preventDefault();
              ouvrir();
            }
          });
          e.addEventListener(`dblclick`, () => doubleClic(() => h(slot, true)));
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
      if (fiche) {
        document.querySelector(`.fiche-fermer`)?.focus({ preventScroll: true });
      } else if (photoAnnul && messageAuto) {
        document.getElementById(`equip-annuler`)?.focus({ preventScroll: true });
      } else if (cleActif) {
        // le redessin a détruit l'élément : on rend le focus à son remplaçant (ou à l'onglet du héros)
        const cible = racine.querySelector(cleActif) ?? racine.querySelector(`.equip-onglet.sel`);
        cible?.focus({ preventScroll: true });
      }
      document.getElementById(`equip-retour`)?.addEventListener(`click`, () => {
        clearTimeout(minuterieClic);
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
