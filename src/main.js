import { decrireQuete } from "./jeu/obtention.js";
import { CLASSES, COMBATS, DOFUS, MONSTRES, SORTS } from "./data/index.js";
import {
  CONFIG_ARCHI,
  XP_PAR_COMBAT,
  butinDeZone,
  calculerXpCombattant,
  getMonde,
  zonesDuMonde,
} from "./jeu/config.js";
import { bonusDofus, capturerArchi, chargerMeta, dofusDebloquables, donnerDofusEnAttente, enregistrerRun, reinitialiserDofus, rendreDofusSuspendus, sauverMeta, tousArchisCaptures } from "./sauvegarde/meta.js";
import { chargerRun, effacerRun, sauverRun } from "./sauvegarde/run.js";
import { ecranAccueil } from "./ui/ecrans/accueil.js";
import { ecranCarte } from "./ui/ecrans/carte.js";
import { ecranCombat } from "./ui/combat.js";
import { ecranMessage } from "./ui/ecrans/message.js";
import { ecranTaverne } from "./ui/ecrans/taverne.js";
import { ecranHdv } from "./ui/ecrans/hdv.js";
import { ecranForgemagie } from "./ui/ecrans/forgemagie.js";
import { ecranRencontre } from "./ui/ecrans/rencontre.js";
import { ecranSucces } from "./ui/ecrans/succes.js";
import { ecranParametres } from "./ui/ecrans/parametres.js";
import { ecranFormation } from "./ui/ecrans/formation.js";
import { ecranInventaire } from "./ui/ecrans/inventaire.js";
import { demanderConfirmation } from "./ui/commun.js";
import { jouerCombat } from "./combat/moteur.js";
import { genererCarte, noeudsAtteignables } from "./carte/generation.js";
import { creerCombattantMonstre, creerCombattantPerso, creerEquipe, difficulteDe, effetsDifficulte, prospectionEquipe, tirerButin, tirerMonstreRare } from "./jeu/run.js";
import { appliquerXp, niveauDe } from "./jeu/progression.js";
import { kamasDeCombat, vendreObjet } from "./jeu/economie.js";
import { verifierQuetes, traiterQuetes, quetesMeta, ctxMeta } from "./jeu/quetes.js";
import { etatObjectif } from "./jeu/objectifs.js";
import { etatDefi } from "./jeu/defis.js";
import { planEquiper } from "./jeu/inventaire.js";
import { bonusPanoplie } from "./jeu/panoplies.js";
import { tirerRencontre } from "./jeu/rencontres.js";
import { secretDeMonde } from "./jeu/secret.js";
import { suivreCombat } from "./jeu/suiviCombat.js";
import { chargerParametres, sauverParametres } from "./sauvegarde/parametres.js";
import { exporterSauvegarde, importerSauvegarde, infoSecours, sauvegardeDeSecours, restaurerSecours } from "./sauvegarde/export.js";
import { synchroniser, recupererNuage } from "./sauvegarde/nuage.js";
import "./style.css";
import "./interface.css";
import "./visuel.css";
import "./confort-carte.css";
import "./confort-combat.css";
import "./confort-ecrans.css";
import "./confort-inventaire.css";
import "./confort-meta.css";
import "./confort-run.css";

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled rejection:", e.reason);
});

// ... (le reste du fichier est inchangé jusqu'à boucleJeu)

async function boucleJeu() {
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
      let { action, ascension, trancheId } = await ecranAccueil(
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
      let a = await jouerRun(action === `reprendre` ? e : null, undefined, ascension, trancheId);
      while (a?.relancer) {
        a = await jouerRun(
          null,
          a.relancer === `selection` ? undefined : a.relancer,
          a.ascension,
          a.trancheId,
        );
      }
    } catch (err) {
      console.error(err);
      await ecranMessage(
        `Oups`,
        `Une erreur est survenue : ${err?.message || err}. Retour à l'accueil.`,
      );
      // continue the loop to return to accueil
    }
  }
}
boucleJeu();
