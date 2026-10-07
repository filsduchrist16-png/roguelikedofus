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
};
export const rangOrdre = (e, t) => e[t] ?? 99;
const PARAMETRES_DEFAUT = {
  toucheFinTour: ` `,
  autoFinTour: true,
  // tours des monstres accélérés (délai entre deux actions ennemies)
  combatRapide: false,
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
  },
  ordre: {
    ...ORDRE_DEFAUT,
  },
};
const formationValide = (formation) =>
  typeof formation == `object` &&
  !!formation &&
  !Array.isArray(formation) &&
  Object.values(formation).every((e) => e === `avant` || e === `arriere` || typeof e == `number`);
const normaliserFormation = (formation) => {
  let t = {};
  for (let [n, r] of Object.entries(formation)) {
    t[n] = typeof r == `number` ? (r < 4 ? `avant` : `arriere`) : r;
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
      let n = t.ordre && typeof t.ordre == `object` && !Array.isArray(t.ordre) ? t.ordre : {};
      t.ordre = {
        ...ORDRE_DEFAUT,
      };
      for (let [e, r] of Object.entries(n)) {
        if (typeof r == `number` && Number.isFinite(r)) {
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
  } catch {}
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
