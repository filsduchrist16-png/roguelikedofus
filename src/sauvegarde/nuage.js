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

// Découpe le texte en morceaux sans couper une paire de substitution (emoji) en deux.
export function decouper(texte, taille = TAILLE_MORCEAU) {
  const morceaux = [];
  for (let i = 0; i < texte.length;) {
    let fin = Math.min(texte.length, i + taille);
    const dernier = texte.charCodeAt(fin - 1);
    if (fin < texte.length && dernier >= 0xd800 && dernier <= 0xdbff) {
      fin--;
    }
    morceaux.push(texte.slice(i, fin));
    i = fin;
  }
  return morceaux.length ? morceaux : [``];
}

// Pourquoi la dernière récupération a échoué (pour l'afficher au joueur).
let echec = ``;
export const raisonEchecNuage = () => echec;
const MESSAGES_ECHEC = {
  absent: `aucune partie en ligne`,
  incomplet: `la partie en ligne est incomplète (un envoi était peut-être en cours)`,
  lecture: `lecture impossible (connexion ?)`,
  corrompu: `la partie en ligne est abîmée`,
  stockage: `pas assez de place dans le navigateur de cet appareil`,
};
const echouer = (code, detail = ``) => {
  echec = `${MESSAGES_ECHEC[code] ?? code}${detail ? ` [${detail}]` : ``}`;
  return false;
};
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
async function lireAvecReessais(ref) {
  let derniere;
  for (let essai = 0; essai < 3; essai++) {
    try {
      return await ref.get();
    } catch (e) {
      derniere = e;
      await attendre(400 * (essai + 1));
    }
  }
  throw derniere;
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
    const morceaux = decouper(texte);
    const n = morceaux.length;
    // deux emplacements alternés : l'envoi d'un autre appareil ne peut plus écraser les morceaux
    // que l'en-tête actuel désigne pendant qu'on écrit les nôtres
    let precedent = null;
    try {
      const tete = await c.db.doc(`${c.base}/sauvegarde`).get();
      precedent = tete.exists ? tete.data()?.slot : null;
    } catch {}
    const slot = precedent === `a` ? `b` : `a`;
    // les morceaux d'abord, puis l'en-tête qui pointe vers cette version complète
    for (let k = 0; k < n; k++) {
      await c.db.doc(`${c.base}/partie_${slot}_${k}`).set({ version, texte: morceaux[k] });
    }
    const date = new Date().toISOString();
    // le résumé (Dofus, quêtes, run) laisse l'autre appareil voir ce qu'il récupérerait
    let resume = null;
    try {
      resume = resumeSauvegarde(JSON.parse(texte));
    } catch {}
    await c.db
      .doc(`${c.base}/sauvegarde`)
      .set({ version, n, slot, taille: texte.length, date, appareil: appareil(), resume });
    ecrireSync({ version, date });
    return { date };
  })();
  try {
    return await envoiEnCours;
  } finally {
    envoiEnCours = null;
  }
}

/** Remplace la partie de cet appareil par celle du nuage. true si réussi (sinon voir raisonEchecNuage). */
export async function recupererNuage() {
  echec = ``;
  const c = await connexion();
  if (!c) {
    return echouer(`lecture`, `pas de connexion à l'artefact`);
  }
  let d;
  try {
    const tete = await lireAvecReessais(c.db.doc(`${c.base}/sauvegarde`));
    d = tete.exists ? tete.data() : null;
  } catch (e) {
    return echouer(`lecture`, String(e?.message ?? e).slice(0, 80));
  }
  if (!d?.n) {
    return echouer(`absent`);
  }
  let texte = ``;
  let autreVersion = false;
  for (let k = 0; k < d.n; k++) {
    let md;
    // anciennes sauvegardes : morceaux sans emplacement (partie_k)
    const chemin = d.slot ? `partie_${d.slot}_${k}` : `partie_${k}`;
    try {
      const m = await lireAvecReessais(c.db.doc(`${c.base}/${chemin}`));
      md = m.exists ? m.data() : null;
    } catch (e) {
      return echouer(
        `lecture`,
        `morceau ${k + 1}/${d.n} : ${String(e?.message ?? e).slice(0, 60)}`,
      );
    }
    if (!md || typeof md.texte !== `string`) {
      return echouer(`incomplet`, `morceau ${k + 1}/${d.n} absent`);
    }
    // un autre appareil a envoyé entre-temps : on n'abandonne pas, la validité du contenu décide
    autreVersion ||= md.version !== d.version;
    texte += md.texte;
  }
  if (!autreVersion && typeof d.taille === `number` && texte.length !== d.taille) {
    return echouer(`corrompu`, `taille ${texte.length}/${d.taille}`);
  }
  try {
    JSON.parse(texte);
  } catch {
    return echouer(
      autreVersion ? `incomplet` : `corrompu`,
      autreVersion ? `mélange de deux envois` : `JSON illisible`,
    );
  }
  // la partie d'ici reste récupérable (Paramètres → « Annuler le dernier import »)
  sauvegardeDeSecours();
  if (!importerSauvegarde(texte)) {
    // le plus souvent : navigateur plein. On libère la copie de secours puis on réessaie une fois.
    try {
      localStorage.removeItem(`rld_backup_v0`);
    } catch {}
    if (!importerSauvegarde(texte)) {
      return echouer(`stockage`);
    }
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
