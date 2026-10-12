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
      let e = chargerRun();
      let t = zonesDuMonde(getMonde(e?.run.trancheId ?? `t1`));
      let { action, ascension, trancheId, idoles, jour } = await ecranAccueil(
        meta,
        () => reinitialiserDofus(meta),
        e
          ? {
              zoneNom: t[e.zoneIdx]?.nom ?? `?`,
              zoneNum: e.zoneIdx + 1,
              nbZones: t.length,
              ascension: e.run.ascension,
              trancheId: e.run.trancheId,
            }
          : null,
      );
      if (action === `abandonner`) {
        effacerRun();
        enregistrerRun(meta, false);
        continue;
      }
      let a = await jouerRun(
        action === `reprendre` ? e : null,
        undefined,
        ascension,
        trancheId,
        idoles,
        !!jour,
      );
      while (a?.relancer) {
        a = await jouerRun(
          null,
          a.relancer === `selection` ? undefined : a.relancer,
          a.ascension,
          a.trancheId,
          a.idoles,
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
