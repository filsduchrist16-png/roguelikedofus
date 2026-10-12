import { ctxMeta, meta, quetesMeta } from "./deroule/etat.js";
import { DOFUS } from "./data/index.js";
import { getMonde, zonesDuMonde } from "./jeu/config.js";
import { verifierQuetesMeta } from "./jeu/quetes.js";
import { chargerRun, effacerRun } from "./sauvegarde/run.js";
import { enregistrerRun, reinitialiserDofus, rendreDofusSuspendus } from "./sauvegarde/meta.js";
import {
  definirRacine,
  fondDuMonde,
  installerInfobulleAide,
  installerInfobulleDofus,
  installerRetourTelephone,
  installerToucheEchap,
  parametres,
} from "./ui/commun.js";
import { installerInfobulleSorts, installerRaccourcisCombat } from "./ui/combat.js";
import { afficherBandeau } from "./ui/ecrans/succes.js";
import { ecranAccueil } from "./ui/ecrans/accueil.js";
import { ecranMessage } from "./ui/ecrans/message.js";
import { ecranConnexion } from "./ui/ecrans/connexion.js";
import { connexionRequise } from "./sauvegarde/compte.js";
import { installerSons } from "./son.js";
import { CLES_TUTO, appliquerAccessibilite, sauverParametres } from "./sauvegarde/parametres.js";
import { traiterQuetes } from "./deroule/quetes.js";
import { jouerRun } from "./deroule/run.js";
import "./style.css";
import "./interface.css";
import "./visuel.css";
import "./confort-run.css";
import "./confort-carte.css";
import "./confort-combat.css";
import "./confort-inventaire.css";
import "./confort-meta.css";
import "./confort-ecrans.css";
function initialiserInterface(elementApp) {
  definirRacine(elementApp);
  fondDuMonde(null);
  // taille du texte et couleurs adaptées (réglages d'accessibilité)
  appliquerAccessibilite(parametres);
  installerInfobulleDofus();
  installerInfobulleSorts();
  installerInfobulleAide();
  installerRaccourcisCombat();
  installerToucheEchap();
  installerRetourTelephone();
  installerSons(parametres.sons);
}
const elementApp = document.getElementById(`app`);
if (!elementApp) {
  throw Error(`#app introuvable`);
}
initialiserInterface(elementApp);
// astuces de première partie : un joueur qui a déjà fini une run (ancienne sauvegarde) ne les revoit pas
if (parametres.vuTuto === null) {
  parametres.vuTuto = Object.fromEntries(CLES_TUTO.map((k) => [k, meta.runs > 0]));
  sauverParametres(parametres);
}
async function boucleJeu() {
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

window.addEventListener(`rld-sauvegarde-echec`, () =>
  afficherBandeau(`⚠ Sauvegarde impossible : le stockage du navigateur est plein ou bloqué`),
);
window.addEventListener(`unhandledrejection`, (ev) => console.error(ev.reason));
boucleJeu();
