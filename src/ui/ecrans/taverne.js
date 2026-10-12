import { CLASSES } from "../../data/index.js";
import { afficherAstuce } from "./succes.js";
import { apercuSoin, niveauMoyen, pvMaxPerso } from "../../jeu/run.js";
import { htmlBarreEquipe } from "../barreEquipe.js";
import {
  afficherEcran,
  demanderConfirmation,
  echapperHtml,
  ecranTactile,
  htmlCarteClasse,
  racine,
} from "../commun.js";
const nomClasse = (id) => CLASSES[id]?.nom ?? id;
// Carte de classe avec une ligne d'info ajoutée en bas (niveau, PV…).
const carteAvecInfo = (html, info) => html.replace(/<\/button>\s*$/, `${info}</button>`);
export function ecranTaverne(
  persos,
  recrues,
  pctSoin,
  mortDefinitive = false,
  tavernesCoupees = false,
) {
  return new Promise((resolve) => {
    afficherAstuce(
      `taverne`,
      `La taverne recrute un héros : une équipe plus large encaisse et frappe plus.`,
    );
    let classeId = null;
    // recrue sélectionnée au premier appui (écran tactile)
    let selection = null;
    let equipePleine = persos.length >= 4;
    const mort = mortDefinitive ? persos.find((perso) => perso.pvActuels <= 0) : undefined;
    // avertir si ce recrutement porte l'équipe à 4 héros debout (le tombé est remplacé)
    let avertirComplet =
      tavernesCoupees &&
      (mort
        ? persos.filter((perso) => perso.pvActuels > 0).length === 3
        : !equipePleine && persos.length === 3);
    const recruterClasse = (recrue) => {
      if (mort) {
        resolve({ type: `recrue`, classeId: recrue, remplace: mort.classeId });
      } else if (equipePleine) {
        classeId = recrue;
        afficher();
      } else {
        resolve({ type: `recrue`, classeId: recrue });
      }
    };
    let afficher = () => {
      if (classeId) {
        let cartes = persos
          .map((perso) =>
            carteAvecInfo(
              htmlCarteClasse(perso.classeId, false, `data-remplace`),
              `<span class="tav-remp-info">Niv. ${perso.progression.niveau} · PV ${Math.max(0, Math.round(perso.pvActuels))}/${pvMaxPerso(perso)}</span>`,
            ),
          )
          .join(``);
        afficherEcran(`
          <h1>Recruter ${echapperHtml(nomClasse(classeId))}</h1>
          <p class="sous-titre">L'équipe est pleine. Choisis le membre à remplacer : son équipement retourne dans l'inventaire.</p>
          <div class="choix-grille">${cartes}</div>
          <div class="boutons-ecran"><button id="tav-annuler" class="secondaire btn-retour">Annuler</button></div>
        `);
        racine.querySelectorAll(`.classe-carte`).forEach((carte) => {
          carte.addEventListener(`click`, async () => {
            const partant = persos.find((perso) => perso.classeId === carte.dataset.remplace);
            const detail = partant
              ? `${nomClasse(partant.classeId)} (niv. ${partant.progression.niveau})`
              : `ce héros`;
            if (
              !(await demanderConfirmation(
                `Remplacer ${detail} par ${nomClasse(classeId)} ? Son équipement retourne dans l'inventaire.`,
                `Remplacer`,
              ))
            ) {
              return;
            }
            resolve({
              type: `recrue`,
              classeId,
              remplace: carte.dataset.remplace,
            });
          });
        });
        document.getElementById(`tav-annuler`)?.addEventListener(`click`, () => {
          classeId = null;
          afficher();
        });
        return;
      }
      const niveau = niveauMoyen({ persos });
      let htmlRecrues = recrues.length
        ? `<h3>Recruter (2 candidats)</h3>
           <p class="muet tav-recrue-info">Arrive au niveau ${niveau} (moyenne de l'équipe), sans équipement${mort ? `, à la place de ${echapperHtml(nomClasse(mort.classeId))}` : ``}.</p>
           <div class="choix-grille">${recrues.map((classe) => htmlCarteClasse(classe, classe === selection, `data-recrue`)).join(``)}</div>`
        : `<p class="muet">Aucune classe à recruter (toutes déjà dans l'équipe).</p>`;
      let nbTombes = persos.filter((perso) => perso.pvActuels <= 0).length;
      const soin = apercuSoin(persos, pctSoin, mortDefinitive);
      const libelleSoin = soin.total
        ? `Soigner : +${soin.total} PV${soin.releves.length ? `, relève ${soin.releves.map(nomClasse).join(`, `)}` : ``}`
        : mortDefinitive && nbTombes > 0
          ? `Héros debout déjà en pleine forme`
          : `Équipe déjà en pleine forme`;
      afficherEcran(`
        <h1>Taverne</h1>
        ${htmlBarreEquipe(persos)}
        <p class="sous-titre">Soigne ton équipe (+${Math.round(pctSoin * 100)} % des PV max), ou recrute un nouveau membre.</p>
        ${mortDefinitive && nbTombes > 0 ? `<p class="asc-avertissement">☠ ${nbTombes === 1 ? `Un héros tombé ne se relèvera pas` : `${nbTombes} héros tombés ne se relèveront pas`}. Il faut le${nbTombes > 1 ? `s` : ``} remplacer.</p>` : ``}
        ${avertirComplet && recrues.length ? `<p class="asc-avertissement">⚠ Recruter maintenant complète l'équipe : les tavernes disparaissent du reste de la run (potions, sanctuaires et autres soins restent possibles).</p>` : ``}
        ${htmlRecrues}
        <div class="boutons-ecran tav-boutons">
          <button id="tav-soin" class="${soin.total && !selection ? `primaire` : `secondaire`}">${echapperHtml(libelleSoin)}</button>
          ${selection ? `<button id="tav-recruter" class="primaire">Recruter ${echapperHtml(nomClasse(selection))}</button>` : ``}
        </div>
      `);
      document.getElementById(`tav-soin`)?.addEventListener(`click`, () =>
        resolve({
          type: `soin`,
        }),
      );
      document
        .getElementById(`tav-recruter`)
        ?.addEventListener(`click`, () => recruterClasse(selection));
      racine.querySelectorAll(`.classe-carte`).forEach((carte) => {
        carte.addEventListener(`click`, () => {
          let recrue = carte.dataset.recrue;
          // sur écran tactile, le premier appui sélectionne seulement (évite un recrutement par erreur)
          if (ecranTactile() && selection !== recrue) {
            selection = recrue;
            afficher();
            return;
          }
          recruterClasse(recrue);
        });
      });
    };
    afficher();
  });
}
