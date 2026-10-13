const CLES_SAUVEGARDE = [`rld_meta_v0`, `rld_settings_v0`, `rld_run_v0`];
export function exporterSauvegarde() {
  let donnees = {};
  for (let cle of CLES_SAUVEGARDE) {
    try {
      let brut = localStorage.getItem(cle);
      if (brut) {
        donnees[cle] = JSON.parse(brut);
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
function valide(sauvegarde) {
  return (
    sauvegarde?.jeu === `roguefus-lite` &&
    (sauvegarde.version === undefined ||
      (Number.isInteger(sauvegarde.version) &&
        sauvegarde.version >= 1 &&
        sauvegarde.version <= 1)) &&
    sauvegarde.donnees &&
    typeof sauvegarde.donnees === `object` &&
    CLES_SAUVEGARDE.every(
      (cle) =>
        sauvegarde.donnees[cle] === undefined ||
        (sauvegarde.donnees[cle] && typeof sauvegarde.donnees[cle] === `object`),
    ) &&
    !!sauvegarde.donnees.rld_meta_v0
  );
}
// Écrit les trois clés d'un coup : si une écriture échoue (quota), les anciennes valeurs sont remises.
function ecrireTout(valeurs) {
  const anciennes = {};
  for (const cle of CLES_SAUVEGARDE) {
    anciennes[cle] = localStorage.getItem(cle);
  }
  try {
    for (const cle of CLES_SAUVEGARDE) {
      if (valeurs[cle] === null || valeurs[cle] === undefined) {
        localStorage.removeItem(cle);
      } else {
        localStorage.setItem(cle, valeurs[cle]);
      }
    }
    return true;
  } catch {
    try {
      for (const cle of CLES_SAUVEGARDE) {
        if (anciennes[cle] === null) {
          localStorage.removeItem(cle);
        } else {
          localStorage.setItem(cle, anciennes[cle]);
        }
      }
    } catch {}
    return false;
  }
}
export function importerSauvegarde(texte) {
  try {
    const sauvegarde = JSON.parse(texte);
    if (!valide(sauvegarde)) {
      return false;
    }
    const valeurs = {};
    for (const cle of CLES_SAUVEGARDE) {
      valeurs[cle] =
        sauvegarde.donnees[cle] === undefined ? null : JSON.stringify(sauvegarde.donnees[cle]);
    }
    return ecrireTout(valeurs);
  } catch {
    return false;
  }
}

// Résumé d'une sauvegarde (objet exporté) pour la montrer avant de remplacer la partie d'ici.
export function resumeSauvegarde(objet) {
  const donnees = objet?.donnees ?? {};
  const meta = donnees.rld_meta_v0 ?? {};
  const etat = donnees.rld_run_v0;
  let run = null;
  if (etat?.run && typeof etat.zoneIdx === `number`) {
    const monde = /^t(\d+)$/.exec(etat.run.trancheId ?? `t1`)?.[1] ?? `1`;
    run =
      etat.run.mode === `songes`
        ? `Songes · étage ${Number(etat.run.etage) || 1}`
        : `Monde ${monde} · zone ${etat.zoneIdx + 1}`;
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
export function texteResume(resume) {
  if (!resume) {
    return `contenu inconnu`;
  }
  const pluriel = (nombre, mot) => `${nombre} ${mot}${nombre > 1 ? `s` : ``}`;
  return `${resume.dofus} Dofus, ${pluriel(resume.quetes, `quête`)}, ${pluriel(resume.archis, `archimonstre`)}, ${resume.run ? `run ${resume.run}` : `aucune run`}`;
}
/** Lit le texte d'une sauvegarde exportée : l'objet, ou null s'il n'est pas valide. */
export function lireSauvegarde(texte) {
  try {
    const sauvegarde = JSON.parse(texte);
    return valide(sauvegarde) ? sauvegarde : null;
  } catch {
    return null;
  }
}

// Copie de secours de la partie d'ici, prise juste avant un import ou une récupération en ligne.
const CLE_SECOURS = `rld_backup_v0`;
export function sauvegardeDeSecours() {
  try {
    const donnees = {};
    for (const cle of CLES_SAUVEGARDE) {
      const valeur = localStorage.getItem(cle);
      if (valeur !== null) {
        donnees[cle] = valeur;
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
    const secours = JSON.parse(localStorage.getItem(CLE_SECOURS) ?? `null`);
    return secours?.donnees ? secours : null;
  } catch {
    return null;
  }
}
/** Remet la partie d'avant le dernier import. true si réussi. */
export function restaurerSecours() {
  const secours = infoSecours();
  if (!secours) {
    return false;
  }
  const valeurs = {};
  for (const cle of CLES_SAUVEGARDE) {
    valeurs[cle] = typeof secours.donnees[cle] === `string` ? secours.donnees[cle] : null;
  }
  if (!ecrireTout(valeurs)) {
    return false;
  }
  try {
    localStorage.removeItem(CLE_SECOURS);
  } catch {}
  return true;
}
