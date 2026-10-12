// Sauvegarde en ligne (artefact claude.ai) : la partie est rangée dans la base de l'artefact, à un
// emplacement privé propre au compte claude.ai du joueur. Le même compte retrouve donc sa partie sur
// PC comme sur mobile, sans identifiant ni mot de passe à créer. Hors de l'artefact (version locale),
// tout est simplement indisponible.
import { baseDuCompte, compteConfigure } from "./compte.js";
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
      // hors de claude.ai : compte Supabase s'il est configuré et connecté
      const base = await baseDuCompte().catch(() => null);
      return base ? { db: base.db, base: `data/users/${base.id}` } : null;
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
function ecrireSync(modif) {
  try {
    localStorage.setItem(CLE_SYNC, JSON.stringify({ ...lireSync(), ...modif }));
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
  const acces = await connexion();
  if (!acces) {
    return null;
  }
  const snap = await acces.db.doc(`${acces.base}/sauvegarde`).get();
  const donnees = snap.exists ? snap.data() : null;
  return donnees
    ? {
        date: donnees.date,
        appareil: donnees.appareil,
        version: donnees.version,
        resume: donnees.resume ?? null,
      }
    : null;
}

// Découpe le texte en morceaux sans couper une paire de substitution (emoji) en deux.
export function decouper(texte, taille = TAILLE_MORCEAU) {
  const morceaux = [];
  for (let debut = 0; debut < texte.length;) {
    let fin = Math.min(texte.length, debut + taille);
    const dernier = texte.charCodeAt(fin - 1);
    if (fin < texte.length && dernier >= 0xd800 && dernier <= 0xdbff) {
      fin--;
    }
    morceaux.push(texte.slice(debut, fin));
    debut = fin;
  }
  return morceaux.length ? morceaux : [``];
}

// Pourquoi la dernière récupération a échoué (pour l'afficher au joueur).
let echec = ``;
export const raisonEchecNuage = () => echec;
// Remarque à montrer après une récupération réussie (ex. copie de secours supprimée).
let avertissement = ``;
export const avertissementNuage = () => avertissement;
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
const attendre = (ms) => new Promise((resoudre) => setTimeout(resoudre, ms));
async function lireAvecReessais(ref) {
  let derniere;
  for (let essai = 0; essai < 3; essai++) {
    try {
      return await ref.get();
    } catch (erreur) {
      derniere = erreur;
      await attendre(400 * (essai + 1));
    }
  }
  throw derniere;
}

let envoiEnCours = null;
/** Envoie la partie de cet appareil dans le nuage (remplace celle qui y est). */
export async function envoyerNuage() {
  const acces = await connexion();
  if (!acces) {
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
    const nbMorceaux = morceaux.length;
    // deux emplacements alternés : l'envoi d'un autre appareil ne peut plus écraser les morceaux
    // que l'en-tête actuel désigne pendant qu'on écrit les nôtres
    let precedent = null;
    try {
      const tete = await acces.db.doc(`${acces.base}/sauvegarde`).get();
      precedent = tete.exists ? tete.data()?.slot : null;
    } catch {}
    const slot = precedent === `a` ? `b` : `a`;
    // les morceaux d'abord, puis l'en-tête qui pointe vers cette version complète
    for (let indice = 0; indice < nbMorceaux; indice++) {
      await acces.db
        .doc(`${acces.base}/partie_${slot}_${indice}`)
        .set({ version, texte: morceaux[indice] });
    }
    const date = new Date().toISOString();
    // le résumé (Dofus, quêtes, run) laisse l'autre appareil voir ce qu'il récupérerait
    let resume = null;
    try {
      resume = resumeSauvegarde(JSON.parse(texte));
    } catch {}
    await acces.db
      .doc(`${acces.base}/sauvegarde`)
      .set({
        version,
        n: nbMorceaux,
        slot,
        taille: texte.length,
        date,
        appareil: appareil(),
        resume,
      });
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
  const acces = await connexion();
  if (!acces) {
    return echouer(`lecture`, `pas de connexion à l'artefact`);
  }
  let entete;
  try {
    const tete = await lireAvecReessais(acces.db.doc(`${acces.base}/sauvegarde`));
    entete = tete.exists ? tete.data() : null;
  } catch (erreur) {
    return echouer(`lecture`, String(erreur?.message ?? erreur).slice(0, 80));
  }
  if (!entete?.n) {
    return echouer(`absent`);
  }
  let texte = ``;
  let autreVersion = false;
  for (let indice = 0; indice < entete.n; indice++) {
    let md;
    // anciennes sauvegardes : morceaux sans emplacement (partie_k)
    const chemin = entete.slot ? `partie_${entete.slot}_${indice}` : `partie_${indice}`;
    try {
      const morceau = await lireAvecReessais(acces.db.doc(`${acces.base}/${chemin}`));
      md = morceau.exists ? morceau.data() : null;
    } catch (erreur) {
      return echouer(
        `lecture`,
        `morceau ${indice + 1}/${entete.n} : ${String(erreur?.message ?? erreur).slice(0, 60)}`,
      );
    }
    if (!md || typeof md.texte !== `string`) {
      return echouer(`incomplet`, `morceau ${indice + 1}/${entete.n} absent`);
    }
    // un autre appareil a envoyé entre-temps : on n'abandonne pas, la validité du contenu décide
    autreVersion ||= md.version !== entete.version;
    texte += md.texte;
  }
  if (!autreVersion && typeof entete.taille === `number` && texte.length !== entete.taille) {
    return echouer(`corrompu`, `taille ${texte.length}/${entete.taille}`);
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
  avertissement = ``;
  if (!sauvegardeDeSecours()) {
    return echouer(
      `stockage`,
      `copie de secours impossible : ta partie actuelle ne serait pas récupérable`,
    );
  }
  if (!importerSauvegarde(texte)) {
    // le plus souvent : navigateur plein. On libère la copie de secours puis on réessaie une fois.
    try {
      localStorage.removeItem(`rld_backup_v0`);
    } catch {}
    if (!importerSauvegarde(texte)) {
      return echouer(`stockage`);
    }
    avertissement = `La copie de secours de ta partie d'avant a été supprimée pour faire de la place.`;
  }
  ecrireSync({ version: entete.version, date: entete.date });
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
  if (!syncAuto() || (typeof globalThis.claude?.use !== `function` && !compteConfigure())) {
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
