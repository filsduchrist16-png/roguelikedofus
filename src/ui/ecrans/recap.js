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
  for (const objet of objets) {
    if (stats.butin.length < 500) {
      stats.butin.push({ id: objet.id, rarete: objet.rarete });
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
  for (const objet of butin) {
    const cle = `${objet.id}|${objet.rarete}`;
    groupes.set(cle, { ...objet, n: (groupes.get(cle)?.n ?? 0) + 1 });
  }
  const lignes = [...groupes.values()]
    .filter((groupe) => EQUIPEMENTS[groupe.id])
    .sort((premier, second) => RARETES.indexOf(second.rarete) - RARETES.indexOf(premier.rarete));
  if (!lignes.length) {
    return ``;
  }
  return `<details class="recap-objets"><summary>🎒 Objets obtenus (${butin.length})</summary><ul>${lignes
    .map(
      (groupe) =>
        `<li class="recap-objet"><span class="inom-${groupe.rarete}">${echapperHtml(EQUIPEMENTS[groupe.id].nom)}</span>${groupe.n > 1 ? ` <b>×${groupe.n}</b>` : ``}</li>`,
    )
    .join(``)}</ul></details>`;
}
// Ce qui est débloqué pour un monde : plus haute difficulté accessible et monde suivant jouable.
export function etatDeblocage(meta, trancheId) {
  const record = ascensionMonde(meta, trancheId);
  const suivant = MONDES[MONDES.findIndex((monde) => monde.id === trancheId) + 1];
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
    lignes.push(MONDES.find((monde) => monde.id === apres.mondeSuivant)?.nom ?? apres.mondeSuivant);
  }
  return lignes;
}
// Résout 'memes' (rejouer avec les mêmes héros), 'choix' (autre équipe) ou null (accueil).
// songes (facultatif) : bilan des Songes infinis, { etage, record, nouveauRecord }.
export function ecranRecap(run, victoire, quetes = [], debloques = [], songes = null) {
  return new Promise((resolve) => {
    let stats = run.stats;
    let maxDegats = Math.max(1, ...Object.values(stats.degats));
    let meilleureClasse = Object.entries(stats.degats).sort(
      (premier, second) => second[1] - premier[1],
    )[0]?.[0];
    let htmlLignes = run.persos
      .map((perso) => {
        let degats = stats.degats[perso.classeId] ?? 0;
        let pct = Math.round((degats / maxDegats) * 100);
        return `<div class="recap-ligne">
          <img class="recap-sym" src="${imgSymboleClasse(perso.classeId)}" alt="" onerror="this.remove()" />
          <span class="recap-nom">${echapperHtml(CLASSES[perso.classeId].nom)}${perso.classeId === meilleureClasse ? ` 👑` : ``}<small>Niv. ${perso.progression.niveau}${perso.pvActuels <= 0 ? ` · ☠ K.O.` : ``}</small></span>
          <div class="recap-barre"><div class="recap-barre-rempli" style="width:${pct}%"></div><span>${degats.toLocaleString(`fr-FR`)} dégâts</span></div>
        </div>`;
      })
      .join(``);
    afficherEcran(`
      <h1 class="${victoire ? `` : `defaite`}">${songes ? `🌙 Fin du songe` : victoire ? `🏆 Krosmoz traversé !` : `Équipe anéantie`}</h1>
      ${run.ascension >= 1 ? `<p class="asc-record">${echapperHtml(DIFFICULTES[run.ascension].nom)} <span class="asc-badge">${etoilesDifficulte(run.ascension)}</span></p>` : ``}
      ${
        songes
          ? `<p class="sous-titre">Ton équipe se réveille après <b>${songes.etage} étage${songes.etage > 1 ? `s` : ``}</b> franchi${songes.etage > 1 ? `s` : ``}.</p>
      <p class="recap-songes${songes.nouveauRecord ? ` nouveau` : ``}">${songes.nouveauRecord ? `🏆 Nouveau record !` : `Record : <b>${songes.record}</b> étage${songes.record > 1 ? `s` : ``}`}</p>`
          : `<p class="sous-titre">${victoire ? `Toutes les zones du monde sont vaincues.` : `La run s'arrête ici${stats.zones ? ` après ${stats.zones} zone${stats.zones > 1 ? `s` : ``} traversée${stats.zones > 1 ? `s` : ``}` : ``}. Tes Dofus et tes captures, eux, sont conservés.`}</p>`
      }
      ${debloques.length ? `<p class="recap-debloque">🔓 Débloqué : ${debloques.map((nom) => `<b>${echapperHtml(nom)}</b>`).join(` · `)}</p>` : ``}
      <div class="recap-compteurs">
        ${songes ? `<span class="recap-chip">🌙 Étage ${songes.etage}</span>` : `<span class="recap-chip">🗺️ ${stats.zones} zone${stats.zones > 1 ? `s` : ``}</span>`}
        <span class="recap-chip">⚔️ ${stats.combats} combat${stats.combats > 1 ? `s` : ``} gagné${stats.combats > 1 ? `s` : ``}</span>
        <span class="recap-chip">💀 ${stats.ennemis ?? 0} ennemi${(stats.ennemis ?? 0) > 1 ? `s` : ``} vaincu${(stats.ennemis ?? 0) > 1 ? `s` : ``}</span>
        <span class="recap-chip">🎒 ${stats.objets} objet${stats.objets > 1 ? `s` : ``}</span>
        <span class="recap-chip">✨ ${stats.archis} âme${stats.archis > 1 ? `s` : ``} capturée${stats.archis > 1 ? `s` : ``}</span>
        <span class="recap-chip">${htmlKamas(stats.kamasGagnes ?? 0)} gagnés</span>
        ${stats.recrutements ? `<span class="recap-chip">🍺 ${stats.recrutements} recrue${stats.recrutements > 1 ? `s` : ``}</span>` : ``}
      </div>
      ${htmlObjetsObtenus(stats.butin)}
      <h3 class="recap-titre-degats">Dégâts infligés · ${Object.values(stats.degats)
        .reduce((somme, valeur) => somme + valeur, 0)
        .toLocaleString(`fr-FR`)}</h3>
      <div class="recap-degats">${htmlLignes}</div>
      ${stats.reliques?.length ? `<div class="recap-succes">${stats.reliques.map((id) => `<span class="succes-chip nouveau">Relique : ${echapperHtml(RELIQUES[id]?.nom ?? id)}</span>`).join(``)}</div>` : ``}
      ${quetes.length ? `<div class="recap-succes">${quetes.map((quete) => `<span class="succes-chip nouveau">✓ ${echapperHtml(quete.nom)}</span>`).join(``)}</div>` : ``}
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
