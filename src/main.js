import { meta } from "./deroule/etat.js";
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
import { installerSons } from "./son.js";
import { CLES_TUTO, appliquerAccessibilite, sauverParametres } from "./sauvegarde/parametres.js";
import { boucleJeu } from "./deroule/boucle.js";
import "./style.css";
import "./interface.css";
import "./visuel.css";
import "./confort-run.css";
import "./confort-carte.css";
import "./confort-combat.css";
import "./confort-inventaire.css";
import "./confort-meta.css";
import "./confort-ecrans.css";
import "./confort-recompenses.css";
import "./confort-gameplay.css";
import "./contenu.css";
import "./confort-ecran-combat.css";
import "./confort-ecrans-run.css";
function initialiserInterface(racine) {
  definirRacine(racine);
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
  parametres.vuTuto = Object.fromEntries(CLES_TUTO.map((cle) => [cle, meta.runs > 0]));
  sauverParametres(parametres);
}
window.addEventListener(`rld-sauvegarde-echec`, () =>
  afficherBandeau(`⚠ Sauvegarde impossible : le stockage du navigateur est plein ou bloqué`),
);
window.addEventListener(`unhandledrejection`, (ev) => console.error(ev.reason));
boucleJeu();
