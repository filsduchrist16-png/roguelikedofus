export const nouveauSuiviCombat = () => ({
  rondes: 0,
  morts: new Set(),
  degats: {},
  // coups portés par les héros, par élément (Almanax)
  coups: {},
  soins: 0,
});
export function suivreEvenement(suivi, evenement, combattants) {
  let campDe = (ref) => combattants.find((combattant) => combattant.ref === ref)?.camp;
  switch (evenement.type) {
    case `ronde`:
      suivi.rondes += 1;
      break;
    case `degats`:
      if (evenement.element && campDe(evenement.attaquantRef) === `joueur`) {
        suivi.degats[evenement.element] =
          (suivi.degats[evenement.element] ?? 0) + evenement.montant;
        if (suivi.coups) {
          suivi.coups[evenement.element] = (suivi.coups[evenement.element] ?? 0) + 1;
        }
      }
      break;
    case `soin`:
      if (campDe(evenement.cibleRef) === `joueur`) {
        suivi.soins += evenement.montant;
      }
      break;
    case `mort`:
      suivi.morts.add(evenement.ref);
      break;
  }
}
export function resumeCombat(suivi, contexte) {
  let estMort = (combattant) => suivi.morts.has(combattant.ref) || combattant.pvActuels <= 0;
  let heros = contexte.combattants.filter((combattant) =>
    contexte.herosVivantsAuDepart.includes(combattant.ref),
  );
  return {
    zoneId: contexte.zoneId,
    combatId: contexte.combatId,
    noeud: contexte.noeud,
    gagne: contexte.gagne,
    rondes: suivi.rondes,
    herosKO: heros.some(estMort),
    // héros présents au début du combat (défis « Duo »)
    nbHeros: heros.length,
    // monstres achevés, dans l'ordre (défis « Premier » et « Dernier »)
    ordreVaincus: [...suivi.morts]
      .map((ref) => contexte.combattants.find((combattant) => combattant.ref === ref))
      .filter(
        (combattant) =>
          combattant &&
          combattant.camp === `ennemi` &&
          combattant.monstreId &&
          !combattant.estLance &&
          !combattant.estInvocation &&
          !combattant.invoquePar,
      )
      .map((combattant) => combattant.monstreId),
    classes: contexte.classes,
    ascension: contexte.ascension,
    vaincus: contexte.combattants
      .filter(
        (combattant) =>
          combattant.camp === `ennemi` &&
          combattant.monstreId &&
          !combattant.estLance &&
          estMort(combattant),
      )
      .map((combattant) => combattant.monstreId),
    degatsParElement: suivi.degats,
    soins: suivi.soins,
  };
}
