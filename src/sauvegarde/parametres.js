import { signalerEchecSauvegarde } from "./echec.js";
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
export const normaliserTaillePolice = (v) => {
  const n = typeof v === `string` && v.trim() !== `` ? Number(v) : v;
  return TAILLES_POLICE.includes(n) ? n : 100;
};
export const normaliserCouleursAdaptees = (v) => v === true;
// Lecture tolérante : seul `true` active l'option (ancienne sauvegarde ou valeur étrangère : désactivée).
export const normaliserReduireAnimations = (v) => v === true;
// Comportement des défilements : instantané si le joueur a réduit les animations (réglage du jeu ou
// préférence du système), progressif sinon.
export const comportementDefilement = (reduire, systemeReduit = false) =>
  reduire === true || systemeReduit === true ? `auto` : `smooth`;
// Pose la taille du texte (tout est en rem) et la classe des couleurs adaptées.
export function appliquerAccessibilite(p) {
  try {
    const pct = normaliserTaillePolice(p?.taillePolice);
    document.documentElement.style.fontSize = pct === 100 ? `` : `${pct}%`;
    document.body?.classList.toggle(
      `couleurs-adaptees`,
      normaliserCouleursAdaptees(p?.couleursAdaptees),
    );
    document.body?.classList.toggle(
      `reduire-animations`,
      normaliserReduireAnimations(p?.reduireAnimations),
    );
  } catch {}
}
export const rangOrdre = (e, t) => e[t] ?? 99;
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
  Object.values(formation).every((e) => e === `avant` || e === `arriere` || typeof e === `number`);
const normaliserFormation = (formation) => {
  let t = {};
  for (let [n, r] of Object.entries(formation)) {
    t[n] = typeof r === `number` ? (r < 4 ? `avant` : `arriere`) : r;
  }
  return t;
};
export function chargerParametres() {
  try {
    let e = localStorage.getItem(CLE_PARAMETRES);
    if (e) {
      let t = {
        ...PARAMETRES_DEFAUT,
        ...JSON.parse(e),
      };
      t.formation = {
        ...PARAMETRES_DEFAUT.formation,
        ...(formationValide(t.formation) ? normaliserFormation(t.formation) : {}),
      };
      t.taillePolice = normaliserTaillePolice(t.taillePolice);
      t.couleursAdaptees = normaliserCouleursAdaptees(t.couleursAdaptees);
      t.reduireAnimations = normaliserReduireAnimations(t.reduireAnimations);
      let n = t.ordre && typeof t.ordre === `object` && !Array.isArray(t.ordre) ? t.ordre : {};
      t.ordre = {
        ...ORDRE_DEFAUT,
      };
      for (let [e, r] of Object.entries(n)) {
        if (typeof r === `number` && Number.isFinite(r)) {
          t.ordre[e] = r;
        }
      }
      return t;
    }
  } catch {}
  return {
    ...PARAMETRES_DEFAUT,
    formation: {
      ...PARAMETRES_DEFAUT.formation,
    },
    ordre: {
      ...ORDRE_DEFAUT,
    },
  };
}
export function sauverParametres(e) {
  try {
    localStorage.setItem(CLE_PARAMETRES, JSON.stringify(e));
    return true;
  } catch {
    signalerEchecSauvegarde();
    return false;
  }
}
export function nomTouche(e) {
  if (e === ` `) {
    return `Espace`;
  }
  if (e === `Enter`) {
    return `Entrée`;
  }
  if (e === `Escape`) {
    return `Échap`;
  }
  if (e === `Tab`) {
    return `Tab`;
  }
  if (e.startsWith(`Arrow`)) {
    return (
      {
        ArrowUp: `↑`,
        ArrowDown: `↓`,
        ArrowLeft: `←`,
        ArrowRight: `→`,
      }[e] ?? e
    );
  }
  if (e.length === 1) {
    return e.toUpperCase();
  }
  return e;
}
