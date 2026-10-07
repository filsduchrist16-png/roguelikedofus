import { CLASSES } from "../../data/index.js";
import { statsDeNiveau, xpPourNiveau } from "../../jeu/progression.js";
import { bonusEquipement, pvMaxPerso } from "../../jeu/run.js";
import { bonusDofus } from "../../sauvegarde/meta.js";
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
function htmlFichePerso(e) {
  let t = CLASSES[e.classeId];
  let e_progression = e.progression;
  let r = statsDeNiveau(t, e_progression);
  let i = bonusEquipement(e);
  let a = pvMaxPerso(e);
  let o = xpPourNiveau(e_progression.niveau);
  let s = Math.min(100, Math.round((e_progression.xp / o) * 100));
  let c = STATS_AFFICHEES.map((e) => {
    let t = i.stats[e] ?? 0;
    let n = (r[e] ?? 0) + t;
    return `
      <div class="stat-ligne">
        <span class="stat-nom" tabindex="0">${NOMS_STATS[e]}<span class="stat-info">ⓘ</span><span class="stat-aide">${AIDE_STATS[e]}${STATS_ELEMENTAIRES_SET.has(e) ? AIDE_NOTE_ELEMENT : ``}</span></span>
        <span class="stat-val"><b class="stat-total stat-c-${e}">${n}</b>${t ? ` + <span class="stat-part-equip" title="Équipement">(${t})</span>` : ``}</span>
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
      <div class="prog-grille">${e.map(htmlFichePerso).join(``)}</div>
      <div class="boutons-ecran">${r ? boutonRetour(`prog-fermer`, `Retour au plateau`) : boutonContinuer(`prog-fermer`)}</div>
    `);
    document.getElementById(`prog-fermer`)?.addEventListener(`click`, () => resolve());
  });
}
