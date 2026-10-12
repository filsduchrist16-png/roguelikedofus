import { CLASSES, EQUIPEMENTS, MONDES, RELIQUES } from "../../data/index.js";
import { DIFFICULTES, DIFFICULTE_MAX, RARETES } from "../../jeu/config.js";
import { ascensionMonde, mondeJouable } from "../../sauvegarde/meta.js";
import {
  afficherEcran,
  boutonRetour,
  echapperHtml,
  etoilesDifficulte,
  htmlKamas,
  imgSymboleClasse,
} from "../commun.js";
// Mémorise les objets obtenus pendant la run (id et rareté) pour le bilan de fin. Les anciennes
// sauvegardes n'ont pas ce compteur : on le crée au besoin ; la liste reste bornée.
export function noterObjetsObtenus(stats, objets) {
  stats.butin = stats.butin ?? [];
  for (const o of objets) {
    if (stats.butin.length < 500) {
      stats.butin.push({ id: o.id, rarete: o.rarete });
    }
  }
}
// Ennemis vaincus pendant la run (même précaution pour les anciennes sauvegardes).
export function noterEnnemisVaincus(stats, nombre) {
  stats.ennemis = (stats.ennemis ?? 0) + nombre;
}
// Objets du bilan, regroupés par (objet, rareté) et classés des plus rares aux plus communs.
export function htmlObjetsObtenus(butin = []) {
  const groupes = new Map();
  for (const o of butin) {
    const cle = `${o.id}|${o.rarete}`;
    groupes.set(cle, { ...o, n: (groupes.get(cle)?.n ?? 0) + 1 });
  }
  const lignes = [...groupes.values()]
    .filter((g) => EQUIPEMENTS[g.id])
    .sort((a, b) => RARETES.indexOf(b.rarete) - RARETES.indexOf(a.rarete));
  if (!lignes.length) {
    return ``;
  }
  return `<details class="recap-objets"><summary>🎒 Objets obtenus (${butin.length})</summary><ul>${lignes
    .map(
      (g) =>
        `<li class="recap-objet"><span class="inom-${g.rarete}">${echapperHtml(EQUIPEMENTS[g.id].nom)}</span>${g.n > 1 ? ` <b>×${g.n}</b>` : ``}</li>`,
    )
    .join(``)}</ul></details>`;
}
// Ce qui est débloqué pour un monde : plus haute difficulté accessible et monde suivant jouable.
export function etatDeblocage(meta, trancheId) {
  const record = ascensionMonde(meta, trancheId);
  const suivant = MONDES[MONDES.findIndex((m) => m.id === trancheId) + 1];
  return {
    difficulte: record === undefined ? 0 : Math.min(record + 1, DIFFICULTE_MAX),
    mondeSuivant: suivant && mondeJouable(meta, suivant.id) ? suivant.id : null,
  };
}
// Libellés de ce qu'une victoire vient de débloquer (comparaison avant / après).
export function deblocagesVictoire(avant, apres) {
  const lignes = [];
  if (apres.difficulte > avant.difficulte) {
    lignes.push(`difficulté ${DIFFICULTES[apres.difficulte].nom}`);
  }
  if (apres.mondeSuivant && apres.mondeSuivant !== avant.mondeSuivant) {
    lignes.push(MONDES.find((m) => m.id === apres.mondeSuivant)?.nom ?? apres.mondeSuivant);
  }
  return lignes;
}
// Résout 'memes' (rejouer avec les mêmes héros), 'choix' (autre équipe) ou null (accueil).
export function ecranRecap(e, t, n = [], debloques = []) {
  return new Promise((resolve) => {
    let e_stats = e.stats;
    let a = Math.max(1, ...Object.values(e_stats.degats));
    let o = Object.entries(e_stats.degats).sort((e, t) => t[1] - e[1])[0]?.[0];
    let s = e.persos
      .map((e) => {
        let t = e_stats.degats[e.classeId] ?? 0;
        let n = Math.round((t / a) * 100);
        return `<div class="recap-ligne">
          <img class="recap-sym" src="${imgSymboleClasse(e.classeId)}" alt="" onerror="this.remove()" />
          <span class="recap-nom">${echapperHtml(CLASSES[e.classeId].nom)}${e.classeId === o ? ` 👑` : ``}<small>Niv. ${e.progression.niveau}${e.pvActuels <= 0 ? ` · ☠ K.O.` : ``}</small></span>
          <div class="recap-barre"><div class="recap-barre-rempli" style="width:${n}%"></div><span>${t.toLocaleString(`fr-FR`)} dégâts</span></div>
        </div>`;
      })
      .join(``);
    afficherEcran(`
      <h1 class="${t ? `` : `defaite`}">${t ? `🏆 Krosmoz traversé !` : `Équipe anéantie`}</h1>
      ${e.ascension >= 1 ? `<p class="asc-record">${echapperHtml(DIFFICULTES[e.ascension].nom)} <span class="asc-badge">${etoilesDifficulte(e.ascension)}</span></p>` : ``}
      <p class="sous-titre">${t ? `Toutes les zones du monde sont vaincues.` : `La run s'arrête ici${e_stats.zones ? ` après ${e_stats.zones} zone${e_stats.zones > 1 ? `s` : ``} traversée${e_stats.zones > 1 ? `s` : ``}` : ``}. Tes Dofus et tes captures, eux, sont conservés.`}</p>
      ${debloques.length ? `<p class="recap-debloque">🔓 Débloqué : ${debloques.map((d) => `<b>${echapperHtml(d)}</b>`).join(` · `)}</p>` : ``}
      <div class="recap-compteurs">
        <span class="recap-chip">🗺️ ${e_stats.zones} zone${e_stats.zones > 1 ? `s` : ``}</span>
        <span class="recap-chip">⚔️ ${e_stats.combats} combat${e_stats.combats > 1 ? `s` : ``} gagné${e_stats.combats > 1 ? `s` : ``}</span>
        <span class="recap-chip">💀 ${e_stats.ennemis ?? 0} ennemi${(e_stats.ennemis ?? 0) > 1 ? `s` : ``} vaincu${(e_stats.ennemis ?? 0) > 1 ? `s` : ``}</span>
        <span class="recap-chip">🎒 ${e_stats.objets} objet${e_stats.objets > 1 ? `s` : ``}</span>
        <span class="recap-chip">✨ ${e_stats.archis} âme${e_stats.archis > 1 ? `s` : ``} capturée${e_stats.archis > 1 ? `s` : ``}</span>
        <span class="recap-chip">${htmlKamas(e_stats.kamasGagnes ?? 0)} gagnés</span>
        ${e_stats.recrutements ? `<span class="recap-chip">🍺 ${e_stats.recrutements} recrue${e_stats.recrutements > 1 ? `s` : ``}</span>` : ``}
      </div>
      ${htmlObjetsObtenus(e_stats.butin)}
      <h3 class="recap-titre-degats">Dégâts infligés · ${Object.values(e_stats.degats)
        .reduce((x, y) => x + y, 0)
        .toLocaleString(`fr-FR`)}</h3>
      <div class="recap-degats">${s}</div>
      ${e_stats.reliques?.length ? `<div class="recap-succes">${e_stats.reliques.map((e) => `<span class="succes-chip nouveau">Relique : ${echapperHtml(RELIQUES[e]?.nom ?? e)}</span>`).join(``)}</div>` : ``}
      ${n.length ? `<div class="recap-succes">${n.map((e) => `<span class="succes-chip nouveau">✓ ${echapperHtml(e.nom)}</span>`).join(``)}</div>` : ``}
      <div class="boutons-ecran recap-boutons">
        ${boutonRetour(`recap-retour`, `Retour à l'accueil`)}
        <button id="recap-choix" class="secondaire">Autre équipe</button>
        <button id="recap-rejouer" class="btn-continuer primaire recap-rejouer" title="Rejouer avec les mêmes héros">↻ Rejouer <small>(mêmes héros)</small></button>
      </div>
    `);
    document.getElementById(`recap-retour`)?.addEventListener(`click`, () => resolve(null));
    document.getElementById(`recap-choix`)?.addEventListener(`click`, () => resolve(`choix`));
    document.getElementById(`recap-rejouer`)?.addEventListener(`click`, () => resolve(`memes`));
  });
}
