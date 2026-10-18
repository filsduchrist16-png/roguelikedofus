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
  emplacementCible,
  emplacementPossible,
  equiperObjet,
  peutEquiper,
  pvMaxPerso,
} from "../../jeu/run.js";
import { emplacementsDuType, typeDeEmplacement } from "../../jeu/emplacements.js";
import { numeroZoneObjet } from "../../jeu/economie.js";
import { RARETES } from "../../jeu/config.js";
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
  comportementDefilement,
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
  parametres,
} from "../commun.js";
import { htmlReliquesRun } from "./choixRecompense.js";
import {
  basculerFavori,
  estFavori,
  normaliserFiltreInventaire,
  normaliserTriInventaire,
  sauverParametres,
} from "../../sauvegarde/parametres.js";
// tri et filtre gardés dans les réglages : retrouvés à la prochaine ouverture (et session)
let triArmurerie = normaliserTriInventaire(parametres.triInventaire);
let filtreSlot = normaliserFiltreInventaire(parametres.filtreInventaire);
const memoriserTriFiltre = () => {
  parametres.triInventaire = triArmurerie;
  parametres.filtreInventaire = filtreSlot;
  sauverParametres(parametres);
};
// inventaire long : les cartes s'affichent par pages (le reste d'un appui)
export const TAILLE_PAGE_INVENTAIRE = 12;
// Nombre de cartes à afficher : une page de plus à chaque « Afficher plus », jamais moins qu'une page.
export const cartesAffichees = (total, pages, taille = TAILLE_PAGE_INVENTAIRE) =>
  Math.min(total, Math.max(1, Math.trunc(pages) || 1) * taille);
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
  const interet = (groupe) => groupe.meilleurScore;
  const criteres = {
    toile: (premier, second) => [
      toile(second.inst) - toile(premier.inst),
      rarete(premier.inst) - rarete(second.inst),
      slot(premier.inst) - slot(second.inst),
    ],
    type: (premier, second) => [
      slot(premier.inst) - slot(second.inst),
      toile(premier.inst) - toile(second.inst),
    ],
    rarete: (premier, second) => [
      rarete(premier.inst) - rarete(second.inst),
      toile(second.inst) - toile(premier.inst),
    ],
    interet: (premier, second) => [
      interet(second) - interet(premier),
      ORDRE_VERDICT.indexOf(premier.comparaison.verdict) -
        ORDRE_VERDICT.indexOf(second.comparaison.verdict),
      toile(second.inst) - toile(premier.inst),
    ],
  }[triArmurerie];
  return groupes.sort(
    (premier, second) =>
      criteres(premier, second).find((ecart) => ecart !== 0) ??
      nom(premier.inst).localeCompare(nom(second.inst)),
  );
}
const nomClasse = (perso) => CLASSES[perso.classeId].nom;
const signe = (nombre) => (nombre > 0 ? `+${nombre}` : nombre < 0 ? `−${Math.abs(nombre)}` : `±0`);
// Un objet « mieux » qui n'ajoute ni PA ni dégâts n'est pas équipé d'office : on le dit au lieu
// d'afficher un « mieux » trompeur.
const TEXTE_COURT_PAS_SUR = `sans dégâts en plus`;
const TEXTE_PAS_SUR = `Meilleur en stats de survie, mais il n'ajoute ni PA ni dégâts : « Équiper le meilleur » ne le met pas. À toi de voir.`;
// Verdict d'une comparaison ; un « mitigé » est chiffré : plutôt mieux ou plutôt moins.
function htmlVerdict(comparaison) {
  const verdict = VERDICTS[comparaison.verdict];
  if (comparaison.verdict === `mieux` && !comparaison.sure) {
    return `<span class="verdict verdict-mitige tendance-moins" data-tip="${TEXTE_PAS_SUR}">${verdict.icone} Mieux en stats, mais ${TEXTE_COURT_PAS_SUR}</span>`;
  }
  if (comparaison.verdict === `mitige` && comparaison.score) {
    const texte = comparaison.tendance === `plus` ? `Plutôt mieux` : `Plutôt moins`;
    return `<span class="verdict verdict-mitige tendance-${comparaison.tendance}" data-tip="Gains et pertes : bilan chiffré ${signe(comparaison.score)}">${verdict.icone} ${texte} (${signe(comparaison.score)})</span>`;
  }
  return `<span class="verdict verdict-${comparaison.verdict}">${verdict.icone} ${verdict.texte}</span>`;
}
// Deltas de stats, puis effets spéciaux gagnés (+ riposte) ou perdus (− riposte).
function htmlDeltasObjet(deltas) {
  const stats = htmlDeltas(deltas.filter((delta) => !delta.cle.startsWith(`effet_`)));
  const effets = deltas
    .filter((delta) => delta.cle.startsWith(`effet_`))
    .map(
      (delta) =>
        `<span class="${delta.valeur > 0 ? `delta-plus` : `delta-moins`} delta-effet">${delta.valeur > 0 ? `+` : `−`} ${echapperHtml(nomEffet(delta.cle.slice(6)))}</span>`,
    )
    .join(` `);
  return [stats, effets].filter(Boolean).join(` `);
}
// Priorité d'affichage d'un delta : PA, dégâts d'arme, effets, stats utiles, puis PV, résistances, le reste.
function prioriteDelta(delta) {
  if (delta.cle === `pa`) {
    return 0;
  }
  if (delta.cle === `attaque`) {
    return 1;
  }
  if (delta.cle.startsWith(`effet_`)) {
    return 2;
  }
  if (!delta.utile) {
    return 9;
  }
  if (delta.cle === `prospection`) {
    return 8;
  }
  if (delta.cle === `pv`) {
    return 6;
  }
  return delta.cle.startsWith(`res_`) ? 7 : 4;
}
// Les `max` changements les plus importants (PA et dégâts en tête), le reste en « +N autres ».
function htmlDeltasCompacts(deltas, max = 4) {
  const tries = [...deltas].sort(
    (premier, second) =>
      prioriteDelta(premier) - prioriteDelta(second) ||
      Math.abs(second.valeur) - Math.abs(premier.valeur),
  );
  const visibles = tries.slice(0, max);
  const reste = tries.slice(max);
  const un = (delta) => {
    const html = htmlDeltasObjet([delta]);
    return delta.cle === `pa` || delta.cle === `attaque`
      ? `<b class="delta-cle">${html}</b>`
      : html;
  };
  const autres = reste.length
    ? ` <span class="delta-autres" data-tip="${echapperHtml(reste.map((delta) => htmlDeltasObjet([delta]).replace(/<[^>]+>/g, ``)).join(`, `))}">+${reste.length} autre${reste.length > 1 ? `s` : ``}</span>`
    : ``;
  return visibles.map(un).join(` `) + autres;
}
// Verdict en deux mots pour les cartes (le détail chiffré est dans la fiche).
function htmlVerdictCourt(comparaison) {
  const verdict = VERDICTS[comparaison.verdict];
  if (comparaison.verdict === `mieux` && !comparaison.sure) {
    return `<span class="verdict verdict-mitige tendance-moins" data-tip="${TEXTE_PAS_SUR}">${verdict.icone} ${TEXTE_COURT_PAS_SUR}</span>`;
  }
  const texte =
    comparaison.verdict === `mieux`
      ? `Mieux`
      : comparaison.verdict === `moins`
        ? `Moins`
        : comparaison.verdict === `mitige`
          ? comparaison.tendance === `plus`
            ? `Plutôt mieux`
            : `Plutôt moins`
          : verdict.texte;
  return `<span class="verdict verdict-${comparaison.verdict}${comparaison.tendance ? ` tendance-${comparaison.tendance}` : ``}" title="${verdict.texte}${comparaison.score ? ` (${signe(comparaison.score)})` : ``}">${verdict.icone} ${texte}</span>`;
}
// Progression de panoplie qu'apporterait un objet pour ce héros : « ⬡ Rat Blanc 1→2/7 », palier atteint ou non.
function htmlPanoCarte(inst, perso) {
  const nom = EQUIPEMENTS[inst.id]?.panoplie;
  if (!nom) {
    return ``;
  }
  const portees = Object.values(perso.equipement).filter(Boolean);
  const nb = compterPanoplies(perso)[nom] ?? 0;
  const dejaPorte = portees.some((piece) => piece.id === inst.id);
  const court = nom.replace(/^Panoplie (du |de la |de l'|des |de |d')?/i, ``);
  if (dejaPorte) {
    return `<span class="ic-pano">⬡ ${echapperHtml(court)} ${nb}/${taillePanoplie(nom)}</span>`;
  }
  const apres = nb + 1;
  const palier = paliersPanoplie(nom).includes(apres);
  const bonus = palier ? bonusPanoplie(nom, apres) : null;
  return `<span class="ic-pano${palier ? ` palier` : ``}" data-tip="${echapperHtml(nom)}">⬡ ${echapperHtml(court)} ${nb}→${apres}/${taillePanoplie(nom)}${bonus ? ` : ${texteBonusPanoplie(bonus).replace(/\+(\d+) PA/, `<b class="pano-pa">+$1 PA</b>`)}` : ``}</span>`;
}
function htmlComparaison(comparaison) {
  if (comparaison.verdict === `impossible`) {
    return `<span class="item-delta"><span class="delta-ref">Équipable seulement en ligne avant.</span></span>`;
  }
  const ref = comparaison.actuel
    ? `À la place de ${echapperHtml(EQUIPEMENTS[comparaison.actuel.id]?.nom ?? comparaison.actuel.id)} (T${numeroZoneObjet(comparaison.actuel.id)})`
    : `Emplacement vide`;
  return `<span class="item-delta"><span class="delta-ref">${ref} :</span> ${htmlDeltasObjet(comparaison.deltas) || `<span class="muet">aucun changement de stats</span>`}</span>`;
}
// « Bonus total » avec le vrai signe (−10 Agilité, pas +-10) et les PA d'équipement.
const NOMS_BONUS = { ...NOMS_STATS, crit: `% Critique` };
// Pastilles du « Bonus total » (PA d'abord).
function htmlBonusTotal(bonus) {
  const pastille = (cls, texte) => `<span class="ichip ${cls}">${texte}</span>`;
  const pastilles = [];
  if (bonus.paBonus) {
    pastilles.push(pastille(`ichip-pa`, `${signe(bonus.paBonus)} PA`));
  }
  if (bonus.pvBonus) {
    pastilles.push(pastille(`ichip-vitalite`, `${signe(bonus.pvBonus)} PV`));
  }
  for (const [stat, valeur] of Object.entries(bonus.stats)) {
    if (valeur) {
      pastilles.push(
        pastille(
          `ichip-${stat}${valeur < 0 ? ` malus` : ``}`,
          `${signe(valeur)} ${NOMS_BONUS[stat] ?? stat}`,
        ),
      );
    }
  }
  for (const [el, valeur] of Object.entries(bonus.resistances)) {
    if (valeur) {
      pastilles.push(
        pastille(
          `ichip-res elem-${el}${valeur < 0 ? ` malus` : ``}`,
          `${signe(Math.round(valeur * 100))} % ${NOMS_ELEMENTS[el] ?? el}`,
        ),
      );
    }
  }
  return pastilles.length ? pastilles.join(``) : `<span class="muet">aucun bonus</span>`;
}
// ★ Favori : jamais vendu par « Vendre l'inutile » ni « Vendre tout » à l'HDV.
function htmlBoutonFavori(inst) {
  const favori = estFavori(parametres.favoris, inst);
  return `<div class="fiche-favori"><button class="secondaire petit${favori ? ` on` : ``}" data-favori aria-pressed="${favori}" title="Un favori n'est jamais vendu par les ventes groupées de l'HDV">${favori ? `★ Favori` : `☆ Marquer comme favori`}</button></div>`;
}
/**
 * Donne l'objet porté par `donneur` (emplacement) à `receveur`, en un geste : l'objet que le
 * receveur portait à cet endroit passe au donneur s'il peut le porter (échange), sinon il retourne
 * dans l'inventaire. Renvoie { inst, ancien, echange } ou null si le receveur ne peut pas le porter.
 */
