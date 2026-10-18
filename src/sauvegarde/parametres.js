import { signalerEchecSauvegarde } from "./echec.js";
import { idolesDepartValides } from "../jeu/idolesDepart.js";
const CLE_PARAMETRES = `rld_settings_v0`;
const ORDRE_DEFAUT = {
  iop: 1,
  cra: 2,
  eniripsa: 3,
  ecaflip: 4,
  xelor: 5,
  sram: 6,
  roublard: 7,
  eliotrope: 8,
  forgelance: 9,
  ouginak: 10,
  sadida: 11,
  feca: 12,
  osamodas: 13,
  enutrof: 14,
  sacrieur: 15,
  pandawa: 16,
  zobal: 17,
  steamer: 18,
  huppermage: 19,
};
// Tailles de texte proposées (en % de la taille de base).
export const TAILLES_POLICE = [100, 115, 130];
// Lecture tolérante : toute valeur inconnue (texte, nombre hors liste, null…) donne 100.
export const normaliserTaillePolice = (valeur) => {
  const nombre = typeof valeur === `string` && valeur.trim() !== `` ? Number(valeur) : valeur;
  return TAILLES_POLICE.includes(nombre) ? nombre : 100;
};
export const normaliserCouleursAdaptees = (valeur) => valeur === true;
// Lecture tolérante : seul `true` active l'option (ancienne sauvegarde ou valeur étrangère : désactivée).
export const normaliserReduireAnimations = (valeur) => valeur === true;
// Sons synthétisés : seul `true` les active (par défaut et pour toute valeur étrangère : coupés).
export const normaliserSons = (valeur) => valeur === true;
// Idoles de départ cochées à l'accueil, mémorisées d'une run à l'autre : liste d'identifiants connus
// sans doublon (valeur absente, abîmée ou idole inconnue : ignorée, donc aucune par défaut).
export const normaliserIdolesChoisies = (valeur) => idolesDepartValides(valeur);
// Astuces de première partie : une par moment clé. `vuTuto` vaut null tant que le jeu n'a pas
// décidé (anciens réglages), puis un objet { cle: true } des astuces déjà affichées.
export const CLES_TUTO = [`carte`, `combat`, `butin`, `taverne`];
// Lecture tolérante : `true` (ancien drapeau unique) = tout vu ; objet = on ne garde que les clés
// connues à `true` ; toute autre valeur = null (à décider selon la progression du joueur).
export const normaliserVuTuto = (valeur) => {
  if (valeur === true) {
    return Object.fromEntries(CLES_TUTO.map((cle) => [cle, true]));
  }
  if (valeur && typeof valeur === `object` && !Array.isArray(valeur)) {
    return Object.fromEntries(CLES_TUTO.map((cle) => [cle, valeur[cle] === true]));
  }
  return null;
};
export const tutoVu = (valeur, cle) => normaliserVuTuto(valeur)?.[cle] === true;
// Confort de jeu (1.8.0). Lecture tolérante : une valeur absente ou étrangère reprend le défaut.
const booleen = (valeur, defaut) => (typeof valeur === `boolean` ? valeur : defaut);
// En combat, le dernier sort lancé est re-sélectionné tant que le héros peut le relancer (activé).
export const normaliserReselectionSort = (valeur) => booleen(valeur, true);
// Un seul appui sur un sort qui n'a qu'une cible possible le lance tout de suite (désactivé).
export const normaliserCibleUniqueDirecte = (valeur) => booleen(valeur, false);
// Bouton 🤖 de la barre de combat : joue le tour du héros (`heros`), tous les tours de l'équipe
// jusqu'à la fin du combat (`combat`), ou il est masqué (`cache`).
export const MODES_AUTO = [`heros`, `combat`, `cache`];
export const normaliserModeAuto = (valeur) => (MODES_AUTO.includes(valeur) ? valeur : `heros`);
// Écran du butin : « Équiper le meilleur » appliqué dès l'ouverture (annulable) (désactivé).
export const normaliserButinAutoEquiper = (valeur) => booleen(valeur, false);
// Tri et filtre de l'inventaire, gardés d'une ouverture (et d'une session) à l'autre.
export const TRIS_INVENTAIRE = [`toile`, `type`, `rarete`, `interet`];
export const normaliserTriInventaire = (valeur) =>
  TRIS_INVENTAIRE.includes(valeur) ? valeur : `toile`;
