const CLES_SAUVEGARDE = [`rld_meta_v0`, `rld_settings_v0`, `rld_run_v0`];
export function exporterSauvegarde() {
  let donnees = {};
  for (let t of CLES_SAUVEGARDE) {
    try {
      let n = localStorage.getItem(t);
      if (n) {
        donnees[t] = JSON.parse(n);
      }
    } catch {}
  }
  return JSON.stringify(
    {
      jeu: `roguefus-lite`,
      version: 1,
      date: new Date().toISOString(),
      donnees,
    },
    null,
    2,
  );
}
export function importerSauvegarde(e) {
  try {
    let t = JSON.parse(e);
    if (
      t.jeu !== `roguefus-lite` ||
      typeof t.donnees != `object` ||
      !t.donnees ||
      !t.donnees.rld_meta_v0
    ) {
      return false;
    }
    for (let e of CLES_SAUVEGARDE) {
      if (t.donnees[e] === undefined) {
        localStorage.removeItem(e);
      } else {
        localStorage.setItem(e, JSON.stringify(t.donnees[e]));
      }
    }
    return true;
  } catch {
    return false;
  }
}
