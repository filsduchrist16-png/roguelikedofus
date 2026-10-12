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
// Une sauvegarde exportée valide : bon jeu, version connue, et des données de type objet.
function valide(t) {
  return (
    t?.jeu === `roguefus-lite` &&
    (t.version === undefined ||
      (Number.isInteger(t.version) && t.version >= 1 && t.version <= 1)) &&
    t.donnees &&
    typeof t.donnees === `object` &&
    CLES_SAUVEGARDE.every(
      (k) => t.donnees[k] === undefined || (t.donnees[k] && typeof t.donnees[k] === `object`),
    ) &&
    !!t.donnees.rld_meta_v0
  );
}
// Écrit les trois clés d'un coup : si une écriture échoue (quota), les anciennes valeurs sont remises.
function ecrireTout(valeurs) {
  const anciennes = {};
  for (const k of CLES_SAUVEGARDE) {
    anciennes[k] = localStorage.getItem(k);
  }
  try {
    for (const k of CLES_SAUVEGARDE) {
      if (valeurs[k] === null || valeurs[k] === undefined) {
        localStorage.removeItem(k);
      } else {
        localStorage.setItem(k, valeurs[k]);
      }
    }
    return true;
  } catch {
    try {
      for (const k of CLES_SAUVEGARDE) {
        if (anciennes[k] === null) {
          localStorage.removeItem(k);
        } else {
          localStorage.setItem(k, anciennes[k]);
        }
      }
    } catch {}
    return false;
  }
}
export function importerSauvegarde(e) {
  try {
    const t = JSON.parse(e);
    if (!valide(t)) {
      return false;
    }
    const valeurs = {};
    for (const k of CLES_SAUVEGARDE) {
      valeurs[k] = t.donnees[k] === undefined ? null : JSON.stringify(t.donnees[k]);
    }
    return ecrireTout(valeurs);
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
    return valide(t) ? t : null;
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
  const valeurs = {};
  for (const k of CLES_SAUVEGARDE) {
    valeurs[k] = typeof s.donnees[k] === `string` ? s.donnees[k] : null;
  }
  if (!ecrireTout(valeurs)) {
    return false;
  }
  try {
    localStorage.removeItem(CLE_SECOURS);
  } catch {}
  return true;
}