export function donnerObjet(inventaire, donneur, emplacement, receveur) {
  const inst = donneur.equipement[emplacement];
  if (!inst || !receveur || receveur === donneur || !peutEquiper(receveur, inst.id)) {
    return null;
  }
  const cible = emplacementCible(receveur, inst);
  if (!cible || !emplacementPossible(receveur, inst, cible)) {
    return null;
  }
  const ancien = receveur.equipement[cible];
  delete donneur.equipement[emplacement];
  receveur.equipement[cible] = inst;
  let echange = false;
  if (ancien) {
    if (peutEquiper(donneur, ancien.id) && emplacementPossible(donneur, ancien, emplacement)) {
      donneur.equipement[emplacement] = ancien;
      echange = true;
    } else {
      inventaire.push(ancien);
    }
  }
  for (const heros of [donneur, receveur]) {
    heros.pvActuels = Math.min(heros.pvActuels, pvMaxPerso(heros));
  }
  return { inst, ancien, echange };
}
// Objet porté : ce qu'il changerait chez chacun des autres héros, et ce que le porteur recevrait en
// échange (l'objet que l'autre porte à cet endroit).
function htmlDonnerA(inst, persos, porteePar, emplacementPorte) {
  const autres = persos.filter((heros) => heros !== porteePar);
  if (!autres.length) {
    return ``;
  }
  const lignes = autres
    .map((heros) => {
      const comparaison = comparerObjet(inst, heros);
      const ancien = comparaison.actuel;
      const retour =
        ancien &&
        peutEquiper(porteePar, ancien.id) &&
        emplacementPossible(porteePar, ancien, emplacementPorte)
          ? comparerObjet(ancien, porteePar, emplacementPorte)
          : null;
      const nomAncien = ancien ? echapperHtml(EQUIPEMENTS[ancien.id]?.nom ?? ancien.id) : ``;
      const echange = ancien
        ? retour
          ? `${echapperHtml(nomClasse(porteePar))} reçoit ${nomAncien} : ${htmlDeltasCompacts(retour.deltas, 4) || `aucun changement`}`
          : `${nomAncien} retourne dans l'inventaire`
        : `emplacement vide`;
      const impossible = comparaison.verdict === `impossible`;
      return `<li>
        <span class="fiche-heros-nom"><img src="${imgSymboleClasse(heros.classeId)}" alt="" onerror="this.remove()" />${echapperHtml(nomClasse(heros))}</span>
        ${htmlVerdict(comparaison)}
        <span class="fiche-heros-detail">${impossible ? `Équipable seulement en ligne avant.` : `${htmlDeltasCompacts(comparaison.deltas, 6) || `aucun changement de stats`} · ${echange}`}</span>
        <span class="fiche-heros-boutons"><button class="secondaire" data-donner="${persos.indexOf(heros)}" ${impossible ? `disabled` : ``}>${ancien && retour ? `⇄ Échanger` : `➜ Donner`}</button></span>
      </li>`;
    })
    .join(``);
  return `<h4 class="fiche-sous-titre">Comparer et donner à un autre héros</h4><ul class="fiche-heros fiche-donner">${lignes}</ul>`;
}
// Fiche d'un objet : tout ce qu'il donne, d'où il vient, et ce qu'il changerait pour chaque héros.
function htmlFicheObjet(inst, persos, perso, porteePar, quantite, emplacementPorte) {
  const def = EQUIPEMENTS[inst.id];
  // pour un anneau : proposer aussi de remplacer l'autre anneau porté
  const autreAnneau = (heros, comparaison) => {
    const autre = emplacementsDuType(def.slot).find(
      (emplacement) => emplacement !== comparaison.emplacement,
    );
    if (
      !autre ||
      !heros.equipement[comparaison.emplacement] ||
      !emplacementPossible(heros, inst, autre)
    ) {
      return ``;
    }
    const porte = heros.equipement[autre];
    return `<button class="secondaire petit" data-equiper-sur="${persos.indexOf(heros)}" data-emplacement="${autre}">À la place de ${echapperHtml(EQUIPEMENTS[porte?.id]?.nom ?? NOMS_EMPLACEMENTS[autre])}</button>`;
  };
  const lignesHeros = porteePar
    ? `<p class="fiche-porte">Porté par <b>${echapperHtml(nomClasse(porteePar))}</b>${emplacementPorte && emplacementPorte !== def.slot ? ` (${NOMS_EMPLACEMENTS[emplacementPorte]})` : ``}.</p>
       <div class="fiche-actions"><button class="secondaire" data-retirer="${emplacementPorte ?? def.slot}">Retirer (retourne dans l'inventaire)</button></div>
       ${htmlDonnerA(inst, persos, porteePar, emplacementPorte ?? def.slot)}`
    : `<h4 class="fiche-sous-titre">Sur quel héros ?</h4>
       <ul class="fiche-heros">${persos
         .map((heros, indice) => {
           const comparaison = comparerObjet(inst, heros);
           const actuel = comparaison.actuel
             ? `remplace ${echapperHtml(EQUIPEMENTS[comparaison.actuel.id]?.nom ?? comparaison.actuel.id)}`
             : `emplacement vide`;
           return `<li class="${heros === perso ? `courant` : ``}">
             <span class="fiche-heros-nom"><img src="${imgSymboleClasse(heros.classeId)}" alt="" onerror="this.remove()" />${echapperHtml(nomClasse(heros))}</span>
             ${htmlVerdict(comparaison)}
             <span class="fiche-heros-detail">${comparaison.verdict === `impossible` ? `Équipable seulement en ligne avant.` : `${actuel} : ${htmlDeltasCompacts(comparaison.deltas, 6) || `aucun changement de stats`}`}</span>
             <span class="fiche-heros-boutons"><button class="primaire" data-equiper-sur="${indice}" data-emplacement="${comparaison.emplacement ?? ``}" ${comparaison.verdict === `impossible` ? `disabled` : ``}>Équiper</button>${comparaison.verdict === `impossible` ? `` : autreAnneau(heros, comparaison)}</span>
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
      ${htmlBoutonFavori(inst)}
      <div class="fiche-chips">${htmlChipsObjet(inst, perso.classeId)}</div>
      ${lignesHeros}
      <details class="fiche-obtention"><summary>Où le trouver</summary><p>${echapperHtml(texteObtentionObjet(inst.id)).replace(/\n/g, `<br>`)}</p></details>
    </section>`;
}
// reliques (facultatif) : reliques de run affichées sous le titre ({ icone, nom, desc }).
export function ecranEquipement(persos, inventaire, reliques = []) {
  // tri et filtre repris des réglages (une autre fenêtre a pu les changer)
  triArmurerie = normaliserTriInventaire(parametres.triInventaire);
  filtreSlot = normaliserFiltreInventaire(parametres.filtreInventaire);
  if (filtreSlot !== `tout` && !SLOTS.includes(filtreSlot)) {
    filtreSlot = `tout`;
  }
  return new Promise((resolve) => {
    let indexPerso = 0;
    // pages d'inventaire affichées (remises à une au changement de héros, de tri ou de filtre)
    let pages = 1;
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
    let afficher = () => {
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
      let scrollInv = racine.querySelector(`.equip-inv`)?.scrollTop ?? 0;
      let scrollPage = document.scrollingElement?.scrollTop ?? 0;
      let heros = persos[indexPerso];
      clearTimeout(minuterieClic);
      let groupes = grouperInventaire(inventaire).map((groupe) => {
        const scores = persos
          .map((perso) => comparerObjet(groupe.inst, perso))
          .filter((comparaison) => comparaison.verdict !== `impossible`)
          .map((comparaison) => comparaison.score);
        return {
          ...groupe,
          comparaison: comparerObjet(groupe.inst, heros),
          meilleurScore: scores.length ? Math.max(...scores) : -Infinity,
        };
      });
      const plan = planEquiper({ inventaire }, persos);
      let htmlOnglets = persos
        .map((membre, idx) => {
          const portes = EMPLACEMENTS.filter((slot) => membre.equipement[slot]).length;
          const ameliorations = plan.filter((amelioration) => amelioration.perso === membre).length;
          return `<button class="equip-onglet ${idx === indexPerso ? `sel` : ``}" data-perso="${idx}" aria-pressed="${idx === indexPerso}">
          <img src="${imgSymboleClasse(membre.classeId)}" alt="" onerror="this.remove()" />
          <span class="onglet-texte">${echapperHtml(nomClasse(membre))}<small>${portes}/${EMPLACEMENTS.length} équipés${ameliorations ? ` · <b class="onglet-mieux">▲ ${ameliorations}</b>` : ``}</small></span></button>`;
        })
        .join(``);
      // les 8 emplacements en grille compacte : icône, emplacement, Tier ; la fiche donne le détail
      let htmlSlots = EMPLACEMENTS.map((slot) => {
        let inst = heros.equipement[slot];
        let def = inst ? EQUIPEMENTS[inst.id] : undefined;
        const type = typeDeEmplacement(slot);
        const dispo = groupes.some(
          (groupe) =>
            EQUIPEMENTS[groupe.inst.id]?.slot === type &&
            groupe.comparaison.verdict !== `impossible`,
        );
        const mieux = plan.some(
          (amelioration) => amelioration.perso === heros && amelioration.emplacement === slot,
        );
        return def && inst
          ? `<div class="equip-slot rempli${classeRarete(inst)}" data-slot="${slot}" data-desequip="${slot}" draggable="true" role="button" tabindex="0" aria-label="${NOMS_EMPLACEMENTS[slot]} : ${echapperHtml(def.nom)}, voir la fiche" title="${echapperHtml(def.nom)}">
              <span class="ic-visuel"><img src="${imgObjet(def.id)}" alt="" onerror="this.remove()" />${mieux ? `<b class="slot-mieux" data-tip="Un objet de l'inventaire ferait mieux">▲</b>` : ``}</span>
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
      const compteSlot = (slot) =>
        inventaire.filter((inst) => EQUIPEMENTS[inst.id]?.slot === slot).length;
      // un filtre devenu vide (objet équipé, vendu) ne bloque pas l'inventaire : retour à « Tout »
      if (filtreSlot !== `tout` && compteSlot(filtreSlot) === 0) {
        filtreSlot = `tout`;
      }
      let filtres = [
        [`tout`, `Tout`, inventaire.length],
        ...SLOTS.map((slot) => [slot, NOMS_SLOTS[slot], compteSlot(slot)]),
      ]
        .map(
          ([id, nom, nb]) =>
            `<button class="filtre-btn${filtreSlot === id ? ` actif` : ``}" data-filtre="${id}" aria-pressed="${filtreSlot === id}" ${nb || id === `tout` || filtreSlot === id ? `` : `disabled`}>${nom} <small>${nb}</small></button>`,
        )
        .join(``);
      let visibles = trierGroupes(
        groupes.filter(
          (groupe) => filtreSlot === `tout` || EQUIPEMENTS[groupe.inst.id]?.slot === filtreSlot,
        ),
        heros,
      );
      const nbAffichees = cartesAffichees(visibles.length, pages);
      const restantes = visibles.length - nbAffichees;
      let htmlCartes = visibles.length
        ? visibles
            .slice(0, nbAffichees)
            .map(({ inst, indices, comparaison }) => {
              let def = EQUIPEMENTS[inst.id];
              let possible = comparaison.verdict !== `impossible`;
              return `<button class="item-carte ic${classeRarete(inst)}${possible ? `` : ` inequipable`}" data-index="${indices[0]}" draggable="${possible}" aria-label="${echapperHtml(def.nom)} : voir la fiche">
              <span class="ic-visuel"><img src="${imgObjet(inst.id)}" alt="" loading="lazy" onerror="this.remove()" />${indices.length > 1 ? `<b class="ic-qte">×${indices.length}</b>` : ``}</span>
              <span class="ic-corps">
                <span class="ic-ligne1"><span class="ic-nom">${estFavori(parametres.favoris, inst) ? `<span class="ic-favori" aria-label="favori">★</span> ` : ``}${htmlNomObjet(inst)}</span>${possible ? htmlVerdictCourt(comparaison) : ``}</span>
                <span class="ic-meta">${htmlMetaObjet(inst)}</span>
                ${possible ? `<span class="ic-cmp">${comparaison.actuel ? `<span class="delta-ref" data-tip="Remplace ${echapperHtml(EQUIPEMENTS[comparaison.actuel.id]?.nom ?? comparaison.actuel.id)}">↔ ${echapperHtml(EQUIPEMENTS[comparaison.actuel.id]?.nom ?? comparaison.actuel.id)}</span>` : `<span class="delta-ref">Emplacement vide</span>`}<span class="ic-deltas">${htmlDeltasCompacts(comparaison.deltas) || `<span class="muet">aucun changement</span>`}</span></span>` : `<span class="ic-stats">${htmlChipsObjet(inst, heros.classeId)}</span><span class="delta-ref">Équipable seulement en ligne avant.</span>`}
                ${htmlPanoCarte(inst, heros)}${htmlBadgesHeros(inst, persos, heros)}
              </span>
            </button>`;
            })
            .join(``) +
          (restantes > 0
            ? `<button id="equip-plus" class="secondaire equip-plus">Afficher ${Math.min(restantes, TAILLE_PAGE_INVENTAIRE)} objet${Math.min(restantes, TAILLE_PAGE_INVENTAIRE) > 1 ? `s` : ``} de plus <small>(${restantes} restant${restantes > 1 ? `s` : ``})</small></button>`
            : ``)
        : inventaire.length
          ? `<p class="muet equip-vide">Aucun objet de ce type. <button class="secondaire petit" data-filtre="tout">Voir tout (${inventaire.length})</button></p>`
          : ``; // inventaire vide : le message « sac vide » est affiché plus bas, une seule fois
      let bonus = bonusEquipement(heros);
      let fiche = ``;
      if (selection?.inst && inventaire.includes(selection.inst)) {
        fiche = htmlFicheObjet(
          selection.inst,
          persos,
          heros,
          null,
          groupes.find((groupe) =>
            groupe.indices.some((indice) => inventaire[indice] === selection.inst),
          )?.indices.length ?? 1,
        );
      } else if (selection?.slot && heros.equipement[selection.slot]) {
        fiche = htmlFicheObjet(
          heros.equipement[selection.slot],
          persos,
          heros,
          heros,
          1,
          selection.slot,
        );
      } else {
        selection = null;
      }
      const nbAuto = plan.length;
      const boutonAuto = `<button id="equip-auto" class="primaire petit"${nbAuto ? `` : ` disabled`} title="${nbAuto ? `Équipe sur chaque héros les objets qui font gagner des PA (objet ou panoplie qui se complète) ou des dégâts, sans en faire perdre` : `Rien à améliorer dans l'inventaire pour le moment`}">⚡ Équiper le meilleur${nbAuto ? ` (${nbAuto})` : ``}</button>`;
      afficherEcran(`
        <h1>Équipement</h1>
        ${htmlReliquesRun(reliques)}
        <div class="equip-onglets">${htmlOnglets}</div>
        <div class="equip-corps">
          <div class="equip-col">
            <h3 class="equip-titre-heros"><span>${echapperHtml(nomClasse(heros))}</span>
              ${boutonAuto}
            </h3>
            <p class="equip-resume"><span class="resume-pa" data-tip="PA de base ${CLASSES[heros.classeId].pa} + équipement ${bonus.paBonus} (max +${PA_MAX_EQUIPEMENT})"><b>${CLASSES[heros.classeId].pa + bonus.paBonus}</b> PA <small>(équip. +${bonus.paBonus}/${PA_MAX_EQUIPEMENT})</small></span><span class="resume-pv"><b>${pvMaxPerso(heros)}</b> PV max</span></p>
            ${messageAuto ? `<p class="equip-auto-msg" role="status">${messageAuto}${photoAnnul ? ` · <button id="equip-annuler" class="secondaire petit">Annuler</button>` : ``}</p>` : ``}
            <div class="equip-slots grille">${htmlSlots}</div>
            ${Object.entries(compterPanoplies(heros))
              .map(([nom, nb]) => {
                const bonusActif = bonusPanoplie(nom, nb);
                const taille = taillePanoplie(nom);
                const prochain = paliersPanoplie(nom).find((seuil) => seuil > nb);
                const avecPa = (txt) => txt.replace(/\+(\d+) PA/, `<b class="pano-pa">+$1 PA</b>`);
                const pastilles = Array.from(
                  { length: taille },
                  (_palier, indice) => `<i class="${indice < nb ? `on` : ``}"></i>`,
                ).join(``);
                const suite = prochain
                  ? `<span class="pano-suite">Encore ${prochain - nb} pièce${prochain - nb > 1 ? `s` : ``} : ${avecPa(texteBonusPanoplie(PANOPLIES[nom].paliers[prochain]))}</span>`
                  : `<span class="pano-suite">Panoplie au maximum</span>`;
                return `<div class="equip-pano${bonusActif ? ` complete` : ``}" data-tip="${echapperHtml(descriptionPanoplie(nom))}">
                  <span class="pano-tete"><span class="pano-nom">⬡ ${echapperHtml(nom)}</span><span class="pano-pastilles" aria-label="${nb} pièces sur ${taille}">${pastilles}</span><b class="pano-nb">${nb}/${taille}</b></span>
                  ${bonusActif ? `<span class="pano-actif">Actif (${bonusActif.palier} p.) : ${avecPa(texteBonusPanoplie(bonusActif))}</span>` : ``}
                  ${suite}
                </div>`;
              })
              .join(``)}
            <div class="equip-total"><span class="equip-total-titre">Bonus total</span><div class="ichips">${htmlBonusTotal(bonus)}</div></div>
          </div>
          <div class="equip-col equip-col-inv">
            <h3>Inventaire (${inventaire.length})</h3>
            ${
              inventaire.length
                ? `<div class="equip-outils">
              <div class="equip-filtres" role="group" aria-label="Filtrer par emplacement">${filtres}</div>
              <div class="equip-tri" role="group" aria-label="Trier">Tri :
                ${TRIS.map(([id, nom, aide]) => `<button class="tri-btn${triArmurerie === id ? ` actif` : ``}" data-tri="${id}" aria-pressed="${triArmurerie === id}" title="${aide}">${nom}</button>`).join(``)}
              </div>
            </div>
            <p class="equip-astuce muet">Les chiffres comparent chaque objet à ce que porte ${echapperHtml(nomClasse(heros))}. ${ecranTactile() ? `Touche un objet : fiche et choix du héros.` : `Clic : fiche · double-clic : équiper · glisser-déposer possible.`}</p>`
                : `<p class="equip-vide muet">🎒 Ton sac est vide. Les objets viennent des combats, des coffres et de l'HDV : ils apparaîtront ici.</p>`
            }
            <div class="equip-inv">${htmlCartes}</div>
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
      let equiperIndex = (index, emplacement, confirmer = false) => {
        if (index >= 0 && index < inventaire.length) {
          const inst = inventaire[index];
          equiperObjet(inventaire, heros, index, emplacement);
          selection = null;
          afficher();
          if (confirmer && !inventaire.includes(inst)) {
            afficherBandeau(
              `✓ ${EQUIPEMENTS[inst.id]?.nom ?? inst.id} équipé sur ${nomClasse(heros)}`,
            );
          }
        }
      };
      let desequiperSlot = (emplacement, confirmer = false) => {
        const inst = heros.equipement[emplacement];
        desequiper(inventaire, heros, emplacement);
        selection = null;
        afficher();
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
        const photo = photoEquipement({ inventaire, persos });
        const nbEquipes = equiperMeilleur({ inventaire, persos });
        messageAuto = nbEquipes
          ? `✓ ${nbEquipes} objet${nbEquipes > 1 ? `s` : ``} équipé${nbEquipes > 1 ? `s` : ``} (PA et dégâts d'abord ; les échanges douteux restent à ton choix).`
          : `Rien à améliorer.`;
        annulerAuto = nbEquipes ? photo : null;
        selection = null;
        afficher();
        messageAuto = ``;
      });
      // Annuler : remet les anciens objets (échanges de planEquiper : `remplace`) comme avant
      document.getElementById(`equip-annuler`)?.addEventListener(`click`, () => {
        restaurerEquipement({ inventaire, persos }, photoAnnul);
        messageAuto = `↩ Équipement remis comme avant.`;
        selection = null;
        afficher();
        messageAuto = ``;
      });
      racine.querySelectorAll(`.equip-onglet`).forEach((onglet) =>
        onglet.addEventListener(`click`, () => {
          indexPerso = Number(onglet.dataset.perso);
          pages = 1;
          afficher();
        }),
      );
      racine.querySelectorAll(`[data-tri]`).forEach((bouton) =>
        bouton.addEventListener(`click`, () => {
          triArmurerie = normaliserTriInventaire(bouton.dataset.tri);
          pages = 1;
          memoriserTriFiltre();
          afficher();
        }),
      );
      racine.querySelectorAll(`[data-filtre]`).forEach((bouton) =>
        bouton.addEventListener(`click`, () => {
          filtreSlot = bouton.dataset.filtre;
          pages = 1;
          memoriserTriFiltre();
          afficher();
        }),
      );
      // emplacement vide : on filtre l'inventaire sur cet emplacement et on y descend
      racine.querySelectorAll(`.equip-slot.vide`).forEach((bouton) => {
        bouton.addEventListener(`click`, () => {
          filtreSlot = typeDeEmplacement(bouton.dataset.slot);
          pages = 1;
          memoriserTriFiltre();
          afficher();
          racine
            .querySelector(`.equip-outils`)
            ?.scrollIntoView({ block: `start`, behavior: comportementDefilement() });
        });
        // clavier : Entrée et Espace font comme le clic
        bouton.addEventListener(`keydown`, (ev) => {
          if (ev.key === `Enter` || ev.key === ` `) {
            ev.preventDefault();
            bouton.click();
          }
        });
      });
      racine.querySelectorAll(`.item-carte`).forEach((carte) => {
        let indexInv = Number(carte.dataset.index);
        carte.addEventListener(`click`, (ev) => {
          // clavier (Entrée) : pas de double-clic possible, ouverture immédiate
          origineFiche = cleFocus(carte);
          if (ev.detail === 0) {
            selection = { inst: inventaire[indexInv] };
            afficher();
            return;
          }
          if (ev.detail > 1) {
            return;
          }
          clicDiffere(() => {
            selection = { inst: inventaire[indexInv] };
            afficher();
          });
        });
        carte.addEventListener(`dblclick`, () =>
          doubleClic(() => equiperIndex(indexInv, undefined, true)),
        );
        carte.addEventListener(`dragstart`, (evenement) => {
          evenement.dataTransfer.setData(`text/plain`, `inv:${indexInv}`);
          evenement.dataTransfer.effectAllowed = `move`;
          carte.classList.add(`drag-src`);
        });
        carte.addEventListener(`dragend`, () => carte.classList.remove(`drag-src`));
      });
      racine.querySelectorAll(`.equip-slot`).forEach((caseSlot) => {
        let slot = caseSlot.dataset.slot;
        if (caseSlot.classList.contains(`rempli`)) {
          const ouvrir = () => {
            origineFiche = cleFocus(caseSlot);
            selection = { slot };
            afficher();
          };
          caseSlot.addEventListener(`click`, (ev) => {
            if (ev.detail > 1) {
              return;
            }
            clicDiffere(ouvrir);
          });
          caseSlot.addEventListener(`keydown`, (ev) => {
            if (ev.key === `Enter` || ev.key === ` `) {
              ev.preventDefault();
              ouvrir();
            }
          });
          caseSlot.addEventListener(`dblclick`, () => doubleClic(() => desequiperSlot(slot, true)));
          caseSlot.addEventListener(`dragstart`, (evenement) => {
            evenement.dataTransfer.setData(`text/plain`, `slot:${slot}`);
            evenement.dataTransfer.effectAllowed = `move`;
            caseSlot.classList.add(`drag-src`);
          });
          caseSlot.addEventListener(`dragend`, () => caseSlot.classList.remove(`drag-src`));
        }
        caseSlot.addEventListener(`dragover`, (evenement) => {
          if (evenement.dataTransfer?.types.includes(`text/plain`)) {
            evenement.preventDefault();
            caseSlot.classList.add(`drop-cible`);
          }
        });
        caseSlot.addEventListener(`dragleave`, () => caseSlot.classList.remove(`drop-cible`));
        caseSlot.addEventListener(`drop`, (evenement) => {
          evenement.preventDefault();
          caseSlot.classList.remove(`drop-cible`);
          let donnees = evenement.dataTransfer.getData(`text/plain`);
          if (donnees.startsWith(`inv:`)) {
            // déposé sur un emplacement précis (utile pour choisir l'anneau à remplacer)
            const idx = Number(donnees.slice(4));
            equiperIndex(idx, emplacementPossible(heros, inventaire[idx], slot) ? slot : undefined);
          }
        });
      });
      let listeInv = racine.querySelector(`.equip-inv`);
      if (listeInv) {
        listeInv.addEventListener(`dragover`, (evenement) => {
          if (evenement.dataTransfer?.types.includes(`text/plain`)) {
            evenement.preventDefault();
            listeInv.classList.add(`drop-cible`);
          }
        });
        listeInv.addEventListener(`dragleave`, () => listeInv.classList.remove(`drop-cible`));
        listeInv.addEventListener(`drop`, (evenement) => {
          evenement.preventDefault();
          listeInv.classList.remove(`drop-cible`);
          let donnees = evenement.dataTransfer.getData(`text/plain`);
          if (donnees.startsWith(`slot:`)) {
            desequiperSlot(donnees.slice(5));
          }
        });
      }
      document.getElementById(`equip-plus`)?.addEventListener(`click`, () => {
        pages++;
        afficher();
      });
      document.querySelector(`[data-favori]`)?.addEventListener(`click`, () => {
        const inst = selection?.inst ?? heros.equipement[selection?.slot];
        if (inst) {
          parametres.favoris = basculerFavori(parametres.favoris, inst);
          sauverParametres(parametres);
          afficher();
        }
      });
      // fiche ouverte
      document.querySelectorAll(`[data-fermer-fiche]`).forEach((bouton) =>
        bouton.addEventListener(`click`, () => {
          selection = null;
          afficher();
        }),
      );
      document.querySelectorAll(`[data-equiper-sur]`).forEach((bouton) =>
        bouton.addEventListener(`click`, () => {
          const idx = Number(bouton.dataset.equiperSur);
          const index = inventaire.indexOf(selection.inst);
          if (index >= 0) {
            equiperObjet(inventaire, persos[idx], index, bouton.dataset.emplacement || undefined);
          }
          indexPerso = idx;
          selection = null;
          afficher();
        }),
      );
      document
        .querySelector(`[data-retirer]`)
        ?.addEventListener(`click`, (ev) => desequiperSlot(ev.currentTarget.dataset.retirer));
      // objet porté : le donner (ou l'échanger) à un autre héros en un geste
      document.querySelectorAll(`[data-donner]`).forEach((bouton) =>
        bouton.addEventListener(`click`, () => {
          const emplacement = selection?.slot;
          const receveur = persos[Number(bouton.dataset.donner)];
          const resultat = emplacement && donnerObjet(inventaire, heros, emplacement, receveur);
          if (!resultat) {
            return;
          }
          const nom = EQUIPEMENTS[resultat.inst.id]?.nom ?? resultat.inst.id;
          const ancien = resultat.ancien && (EQUIPEMENTS[resultat.ancien.id]?.nom ?? ``);
          selection = null;
          afficher();
          afficherBandeau(
            resultat.echange
              ? `⇄ ${nom} passe à ${nomClasse(receveur)}, ${ancien} à ${nomClasse(heros)}`
              : `➜ ${nom} passe à ${nomClasse(receveur)}${ancien ? ` (${ancien} dans l'inventaire)` : ``}`,
          );
        }),
      );
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
      let liste = racine.querySelector(`.equip-inv`);
      if (liste) {
        liste.scrollTop = scrollInv;
      }
      if (document.scrollingElement) {
        document.scrollingElement.scrollTop = scrollPage;
      }
    };
    // Échap ferme d'abord la fiche ouverte (sans quitter l'écran) : écouté en phase de capture
    const echap = (ev) => {
      if (ev.key === `Escape` && selection) {
        ev.preventDefault();
        ev.stopPropagation();
        selection = null;
        afficher();
      }
    };
    document.addEventListener(`keydown`, echap, true);
    afficher();
  });
}
