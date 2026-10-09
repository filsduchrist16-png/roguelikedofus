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

// Résumé d'une sauvegarde (objet exporté) pour la montrer avant de remplacer la partie d'ici.
export function resumeSauvegarde(objet) {
  const d = objet?.donnees ?? {};
  const meta = d.rld_meta_v0 ?? {};
  const etat = d.rld_run_v0;
  let run = null;
  if (etat?.run && typeof etat.zoneIdx === `number`) {
    const monde = /^t(\d+)$/.exec(etat.run.trancheId ?? `t1`)?.[1] ?? `1`;
    run = `Monde ${monde} · zone ${etat.zoneIdx + 1}`;
  }
  return {
    date: typeof objet?.date === `string` ? objet.date : null,
    dofus: Array.isArray(meta.dofus) ? meta.dofus.length : 0,
    quetes: Array.isArray(meta.quetes?.faites) ? meta.quetes.faites.length : 0,
    archis: Array.isArray(meta.archis) ? meta.archis.length : 0,
    run,
  };
}
/** Résumé de la partie de cet appareil. */
export function resumePartieLocale() {
  return resumeSauvegarde(JSON.parse(exporterSauvegarde()));
}
/** « 8 Dofus, 140 quêtes, run Monde 2 · zone 5 » (ou « aucune run »). */
export function texteResume(r) {
  if (!r) {
    return `contenu inconnu`;
  }
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? `s` : ``}`;
  return `${r.dofus} Dofus, ${pluriel(r.quetes, `quête`)}, ${pluriel(r.archis, `archimonstre`)}, ${r.run ? `run ${r.run}` : `aucune run`}`;
}
/** Lit le texte d'une sauvegarde exportée : l'objet, ou null s'il n'est pas valide. */
export function lireSauvegarde(texte) {
  try {
    const t = JSON.parse(texte);
    return t?.jeu === `roguefus-lite` &&
      t.donnees &&
      typeof t.donnees === `object` &&
      t.donnees.rld_meta_v0
      ? t
      : null;
  } catch {
    return null;
  }
}

// Copie de secours de la partie d'ici, prise juste avant un import ou une récupération en ligne.
const CLE_SECOURS = `rld_backup_v0`;
export function sauvegardeDeSecours() {
  try {
    const donnees = {};
    for (const k of CLES_SAUVEGARDE) {
      const v = localStorage.getItem(k);
      if (v !== null) {
        donnees[k] = v;
      }
    }
    localStorage.setItem(CLE_SECOURS, JSON.stringify({ date: new Date().toISOString(), donnees }));
    return true;
  } catch {
    return false;
  }
}
/** La copie de secours : { date, donnees } ou null. */
export function infoSecours() {
  try {
    const s = JSON.parse(localStorage.getItem(CLE_SECOURS) ?? `null`);
    return s?.donnees ? s : null;
  } catch {
    return null;
  }
}
/** Remet la partie d'avant le dernier import. true si réussi. */
export function restaurerSecours() {
  const s = infoSecours();
  if (!s) {
    return false;
  }
  try {
    for (const k of CLES_SAUVEGARDE) {
      if (typeof s.donnees[k] === `string`) {
        localStorage.setItem(k, s.donnees[k]);
      } else {
        localStorage.removeItem(k);
      }
    }
    localStorage.removeItem(CLE_SECOURS);
    return true;
  } catch {
    return false;
  }
}
