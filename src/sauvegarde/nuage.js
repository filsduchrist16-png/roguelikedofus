// Sauvegarde en ligne (artefact claude.ai) : la partie est rangée dans la base de l'artefact, à un
// emplacement privé propre au compte claude.ai du joueur. Le même compte retrouve donc sa partie sur
// PC comme sur mobile, sans identifiant ni mot de passe à créer. Hors de l'artefact (version locale),
// tout est simplement indisponible.
import {
  exporterSauvegarde,
  importerSauvegarde,
  resumeSauvegarde,
  sauvegardeDeSecours,
} from "./export.js";

const CLE_SYNC = `rld_sync_v0`;
// une base limite chaque document à 256 Kio : la sauvegarde est découpée en morceaux
const TAILLE_MORCEAU = 180_000;
const DELAI_AUTO = 15_000;

let pret = null;
async function connexion() {
  pret ??= (async () => {
    const use = globalThis.claude?.use;
    if (typeof use !== `function`) {
      // le runtime de l'artefact n'est peut-être pas encore là : on retentera plus tard
      setTimeout(() => (pret = null));
      return null;
    }
    try {
      const [db, user] = await Promise.all([
        use.call(globalThis.claude, `db`),
        use.call(globalThis.claude, `user`),
      ]);
      const id = db && user ? await user.id() : null;
      return id ? { db, base: `data/users/${id}` } : null;
    } catch {
      return null;
    }
  })();
  return pret;
}

function lireSync() {
  try {
    return JSON.parse(localStorage.getItem(CLE_SYNC) ?? `{}`) ?? {};
  } catch {
    return {};
  }
}
function ecrireSync(s) {
  try {
    localStorage.setItem(CLE_SYNC, JSON.stringify({ ...lireSync(), ...s }));
  } catch {}
}
export const syncAuto = () => lireSync().auto !== false;
export function changerSyncAuto(actif) {
  ecrireSync({ auto: actif });
}

const appareil = () =>
  /Android|iPhone|iPad|Mobile/i.test(globalThis.navigator?.userAgent ?? ``) ? `mobile` : `PC`;

/** La sauvegarde en ligne est-elle utilisable ici ? */
export async function nuageDisponible() {
  return !!(await connexion());
}

/** Infos sur la sauvegarde en ligne : { date, appareil, version, resume } ou null s'il n'y en a pas.
 * resume (voir resumeSauvegarde) est null pour une partie envoyée avant qu'on l'ajoute. */
export async function infoNuage() {
  const c = await connexion();
  if (!c) {
    return null;
  }
  const snap = await c.db.doc(`${c.base}/sauvegarde`).get();
  const d = snap.exists ? snap.data() : null;
  return d
    ? { date: d.date, appareil: d.appareil, version: d.version, resume: d.resume ?? null }
    : null;
}

let envoiEnCours = null;
/** Envoie la partie de cet appareil dans le nuage (remplace celle qui y est). */
export async function envoyerNuage() {
  const c = await connexion();
  if (!c) {
    throw Object.assign(Error(`indisponible`), { code: `indisponible` });
  }
  // un seul envoi à la fois (les écritures d'un même document ne se chevauchent pas)
  while (envoiEnCours) {
    await envoiEnCours.catch(() => {});
  }
  envoiEnCours = (async () => {
    const texte = exporterSauvegarde();
    const version = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const n = Math.max(1, Math.ceil(texte.length / TAILLE_MORCEAU));
    // les morceaux d'abord, puis l'en-tête qui pointe vers cette version complète
    for (let k = 0; k < n; k++) {
      await c.db.doc(`${c.base}/partie_${k}`).set({
        version,
        texte: texte.slice(k * TAILLE_MORCEAU, (k + 1) * TAILLE_MORCEAU),
      });
    }
    const date = new Date().toISOString();
    // le résumé (Dofus, quêtes, run) laisse l'autre appareil voir ce qu'il récupérerait
    let resume = null;
    try {
      resume = resumeSauvegarde(JSON.parse(texte));
    } catch {}
    await c.db.doc(`${c.base}/sauvegarde`).set({ version, n, date, appareil: appareil(), resume });
    ecrireSync({ version, date });
    return { date };
  })();
  try {
    return await envoiEnCours;
  } finally {
    envoiEnCours = null;
  }
}

/** Remplace la partie de cet appareil par celle du nuage. true si réussi. */
export async function recupererNuage() {
  const c = await connexion();
  if (!c) {
    return false;
  }
  const tete = await c.db.doc(`${c.base}/sauvegarde`).get();
  const d = tete.exists ? tete.data() : null;
  if (!d?.n) {
    return false;
  }
  let texte = ``;
  for (let k = 0; k < d.n; k++) {
    const m = await c.db.doc(`${c.base}/partie_${k}`).get();
    const md = m.exists ? m.data() : null;
    // un envoi depuis l'autre appareil est en cours : morceaux d'une autre version
    if (!md || md.version !== d.version) {
      return false;
    }
    texte += md.texte;
  }
  // la partie d'ici reste récupérable (Paramètres → « Annuler le dernier import »)
  sauvegardeDeSecours();
  if (!importerSauvegarde(texte)) {
    return false;
  }
  ecrireSync({ version: d.version, date: d.date });
  return true;
}

/** La sauvegarde en ligne vient-elle d'un autre appareil, depuis la dernière synchro d'ici ? */
export async function nuagePlusRecent() {
  const info = await infoNuage().catch(() => null);
  if (!info?.version) {
    return null;
  }
  return info.version !== lireSync().version ? info : null;
}

// Envoi automatique : quelques secondes après la dernière sauvegarde locale (fin de combat…).
let minuteur = null;
export function signalerChangement() {
  if (!syncAuto() || typeof globalThis.claude?.use !== `function`) {
    return;
  }
  clearTimeout(minuteur);
  minuteur = setTimeout(async () => {
    // jamais d'écrasement silencieux : si l'autre appareil a envoyé une partie depuis la dernière
    // synchro d'ici, on attend que le joueur choisisse (bandeau de l'accueil, Paramètres)
    if (await nuagePlusRecent()) {
      return;
    }
    envoyerNuage().catch(() => {});
  }, DELAI_AUTO);
}
