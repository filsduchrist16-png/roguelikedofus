import { CLASSES } from "../../data/index.js";
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
export function ecranTaverne(e, t, n, r = false, i = false) {
  return new Promise((resolve) => {
    let classeId = null;
    // recrue sélectionnée au premier appui (écran tactile)
    let selection = null;
    let s = e.length >= 4;
    const mort = r ? e.find((p) => p.pvActuels <= 0) : undefined;
    // avertir si ce recrutement porte l'équipe à 4 héros debout (le tombé est remplacé)
    let c = i && (mort ? e.filter((p) => p.pvActuels > 0).length === 3 : !s && e.length === 3);
    const recruterClasse = (recrue) => {
      if (mort) {
        resolve({ type: `recrue`, classeId: recrue, remplace: mort.classeId });
      } else if (s) {
        classeId = recrue;
        l();
      } else {
        resolve({ type: `recrue`, classeId: recrue });
      }
    };
    let l = () => {
      if (classeId) {
        let t = e
          .map((p) =>
            carteAvecInfo(
              htmlCarteClasse(p.classeId, false, `data-remplace`),
              `<span class="tav-remp-info">Niv. ${p.progression.niveau} · PV ${Math.max(0, Math.round(p.pvActuels))}/${pvMaxPerso(p)}</span>`,
            ),
          )
          .join(``);
        afficherEcran(`
          <h1>Recruter ${echapperHtml(nomClasse(classeId))}</h1>
          <p class="sous-titre">L'équipe est pleine. Choisis le membre à remplacer : son équipement retourne dans l'inventaire.</p>
          <div class="choix-grille">${t}</div>
          <div class="boutons-ecran"><button id="tav-annuler" class="secondaire btn-retour">Annuler</button></div>
        `);
        racine.querySelectorAll(`.classe-carte`).forEach((carte) => {
          carte.addEventListener(`click`, async () => {
            const partant = e.find((p) => p.classeId === carte.dataset.remplace);
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
          l();
        });
        return;
      }
      const niveau = niveauMoyen({ persos: e });
      let i = t.length
        ? `<h3>Recruter (2 candidats)</h3>
           <p class="muet tav-recrue-info">Arrive au niveau ${niveau} (moyenne de l'équipe), sans équipement${mort ? `, à la place de ${echapperHtml(nomClasse(mort.classeId))}` : ``}.</p>
           <div class="choix-grille">${t.map((e) => htmlCarteClasse(e, e === selection, `data-recrue`)).join(``)}</div>`
        : `<p class="muet">Aucune classe à recruter (toutes déjà dans l'équipe).</p>`;
      let length = e.filter((e) => e.pvActuels <= 0).length;
      const soin = apercuSoin(e, n, r);
      const libelleSoin = soin.total
        ? `Soigner : +${soin.total} PV${soin.releves.length ? `, relève ${soin.releves.map(nomClasse).join(`, `)}` : ``}`
        : r && length > 0
          ? `Héros debout déjà en pleine forme`
          : `Équipe déjà en pleine forme`;
      afficherEcran(`
        <h1>Taverne</h1>
        ${htmlBarreEquipe(e)}
        <p class="sous-titre">Soigne ton équipe (+${Math.round(n * 100)} % des PV max), ou recrute un nouveau membre.</p>
        ${r && length > 0 ? `<p class="asc-avertissement">☠ ${length === 1 ? `Un héros tombé ne se relèvera pas` : `${length} héros tombés ne se relèveront pas`}. Il faut le${length > 1 ? `s` : ``} remplacer.</p>` : ``}
        ${c && t.length ? `<p class="asc-avertissement">⚠ Recruter maintenant complète l'équipe : les tavernes (et tout soin hors combat) disparaissent du reste de la run.</p>` : ``}
        ${i}
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
      racine.querySelectorAll(`.classe-carte`).forEach((e) => {
        e.addEventListener(`click`, () => {
          let recrue = e.dataset.recrue;
          // sur écran tactile, le premier appui sélectionne seulement (évite un recrutement par erreur)
          if (ecranTactile() && selection !== recrue) {
            selection = recrue;
            l();
            return;
          }
          recruterClasse(recrue);
        });
      });
    };
    l();
  });
}
