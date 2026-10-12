import { CLASSES } from "../../data/index.js";
import {
  bonusDegatsIntelligence,
  multiplicateurStat,
  statsDeNiveau,
  xpPourNiveau,
} from "../../jeu/progression.js";
import { bonusEquipement, creerCombattantPerso, pvMaxPerso } from "../../jeu/run.js";
import { appliquerBonusDofus, bonusDofus } from "../../sauvegarde/meta.js";
import {
  bonusDegatsCritiques,
  chanceCritique,
  chanceEsquive,
  multiplicateurSoinDe,
  statsEffectives,
} from "../../combat/stats.js";
import {
  AIDE_NOTE_ELEMENT,
  AIDE_STATS,
  NOMS_ARCHETYPES,
  NOMS_STATS,
  afficherEcran,
  boutonContinuer,
  boutonRetour,
  echapperHtml,
  pastillesElementsPerso,
} from "../commun.js";
const STATS_ELEMENTAIRES_SET = new Set([`force`, `intelligence`, `agilite`, `chance`]);
const STATS_AFFICHEES = [`force`, `intelligence`, `agilite`, `chance`, `vitalite`];
const ELEMENT_DE_STAT = { force: `terre`, intelligence: `feu`, agilite: `air`, chance: `eau` };
const NOMS_ELEMENTS = { terre: `Terre`, feu: `Feu`, eau: `Eau`, air: `Air` };
const pct = (ratio) =>
  `${String(Math.round(ratio * 1000) / 10)
    .replace(`.`, `,`)
    .replace(`-`, `−`)} %`;
