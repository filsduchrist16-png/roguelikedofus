export const nouveauSuiviCombat = () => ({
  rondes: 0,
  morts: new Set(),
  degats: {},
  soins: 0,
});
export function suivreEvenement(e, t, n) {
  let r = (e) => n.find((t) => t.ref === e)?.camp;
  switch (t.type) {
    case `ronde`:
      e.rondes += 1;
      break;
    case `degats`:
      if (t.element && r(t.attaquantRef) === `joueur`) {
        e.degats[t.element] = (e.degats[t.element] ?? 0) + t.montant;
      }
      break;
    case `soin`:
      if (r(t.cibleRef) === `joueur`) {
        e.soins += t.montant;
      }
      break;
    case `mort`:
      e.morts.add(t.ref);
      break;
  }
}
export function resumeCombat(e, t) {
  let n = (t) => e.morts.has(t.ref) || t.pvActuels <= 0;
  let r = t.combattants.filter((e) => t.herosVivantsAuDepart.includes(e.ref));
  return {
    zoneId: t.zoneId,
    combatId: t.combatId,
    noeud: t.noeud,
    gagne: t.gagne,
    rondes: e.rondes,
    herosKO: r.some(n),
    // héros présents au début du combat (défis « Duo »)
    nbHeros: r.length,
    // monstres achevés, dans l'ordre (défis « Premier » et « Dernier »)
    ordreVaincus: [...e.morts]
      .map((ref) => t.combattants.find((c) => c.ref === ref))
      .filter((c) => c && c.camp === `ennemi` && c.monstreId && !c.estLance)
      .map((c) => c.monstreId),
    classes: t.classes,
    ascension: t.ascension,
    vaincus: t.combattants
      .filter((e) => e.camp === `ennemi` && e.monstreId && !e.estLance && n(e))
      .map((e) => e.monstreId),
    degatsParElement: e.degats,
    soins: e.soins,
  };
}
