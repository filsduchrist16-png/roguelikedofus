import { DOFUS } from "../../data/index.js";
import { afficherEcran, barreRetour, htmlRackDofus } from "../commun.js";
export function ecranDofus(e) {
  return new Promise((resolve) => {
    let size = new Set(e.dofus.map((e) => e.id)).size;
    afficherEcran(`
      <h1>Dofus</h1>
      <p class="sous-titre">${size} / ${Object.keys(DOFUS).length} Dofus collectés. Ils survivent à la mort ; en posséder plusieurs exemplaires n'ajoute rien, seule la possession compte.</p>
      ${htmlRackDofus(e)}
      ${barreRetour(`dofus-retour`)}
    `);
    document.getElementById(`dofus-retour`)?.addEventListener(`click`, () => resolve());
  });
}