// −10 avec le vrai signe moins
const signeNombre = (nombre) => (nombre < 0 ? `−${Math.abs(nombre)}` : String(nombre));
const plusPct = (ratio) => (ratio < 0 ? pct(ratio) : `+${pct(ratio)}`);
// Ce que la valeur actuelle de chaque caractéristique apporte concrètement.
function effetsStat(stat, valeur, base, classe, combattant) {
  const element = ELEMENT_DE_STAT[stat];
  const effets = [];
  if (element) {
    const utilise = classe.elements.includes(element);
    effets.push(
      utilise
        ? `Dégâts ${NOMS_ELEMENTS[element]} <b>${plusPct(multiplicateurStat(valeur) - 1)}</b>`
        : `<span class="stat-inutile">${NOMS_ELEMENTS[element]} : pas un élément du ${echapperHtml(classe.nom)}</span>`,
    );
  }
  const stats = statsEffectives(combattant);
  if (stat === `force` && base >= 5) {
    effets.push(`+${Math.floor(base / 5)} Vitalité (Force de niveau ÷ 5)`);
  }
  if (stat === `intelligence`) {
    effets.push(`Tous les dégâts <b>${plusPct(bonusDegatsIntelligence(stats) - 1)}</b>`);
  }
  if (stat === `agilite`) {
    effets.push(
      `Critique <b>${pct(chanceCritique(stats))}</b> · dégâts critiques <b>+${pct(bonusDegatsCritiques(stats))}</b> · esquive <b>${pct(Math.max(0, chanceEsquive(combattant, { sansBonusPosition: true })))}</b>`,
    );
  }
  if (stat === `chance` && base >= 3) {
    effets.push(`+${Math.floor(base / 3)} Prospection (Chance de niveau ÷ 3)`);
  }
  if (stat === `vitalite`) {
    effets.push(`<b>+${valeur} PV</b> max`);
  }
  return effets.join(` · `);
}
function htmlCombatPerso(combattant) {
  const res = Object.entries(combattant.resistances ?? {}).filter(([, valeur]) => valeur);
  const puces = [
    [`★ PA`, combattant.paMax, `Points d'action par tour : chaque sort en coûte.`],
    [
      `Initiative`,
      combattant.initiative,
      `Plus elle est haute, plus le héros joue tôt dans la ronde.`,
    ],
    [
      `Critique`,
      pct(chanceCritique(statsEffectives(combattant))),
      `Chance de coup critique : 5 % + 0,1 % par Agilité + bonus de critique.`,
    ],
    [
      `Dégâts crit.`,
      `+${pct(bonusDegatsCritiques(statsEffectives(combattant)))}`,
      `Bonus de dégâts d'un coup critique : 25 % + 0,1 % par Agilité.`,
    ],
    [
      `Esquive`,
      pct(Math.max(0, chanceEsquive(combattant))),
      `Chance d'éviter une attaque : 0,2 % par Agilité (+ bonus d'équipement), 50 % au plus.`,
    ],
    [
      `Soins`,
      plusPct(multiplicateurSoinDe(combattant) - 1),
      `Bonus aux soins donnés : 0,5 % par point de Soin et de l'élément principal, 50 % au plus.`,
    ],
    [
      `Prospection`,
      combattant.stats.prospection ?? 0,
      `Chance de butin : la prospection de toute l'équipe s'additionne.`,
    ],
    ...res.map(([el, valeur]) => [
      `Rés. ${NOMS_ELEMENTS[el] ?? el}`,
      pct(valeur),
      `Dégâts ${NOMS_ELEMENTS[el] ?? el} subis réduits d'autant.`,
    ]),
  ];
  return `<div class="stats-combat" aria-label="En combat">
    ${puces.map(([nom, val, aide]) => `<span class="stat-puce" data-tip="${echapperHtml(aide)}"><small>${nom}</small><b>${val}</b></span>`).join(``)}
  </div>`;
}
function htmlFichePerso(perso, meta) {
  let def = CLASSES[perso.classeId];
  let progression = perso.progression;
  let statsBase = statsDeNiveau(def, progression);
  let bonusEquip = bonusEquipement(perso);
  let pvMax = pvMaxPerso(perso);
  let xpNiveau = xpPourNiveau(progression.niveau);
  let pctXp = Math.min(100, Math.round((progression.xp / xpNiveau) * 100));
  let combattant = creerCombattantPerso(perso);
  if (meta) {
    appliquerBonusDofus([combattant], bonusDofus(meta));
  }
  let classe = def;
  let htmlStats = STATS_AFFICHEES.map((stat) => {
    let bonusStat = bonusEquip.stats[stat] ?? 0;
    let totalBase = (statsBase[stat] ?? 0) + bonusStat;
    let total = stat === `vitalite` ? totalBase : (combattant.stats[stat] ?? totalBase);
    // le total réel (Dofus compris), puis ce qui vient de l'équipement et des Dofus
    let dofus = total - totalBase;
    let parts = [
      bonusStat ? `${signeNombre(bonusStat)} équip.` : ``,
      dofus ? `${signeNombre(dofus)} Dofus` : ``,
    ]
      .filter(Boolean)
      .join(`, `);
    return `
      <div class="stat-ligne">
        <span class="stat-nom" tabindex="0">${NOMS_STATS[stat]}<span class="stat-info">ⓘ</span><span class="stat-aide">${AIDE_STATS[stat]}${STATS_ELEMENTAIRES_SET.has(stat) ? AIDE_NOTE_ELEMENT : ``}</span></span>
        <span class="stat-val"><b class="stat-total stat-c-${stat}">${signeNombre(total)}</b>${parts ? ` <small class="stat-part-equip" title="Niveau : ${signeNombre(total - bonusStat - dofus)}">dont ${parts}</small>` : ``}</span>
        <span class="stat-effet">${effetsStat(stat, total, statsBase[stat] ?? 0, classe, combattant)}</span>
      </div>`;
  }).join(``);
  return `
    <div class="carte-prog">
      <div class="prog-tete">
        <span class="prog-nom">${echapperHtml(def.nom)}</span>
        <span class="prog-niv">Niv. ${progression.niveau}</span>
      </div>
      <div class="prog-archetype muet">${NOMS_ARCHETYPES[def.archetype]} · ${pastillesElementsPerso(perso)}</div>
      <div class="barre-xp"><div class="barre-xp-rempli" style="width:${pctXp}%"></div>
        <span class="xp-txt">XP ${progression.xp} / ${xpNiveau}</span>
      </div>
      <div class="prog-pv">PV max : <b>${pvMax}</b> · PV actuels : ${Math.max(0, Math.round(perso.pvActuels))}</div>
      <div class="stats-grille">${htmlStats}</div>
      <h4 class="stats-combat-titre">En combat${meta ? ` <small>(Dofus compris)</small>` : ``}</h4>
      ${htmlCombatPerso(combattant)}
    </div>`;
}
function resumeBonusDofus(meta) {
  if (!meta) {
    return ``;
  }
  let bonus = bonusDofus(meta);
  let puces = [];
  let pctDegats = Math.round((bonus.damageMult - 1) * 100);
  if (pctDegats) {
    puces.push(`+${pctDegats} % dégâts`);
  }
  if (bonus.paBonus) {
    puces.push(`+${bonus.paBonus} PA`);
  }
  if (bonus.pvBonus) {
    puces.push(`+${bonus.pvBonus} PV max`);
  }
  if (bonus.resAllBonus) {
    puces.push(`+${Math.round(bonus.resAllBonus * 100)} % résistances`);
  }
  if (bonus.statsElementaires) {
    puces.push(`+${bonus.statsElementaires} force/intel./agi./chance`);
  }
  if (bonus.critPlat) {
    puces.push(`+${bonus.critPlat} % critique`);
  }
  if (bonus.perceResistances) {
    puces.push(`${Math.round(bonus.perceResistances * 100)} % de résistances ennemies ignorées`);
  }
  if (bonus.prospection) {
    puces.push(`+${bonus.prospection} prospection`);
  }
  if (puces.length) {
    return `<div class="bonus-dofus">
    <span class="bonus-dofus-titre">🐉 Bonus de Dofus : toute l'équipe</span>
    <div class="bonus-dofus-liste">${puces.map((puce) => `<span class="bonus-dofus-chip">${puce}</span>`).join(``)}</div>
  </div>`;
  }
  return ``;
}
export function ecranCaracteristiques(
  persos,
  titre = `Caractéristiques`,
  sousTitre = `Les caractéristiques montent seules, selon l'archétype de chaque classe.`,
  retourPlateau = false,
  meta = null,
) {
  return new Promise((resolve) => {
    afficherEcran(`
      <h1>${echapperHtml(titre)}</h1>
      <p class="sous-titre">${echapperHtml(sousTitre)}</p>
      ${resumeBonusDofus(meta)}
      ${persos.length > 1 ? `<div class="prog-onglets" role="group" aria-label="Héros">${persos.map((perso, indice) => `<button type="button" class="prog-onglet${indice === 0 ? ` sel` : ``}" data-k="${indice}" aria-pressed="${indice === 0}">${echapperHtml(CLASSES[perso.classeId]?.nom ?? perso.classeId)}</button>`).join(``)}</div>` : ``}
      <div class="prog-grille">${persos.map((perso) => htmlFichePerso(perso, meta)).join(``)}</div>
      <div class="boutons-ecran">${retourPlateau ? boutonRetour(`prog-fermer`, `Retour au plateau`) : boutonContinuer(`prog-fermer`)}</div>
    `);
    // téléphone : un héros à la fois (les onglets remplacent la longue liste)
    const fiches = [...document.querySelectorAll(`.prog-grille .carte-prog`)];
    fiches[0]?.classList.add(`sel`);
    document.querySelectorAll(`.prog-onglet`).forEach((onglet) =>
      onglet.addEventListener(`click`, () => {
        document.querySelectorAll(`.prog-onglet`).forEach((autreOnglet) => {
          autreOnglet.classList.toggle(`sel`, autreOnglet === onglet);
          autreOnglet.setAttribute(`aria-pressed`, String(autreOnglet === onglet));
        });
        fiches.forEach((fiche, indice) =>
          fiche.classList.toggle(`sel`, indice === Number(onglet.dataset.k)),
        );
      }),
    );
    document.getElementById(`prog-fermer`)?.addEventListener(`click`, () => resolve());
  });
}
