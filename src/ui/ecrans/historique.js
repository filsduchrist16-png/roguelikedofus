// Écran « Historique et statistiques » (depuis l'accueil) : statistiques du compte, records par
// monde et par difficulté, et les 20 dernières runs (méta : `historique`, `compte`).
import { CLASSES, MONDES, RELIQUES, RELIQUES_RUN } from "../../data/index.js";
import { DIFFICULTES } from "../../jeu/config.js";
import { MODE_SONGES } from "../../jeu/songes.js";
import { chargerRun } from "../../sauvegarde/run.js";
import {
  noterFinDeRun,
  normaliserHistorique,
  statistiquesCompte,
  texteDuree,
} from "../../sauvegarde/meta.js";
import {
  afficherEcran,
  barreRetour,
  brancherSectionsRepliables,
  echapperHtml,
  etoilesDifficulte,
  htmlSectionRepliable,
  imgSymboleClasse,
} from "../commun.js";

// Runs montrées d'abord (les autres derrière « Voir les … autres »).
export const RUNS_VISIBLES = 5;
const numeroMonde = (id) => MONDES.findIndex((monde) => monde.id === id) + 1;
const ABREV_DIFFICULTES = [`Norm.`, `Diff.`, `Extr.`, `Cauch.`, `Ult.`];
const ISSUES = {
  victoire: { icone: `🏆`, texte: `Victoire`, classe: `hist-victoire` },
  defaite: { icone: `💀`, texte: `Défaite`, classe: `hist-defaite` },
  abandon: { icone: `🏳️`, texte: `Abandon`, classe: `hist-abandon` },
};
/** « 18 oct. · 20:41 » */
export function texteDateRun(date) {
  const jour = new Date(date);
  if (Number.isNaN(jour.getTime())) {
    return ``;
  }
  return `${jour.toLocaleDateString(`fr-FR`, { day: `numeric`, month: `short` })} · ${jour.toLocaleTimeString(`fr-FR`, { hour: `2-digit`, minute: `2-digit` })}`;
}
/** Où la run s'est arrêtée : « Monde 2 · Zone 3/6 », « Songes · étage 12 ». */
export function texteAvancee(entree) {
  if (entree.mode === `songes`) {
    return `🌙 Songes infinis · étage ${entree.etage}`;
  }
  const zone =
    entree.issue === `victoire`
      ? `toutes les zones (${entree.nbZones})`
      : `zone ${entree.zone}${entree.nbZones ? `/${entree.nbZones}` : ``}`;
  return `Monde ${numeroMonde(entree.monde)}${entree.mode === `jour` ? ` · 📅 run du jour` : ``} · ${zone}`;
}
function htmlEntree(entree, indice) {
  const issue = ISSUES[entree.issue] ?? ISSUES.defaite;
  const difficulte = DIFFICULTES[entree.difficulte] ?? DIFFICULTES[0];
  const equipe = entree.equipe
    .map(
      (heros) =>
        `<span class="hist-heros"><img src="${imgSymboleClasse(heros.classe)}" alt="" onerror="this.remove()" />${echapperHtml(CLASSES[heros.classe]?.nom ?? heros.classe)} <small>niv. ${heros.niveau}</small></span>`,
    )
    .join(``);
  const reliques = [
    ...entree.reliques.map((id) => {
      const relique = RELIQUES_RUN[id];
      return `<span class="hist-relique" tabindex="0" data-tip="${echapperHtml(`${relique.nom} : ${relique.desc}`)}" aria-label="${echapperHtml(relique.nom)}">${relique.icone}</span>`;
    }),
    ...entree.reliquesBoss.map(
      (id) =>
        `<span class="hist-relique hist-relique-boss" tabindex="0" data-tip="${echapperHtml(`Relique de boss obtenue : ${RELIQUES[id]?.nom ?? id}`)}">🏺 ${echapperHtml(RELIQUES[id]?.nom ?? id)}</span>`,
    ),
  ].join(``);
  return `<li class="hist-run ${issue.classe}"${indice >= RUNS_VISIBLES ? ` data-cachee hidden` : ``}>
    <p class="hist-tete"><b>${issue.icone} ${issue.texte}</b><span class="hist-date">${texteDateRun(entree.date)}</span></p>
    <p class="hist-avancee">${echapperHtml(texteAvancee(entree))} · <span class="hist-diff" aria-label="Difficulté ${echapperHtml(difficulte.nom)}">${etoilesDifficulte(entree.difficulte).replace(/☆/g, ``)} ${echapperHtml(difficulte.nom)}</span> · ⚔️ ${entree.combats} combat${entree.combats > 1 ? `s` : ``}</p>
    <p class="hist-equipe">${equipe}</p>
    ${entree.cause ? `<p class="hist-cause">${entree.issue === `abandon` ? `🏳️` : `☠`} ${echapperHtml(entree.cause)}</p>` : ``}
    ${reliques ? `<p class="hist-reliques" aria-label="Reliques">${reliques}</p>` : ``}
  </li>`;
}
function htmlStatistiques(stats) {
  const favori = stats.herosFavori;
  const tuiles = [
    [`⏱️`, `Temps de jeu`, texteDuree(stats.tempsJeu), `compté depuis la version 1.9.0`],
    [
      `🎮`,
      `Runs jouées`,
      String(stats.runs),
      `${stats.victoires} gagnée${stats.victoires > 1 ? `s` : ``}`,
    ],
    [`⚔️`, `Combats gagnés`, String(stats.combats), `runs terminées depuis la 1.9.0`],
    [
      `⭐`,
      `Héros le plus joué`,
      favori ? (CLASSES[favori.classe]?.nom ?? favori.classe) : `—`,
      favori ? `${favori.runs} run${favori.runs > 1 ? `s` : ``}` : `aucune run terminée`,
    ],
  ];
  return `<div class="hist-tuiles">${tuiles
    .map(
      ([icone, libelle, valeur, detail]) =>
        `<div class="hist-tuile"><span class="hist-tuile-lbl">${icone} ${libelle}</span><b>${echapperHtml(valeur)}</b><small>${echapperHtml(detail)}</small></div>`,
    )
    .join(``)}</div>`;
}
function htmlRecords(stats) {
  const lignes = stats.records
    .map((record) => {
      const cellules = record.parDifficulte
        .map((cran) => {
          const nom = DIFFICULTES[cran.difficulte].nom;
          if (cran.gagnee) {
            return `<td class="hist-gagne" data-tip="${echapperHtml(`${nom} : gagnée${cran.victoires ? ` (${cran.victoires} fois depuis la 1.9.0)` : ``}`)}" tabindex="0">✓</td>`;
          }
          return cran.zone
            ? `<td data-tip="${echapperHtml(`${nom} : zone ${cran.zone}/${record.nbZones} au mieux`)}" tabindex="0">${cran.zone}/${record.nbZones}</td>`
            : `<td class="muet">—</td>`;
        })
        .join(``);
      return `<tr><th scope="row">M${numeroMonde(record.monde)}${record.score ? `<small>${record.score} pts</small>` : ``}</th>${cellules}</tr>`;
    })
    .join(``);
  return `<table class="hist-records">
      <thead><tr><th scope="col">Monde</th>${DIFFICULTES.map((difficulte, cran) => `<th scope="col" title="${echapperHtml(difficulte.nom)}">${ABREV_DIFFICULTES[cran] ?? difficulte.nom}</th>`).join(``)}</tr></thead>
      <tbody>${lignes}</tbody>
    </table>
    <p class="hist-legende">✓ gagnée · 3/6 : meilleure zone atteinte · pts : record du monde. Les zones atteintes par difficulté sont comptées depuis la version 1.9.0.</p>`;
}
export function ecranHistorique(meta) {
  return new Promise((resolve) => {
    const stats = statistiquesCompte(meta);
    const historique = normaliserHistorique(meta.historique);
    const reste = historique.length - RUNS_VISIBLES;
    afficherEcran(
      `
      <h1>📜 Historique et statistiques</h1>
      ${htmlStatistiques(stats)}
      ${htmlSectionRepliable(`hist-records`, `🏅 Records par monde et par difficulté`, htmlRecords(stats))}
      <h2 class="hist-titre">🗓️ ${historique.length ? `${historique.length} dernière${historique.length > 1 ? `s` : ``} run${historique.length > 1 ? `s` : ``}` : `Dernières runs`}</h2>
      ${
        historique.length
          ? `<ol class="hist-liste">${historique.map(htmlEntree).join(``)}</ol>
      ${reste > 0 ? `<p class="hist-plus"><button id="hist-plus" class="secondaire">Voir les ${reste} autre${reste > 1 ? `s` : ``}</button></p>` : ``}`
          : `<p class="sous-titre">Aucune run terminée pour l'instant : les ${20} dernières s'inscriront ici, avec leur équipe, leurs reliques et ce qui les a arrêtées.</p>`
      }
      ${barreRetour(`hist-retour`)}
    `,
      `ecran-historique`,
    );
    brancherSectionsRepliables();
    document.getElementById(`hist-plus`)?.addEventListener(`click`, (ev) => {
      document.querySelectorAll(`.hist-run[data-cachee]`).forEach((ligne) => {
        ligne.hidden = false;
      });
      ev.currentTarget.closest(`.hist-plus`)?.remove();
    });
    document.getElementById(`hist-retour`)?.addEventListener(`click`, () => resolve());
  });
}
// Run en cours abandonnée (accueil, « Recommencer » de la carte) : rangée dans l'historique.
export function noterAbandonEnCours(meta) {
  try {
    const sauvegarde = chargerRun();
    if (!sauvegarde) {
      return;
    }
    const { run, zoneIdx } = sauvegarde;
    const monde = MONDES.find((candidat) => candidat.id === run.trancheId);
    noterFinDeRun(meta, run, {
      issue: `abandon`,
      zone: zoneIdx + 1,
      nbZones: run.mode === MODE_SONGES ? 0 : (monde?.zones.length ?? 0),
      cause: run.mode === MODE_SONGES ? `Songe abandonné` : `Run abandonnée`,
    });
  } catch {}
}