// le filtre est un emplacement (vérifié à l'affichage : inconnu ou vide = « Tout »)
export const normaliserFiltreInventaire = (valeur) =>
  typeof valeur === `string` && /^[a-z_]{1,24}$/.test(valeur) ? valeur : `tout`;
// Objets favoris : clés d'objet (identifiant, rareté et jets), jamais vendus par les ventes groupées.
export const MAX_FAVORIS = 300;
export const normaliserFavoris = (valeur) =>
  Array.isArray(valeur)
    ? [
        ...new Set(
          valeur.filter((cle) => typeof cle === `string` && cle.length > 0 && cle.length <= 600),
        ),
      ].slice(-MAX_FAVORIS)
    : [];
const trie = (objet) =>
  objet && typeof objet === `object`
    ? Object.keys(objet)
        .sort()
        .filter((cle) => typeof objet[cle] === `number`)
        .map((cle) => [cle, objet[cle]])
    : [];
// Clé stable d'un objet : même résultat avant et après un rechargement (l'ordre des stats change).
export const cleFavori = (inst) =>
  JSON.stringify([
    inst?.id ?? ``,
    inst?.rarete ?? ``,
    trie(inst?.stats),
    inst?.adaptatif ?? 0,
    trie(inst?.resistances),
    inst?.pa ?? 0,
  ]);
export const estFavori = (favoris, inst) =>
  Array.isArray(favoris) && favoris.includes(cleFavori(inst));
// Ajoute ou retire un objet des favoris (nouvelle liste, la plus ancienne clé sort au-delà du max).
export const basculerFavori = (favoris, inst) => {
  const liste = normaliserFavoris(favoris);
  const cle = cleFavori(inst);
  return liste.includes(cle)
    ? liste.filter((autre) => autre !== cle)
    : normaliserFavoris([...liste, cle]);
};
// Sections repliées des écrans longs (accueil, succès, HDV…) : { cle: true } seulement.
export const normaliserReplis = (valeur) =>
  valeur && typeof valeur === `object` && !Array.isArray(valeur)
    ? Object.fromEntries(
        Object.entries(valeur)
          .filter(([cle, replie]) => replie === true && /^[\w-]{1,40}$/.test(cle))
          .slice(0, 100),
      )
    : {};
export const sectionRepliee = (reglages, cle) => normaliserReplis(reglages?.replis)[cle] === true;
// Comportement des défilements : instantané si le joueur a réduit les animations (réglage du jeu ou
// préférence du système), progressif sinon.
export const comportementDefilement = (reduire, systemeReduit = false) =>
  reduire === true || systemeReduit === true ? `auto` : `smooth`;
// Pose la taille du texte (tout est en rem) et la classe des couleurs adaptées.
export function appliquerAccessibilite(reglages) {
  try {
    const pct = normaliserTaillePolice(reglages?.taillePolice);
    document.documentElement.style.fontSize = pct === 100 ? `` : `${pct}%`;
    document.body?.classList.toggle(
      `couleurs-adaptees`,
      normaliserCouleursAdaptees(reglages?.couleursAdaptees),
    );
    document.body?.classList.toggle(
      `reduire-animations`,
      normaliserReduireAnimations(reglages?.reduireAnimations),
    );
  } catch {}
}
export const rangOrdre = (ordre, cle) => ordre[cle] ?? 99;
const PARAMETRES_DEFAUT = {
  toucheFinTour: ` `,
  autoFinTour: true,
  // tours des monstres accélérés (délai entre deux actions ennemies)
  combatRapide: false,
  // accessibilité : taille du texte (100, 115 ou 130 %) et couleurs doublées par des signes
  taillePolice: 100,
  couleursAdaptees: false,
  // animations réduites (effets de combat, défilements instantanés)
  reduireAnimations: false,
  // sons synthétisés (coupés par défaut) et idoles de départ mémorisées
  sons: false,
  idolesChoisies: [],
  // astuces de première partie déjà vues (null : pas encore décidé, voir main.js)
  vuTuto: null,
  // confort de jeu (voir les normaliseurs plus haut)
  reselectionSort: true,
  cibleUniqueDirecte: false,
  modeAuto: `heros`,
  butinAutoEquiper: false,
  triInventaire: `toile`,
  filtreInventaire: `tout`,
  favoris: [],
  replis: {},
  formation: {
    iop: `avant`,
    feca: `avant`,
    sram: `avant`,
    ouginak: `avant`,
    forgelance: `avant`,
    cra: `arriere`,
    eniripsa: `arriere`,
    sadida: `arriere`,
    ecaflip: `arriere`,
    roublard: `arriere`,
    xelor: `arriere`,
    eliotrope: `arriere`,
    sacrieur: `avant`,
    pandawa: `avant`,
    zobal: `avant`,
    osamodas: `arriere`,
    enutrof: `arriere`,
    steamer: `arriere`,
    huppermage: `arriere`,
  },
  ordre: {
    ...ORDRE_DEFAUT,
  },
};
const formationValide = (formation) =>
  typeof formation === `object` &&
  !!formation &&
  !Array.isArray(formation) &&
  Object.values(formation).every(
    (valeur) => valeur === `avant` || valeur === `arriere` || typeof valeur === `number`,
  );
