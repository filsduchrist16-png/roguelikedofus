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
const pct = (x) =>
  `${String(Math.round(x * 1000) / 10)
    .replace(`.`, `,`)
    .replace(`-`, `−`)} %`;
// −10 avec le vrai signe moins
const signeNombre = (n) => (n < 0 ? `−${Math.abs(n)}` : String(n));
const plusPct = (x) => (x < 0 ? pct(x) : `+${pct(x)}`);
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
function htmlCombatPerso(c) {
  const res = Object.entries(c.resistances ?? {}).filter(([, v]) => v);
  const puces = [
    [`★ PA`, c.paMax, `Points d'action par tour : chaque sort en coûte.`],
    [`Initiative`, c.initiative, `Plus elle est haute, plus le héros joue tôt dans la ronde.`],
    [
      `Critique`,
      pct(chanceCritique(statsEffectives(c))),
      `Chance de coup critique : 5 % + 0,1 % par Agilité + bonus de critique.`,
    ],
    [
      `Dégâts crit.`,
      `+${pct(bonusDegatsCritiques(statsEffectives(c)))}`,
      `Bonus de dégâts d'un coup critique : 25 % + 0,1 % par Agilité.`,
    ],
    [
      `Esquive`,
      pct(Math.max(0, chanceEsquive(c))),
      `Chance d'éviter une attaque : 0,2 % par Agilité (+ bonus d'équipement), 50 % au plus.`,
    ],
    [
      `Soins`,
      plusPct(multiplicateurSoinDe(c) - 1),
      `Bonus aux soins donnés : 0,5 % par point de Soin et de l'élément principal, 50 % au plus.`,
    ],
    [
      `Prospection`,
      c.stats.prospection ?? 0,
      `Chance de butin : la prospection de toute l'équipe s'additionne.`,
    ],
    ...res.map(([el, v]) => [
      `Rés. ${NOMS_ELEMENTS[el] ?? el}`,
      pct(v),
      `Dégâts ${NOMS_ELEMENTS[el] ?? el} subis réduits d'autant.`,
    ]),
  ];
  return `<div class="stats-combat" aria-label="En combat">
    ${puces.map(([nom, val, aide]) => `<span class="stat-puce" data-tip="${echapperHtml(aide)}"><small>${nom}</small><b>${val}</b></span>`).join(``)}
  </div>`;
}
function htmlFichePerso(e, meta) {
  let t = CLASSES[e.classeId];
  let e_progression = e.progression;
  let r = statsDeNiveau(t, e_progression);
  let i = bonusEquipement(e);
  let a = pvMaxPerso(e);
  let o = xpPourNiveau(e_progression.niveau);
  let s = Math.min(100, Math.round((e_progression.xp / o) * 100));
  let combattant = creerCombattantPerso(e);
  if (meta) {
    appliquerBonusDofus([combattant], bonusDofus(meta));
  }
  let classe = t;
  let c = STATS_AFFICHEES.map((e) => {
    let t = i.stats[e] ?? 0;
    let n = (r[e] ?? 0) + t;
    let total = e === `vitalite` ? n : (combattant.stats[e] ?? n);
    // le total réel (Dofus compris), puis ce qui vient de l'équipement et des Dofus
    let dofus = total - n;
    let parts = [t ? `${signeNombre(t)} équip.` : ``, dofus ? `${signeNombre(dofus)} Dofus` : ``]
      .filter(Boolean)
      .join(`, `);
    return `
      <div class="stat-ligne">
        <span class="stat-nom" tabindex="0">${NOMS_STATS[e]}<span class="stat-info">ⓘ</span><span class="stat-aide">${AIDE_STATS[e]}${STATS_ELEMENTAIRES_SET.has(e) ? AIDE_NOTE_ELEMENT : ``}</span></span>
        <span class="stat-val"><b class="stat-total stat-c-${e}">${signeNombre(total)}</b>${parts ? ` <small class="stat-part-equip" title="Niveau : ${signeNombre(total - t - dofus)}">dont ${parts}</small>` : ``}</span>
        <span class="stat-effet">${effetsStat(e, total, r[e] ?? 0, classe, combattant)}</span>
      </div>`;
  }).join(``);
  return `
    <div class="carte-prog">
      <div class="prog-tete">
        <span class="prog-nom">${echapperHtml(t.nom)}</span>
        <span class="prog-niv">Niv. ${e_progression.niveau}</span>
      </div>
      <div class="prog-archetype muet">${NOMS_ARCHETYPES[t.archetype]} · ${pastillesElementsPerso(e)}</div>
      <div class="barre-xp"><div class="barre-xp-rempli" style="width:${s}%"></div>
        <span class="xp-txt">XP ${e_progression.xp} / ${o}</span>
      </div>
      <div class="prog-pv">PV max : <b>${a}</b> · PV actuels : ${Math.max(0, Math.round(e.pvActuels))}</div>
      <div class="stats-grille">${c}</div>
      <h4 class="stats-combat-titre">En combat${meta ? ` <small>(Dofus compris)</small>` : ``}</h4>
      ${htmlCombatPerso(combattant)}
    </div>`;
}
function resumeBonusDofus(e) {
  if (!e) {
    return ``;
  }
  let t = bonusDofus(e);
  let n = [];
  let r = Math.round((t.damageMult - 1) * 100);
  if (r) {
    n.push(`+${r} % dégâts`);
  }
  if (t.paBonus) {
    n.push(`+${t.paBonus} PA`);
  }
  if (t.pvBonus) {
    n.push(`+${t.pvBonus} PV max`);
  }
  if (t.resAllBonus) {
    n.push(`+${Math.round(t.resAllBonus * 100)} % résistances`);
  }
  if (t.statsElementaires) {
    n.push(`+${t.statsElementaires} force/intel./agi./chance`);
  }
  if (t.critPlat) {
    n.push(`+${t.critPlat} % critique`);
  }
  if (t.perceResistances) {
    n.push(`${Math.round(t.perceResistances * 100)} % de résistances ennemies ignorées`);
  }
  if (t.prospection) {
    n.push(`+${t.prospection} prospection`);
  }
  if (n.length) {
    return `<div class="bonus-dofus">
    <span class="bonus-dofus-titre">🐉 Bonus de Dofus : toute l'équipe</span>
    <div class="bonus-dofus-liste">${n.map((e) => `<span class="bonus-dofus-chip">${e}</span>`).join(``)}</div>
  </div>`;
  }
  return ``;
}
export function ecranCaracteristiques(
  e,
  t = `Caractéristiques`,
  n = `Les caractéristiques montent seules, selon l'archétype de chaque classe.`,
  r = false,
  i = null,
) {
  return new Promise((resolve) => {
    afficherEcran(`
      <h1>${echapperHtml(t)}</h1>
      <p class="sous-titre">${echapperHtml(n)}</p>
      ${resumeBonusDofus(i)}
      <div class="prog-grille">${e.map((perso) => htmlFichePerso(perso, i)).join(``)}</div>
      <div class="boutons-ecran">${r ? boutonRetour(`prog-fermer`, `Retour au plateau`) : boutonContinuer(`prog-fermer`)}</div>
    `);
    document.getElementById(`prog-fermer`)?.addEventListener(`click`, () => resolve());
  });
}
