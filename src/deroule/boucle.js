import { connexionRequise } from "../sauvegarde/compte.js";
import { ecranConnexion } from "../ui/ecrans/connexion.js";
import { rendreDofusSuspendus, reinitialiserDofus, enregistrerRun } from "../sauvegarde/meta.js";
import { meta, quetesMeta, ctxMeta } from "./etat.js";
import { ecranMessage } from "../ui/ecrans/message.js";
import { DOFUS } from "../data/index.js";
import { traiterQuetes } from "./quetes.js";
import { verifierQuetesMeta } from "../jeu/quetes.js";
import { chargerRun, effacerRun } from "../sauvegarde/run.js";
import { zonesDuMonde, getMonde } from "../jeu/config.js";
import { ecranAccueil } from "../ui/ecrans/accueil.js";
import { jouerRun } from "./run.js";
import { jouerSonges } from "./songes.js";
import { MODE_SONGES } from "../jeu/songes.js";

export async function boucleJeu() {
  // page de connexion en première page (hors claude.ai, où le compte claude.ai suffit)
  if (typeof globalThis.claude?.use !== `function` && connexionRequise()) {
    await ecranConnexion();
  }
  // anciennes versions : les Dofus mis de côté par l'ancien ordre strict reviennent
  let rendus = rendreDofusSuspendus(meta);
  if (rendus.length) {
    await ecranMessage(
      `🥚 Dofus rendus`,
      `Les Dofus ne demandent plus ceux de niveau inférieur : chacun s'obtient dès que son succès est terminé, dans le monde de sa tranche de niveau. De retour (avec leur jet) : ${rendus.map((id) => DOFUS[id].nom).join(`, `)}.`,
    );
  }
  for (await traiterQuetes(null, verifierQuetesMeta(quetesMeta(), ctxMeta())); ;) {
    try {
      let sauvegarde = chargerRun();
      let zones = zonesDuMonde(getMonde(sauvegarde?.run.trancheId ?? `t1`));
      let songes = sauvegarde?.run.mode === MODE_SONGES;
      let { action, ascension, trancheId, idoles, jour } = await ecranAccueil(
        meta,
        () => reinitialiserDofus(meta),
        sauvegarde
          ? {
              zoneNom: zones[sauvegarde.zoneIdx]?.nom ?? `?`,
              zoneNum: sauvegarde.zoneIdx + 1,
              nbZones: zones.length,
              ascension: sauvegarde.run.ascension,
              trancheId: sauvegarde.run.trancheId,
              // Songes infinis : l'étage à reprendre
              ...(songes ? { songes: true, etage: sauvegarde.run.etage } : {}),
            }
          : null,
      );
      if (action === `abandonner`) {
        effacerRun();
        enregistrerRun(meta, false);
        continue;
      }
      if (action === `songes` || (action === `reprendre` && songes)) {
        let suite = await jouerSonges(action === `reprendre` ? sauvegarde : null);
        while (suite?.relancer) {
          suite = await jouerSonges(
            null,
            suite.relancer === `selection` ? undefined : suite.relancer,
          );
        }
        continue;
      }
      let suite = await jouerRun(
        action === `reprendre` ? sauvegarde : null,
        undefined,
        ascension,
        trancheId,
        idoles,
        !!jour,
      );
      while (suite?.relancer) {
        suite = await jouerRun(
          null,
          suite.relancer === `selection` ? undefined : suite.relancer,
          suite.ascension,
          suite.trancheId,
          suite.idoles,
        );
      }
    } catch (erreur) {
      // une exception dans un écran ou dans le moteur ne doit pas figer le jeu : on le dit et on revient à l'accueil
      console.error(erreur);
      try {
        await ecranMessage(
          `Oups`,
          `Une erreur est survenue (${String(erreur?.message ?? erreur).slice(0, 120)}). Retour à l'accueil.`,
        );
      } catch {}
    }
  }
}