const normaliserFormation = (formation) => {
  let resultat = {};
  for (let [cle, valeur] of Object.entries(formation)) {
    resultat[cle] = typeof valeur === `number` ? (valeur < 4 ? `avant` : `arriere`) : valeur;
  }
  return resultat;
};
export function chargerParametres() {
  try {
    let brut = localStorage.getItem(CLE_PARAMETRES);
    if (brut) {
      let reglages = {
        ...PARAMETRES_DEFAUT,
        ...JSON.parse(brut),
      };
      reglages.formation = {
        ...PARAMETRES_DEFAUT.formation,
        ...(formationValide(reglages.formation) ? normaliserFormation(reglages.formation) : {}),
      };
      reglages.taillePolice = normaliserTaillePolice(reglages.taillePolice);
      reglages.couleursAdaptees = normaliserCouleursAdaptees(reglages.couleursAdaptees);
      reglages.reduireAnimations = normaliserReduireAnimations(reglages.reduireAnimations);
      reglages.sons = normaliserSons(reglages.sons);
      reglages.idolesChoisies = normaliserIdolesChoisies(reglages.idolesChoisies);
      reglages.vuTuto = normaliserVuTuto(reglages.vuTuto);
      reglages.reselectionSort = normaliserReselectionSort(reglages.reselectionSort);
      reglages.cibleUniqueDirecte = normaliserCibleUniqueDirecte(reglages.cibleUniqueDirecte);
      reglages.modeAuto = normaliserModeAuto(reglages.modeAuto);
      reglages.butinAutoEquiper = normaliserButinAutoEquiper(reglages.butinAutoEquiper);
      reglages.triInventaire = normaliserTriInventaire(reglages.triInventaire);
      reglages.filtreInventaire = normaliserFiltreInventaire(reglages.filtreInventaire);
      reglages.favoris = normaliserFavoris(reglages.favoris);
      reglages.replis = normaliserReplis(reglages.replis);
      let ordre =
        reglages.ordre && typeof reglages.ordre === `object` && !Array.isArray(reglages.ordre)
          ? reglages.ordre
          : {};
      reglages.ordre = {
        ...ORDRE_DEFAUT,
      };
      for (let [cle, valeur] of Object.entries(ordre)) {
        if (typeof valeur === `number` && Number.isFinite(valeur)) {
          reglages.ordre[cle] = valeur;
        }
      }
      return reglages;
    }
  } catch {}
  return {
    ...PARAMETRES_DEFAUT,
    idolesChoisies: [],
    favoris: [],
    replis: {},
    formation: {
      ...PARAMETRES_DEFAUT.formation,
    },
    ordre: {
      ...ORDRE_DEFAUT,
    },
  };
}
export function sauverParametres(reglages) {
  try {
    localStorage.setItem(CLE_PARAMETRES, JSON.stringify(reglages));
    return true;
  } catch {
    signalerEchecSauvegarde();
    return false;
  }
}
export function nomTouche(touche) {
  if (touche === ` `) {
    return `Espace`;
  }
  if (touche === `Enter`) {
    return `Entrée`;
  }
  if (touche === `Escape`) {
    return `Échap`;
  }
  if (touche === `Tab`) {
    return `Tab`;
  }
  if (touche.startsWith(`Arrow`)) {
    return (
      {
        ArrowUp: `↑`,
        ArrowDown: `↓`,
        ArrowLeft: `←`,
        ArrowRight: `→`,
      }[touche] ?? touche
    );
  }
  if (touche.length === 1) {
    return touche.toUpperCase();
  }
  return touche;
}
