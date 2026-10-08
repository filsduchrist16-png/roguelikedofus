// Les 8 emplacements d'équipement d'un héros, comme dans Dofus : arme, coiffe, cape, amulette,
// deux anneaux, ceinture et bottes. Un objet de type « anneau » va dans l'un des deux emplacements
// d'anneau ; les autres types ont un seul emplacement, du même nom.
export const EMPLACEMENTS = [
  `arme`,
  `coiffe`,
  `cape`,
  `amulette`,
  `anneau`,
  `anneau2`,
  `ceinture`,
  `bottes`,
];
// Types d'objets (champ `slot` des équipements).
export const TYPES_OBJETS = [`arme`, `coiffe`, `cape`, `amulette`, `anneau`, `ceinture`, `bottes`];

/** Emplacements où peut aller un objet de ce type. */
export const emplacementsDuType = (type) =>
  type === `anneau` ? [`anneau`, `anneau2`] : TYPES_OBJETS.includes(type) ? [type] : [];

/** Type d'objet attendu dans un emplacement. */
export const typeDeEmplacement = (emplacement) =>
  emplacement === `anneau2` ? `anneau` : emplacement;

// Plafonds de PA venant de l'équipement : +1 par les panoplies (non cumulable), +2 en tout.
export const PA_MAX_PANOPLIES = 1;
export const PA_MAX_EQUIPEMENT = 2;
