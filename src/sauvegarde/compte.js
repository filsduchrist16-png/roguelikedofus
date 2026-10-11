// Compte et sauvegarde en ligne hors de claude.ai : Supabase, par son API REST (aucune dépendance).
//  - authentification par email + mot de passe (GoTrue) ;
//  - les « documents » de nuage.js sont rangés dans la table public.documents (voir
//    outils/supabase.sql), protégée par RLS : chacun ne touche qu'à ses lignes.
import { SUPABASE_CLE, SUPABASE_URL } from "../config-en-ligne.js";

const CLE_SESSION = `rld_auth_v0`;
let config = { url: SUPABASE_URL, cle: SUPABASE_CLE };
/** Pour les tests. */
export const configurerCompte = (c) => {
  config = c;
};
export const compteConfigure = () => !!(config.url && config.cle);

function lireSession() {
  try {
    const s = JSON.parse(localStorage.getItem(CLE_SESSION) ?? `null`);
    return s?.access_token && s?.refresh_token && s?.user?.id ? s : null;
  } catch {
    return null;
  }
}
function ecrireSession(s) {
  try {
    if (s) {
      localStorage.setItem(CLE_SESSION, JSON.stringify(s));
    } else {
      localStorage.removeItem(CLE_SESSION);
    }
  } catch {}
}

/** Le compte connecté sur cet appareil : { id, email } ou null. */
export function compteConnecte() {
  const s = lireSession();
  return s ? { id: s.user.id, email: s.user.email } : null;
}

const MESSAGES = {
  invalid_credentials: `Email ou mot de passe incorrect.`,
  email_not_confirmed: `Confirme d'abord ton email (lien reçu par courriel), puis reconnecte-toi.`,
  user_already_exists: `Un compte existe déjà avec cet email : connecte-toi.`,
  weak_password: `Mot de passe trop faible (6 caractères au minimum).`,
  over_email_send_rate_limit: `Trop d'essais : réessaie dans quelques minutes.`,
};
function erreur(reponse, corps) {
  const code = corps?.error_code ?? corps?.code;
  const texte =
    MESSAGES[code] ??
    corps?.msg ??
    corps?.error_description ??
    corps?.message ??
    `erreur ${reponse.status}`;
  return Object.assign(new Error(texte), { code, statut: reponse.status });
}

async function appeler(chemin, { methode = `GET`, corps, jeton, entetes = {} } = {}) {
  let reponse;
  try {
    reponse = await fetch(`${config.url}${chemin}`, {
      method: methode,
      headers: {
        apikey: config.cle,
        Authorization: `Bearer ${jeton ?? config.cle}`,
        ...(corps ? { "Content-Type": `application/json` } : {}),
        ...entetes,
      },
      body: corps ? JSON.stringify(corps) : undefined,
    });
  } catch {
    throw Object.assign(new Error(`pas de connexion internet`), { code: `reseau` });
  }
  let donnees = null;
  try {
    donnees = await reponse.json();
  } catch {}
  if (!reponse.ok) {
    throw erreur(reponse, donnees);
  }
  return donnees;
}

function memoriser(d) {
  const session = {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (d.expires_in ?? 3600),
    user: { id: d.user.id, email: d.user.email },
  };
  ecrireSession(session);
  return session;
}

/** Crée un compte. Renvoie { connecte: true } ou { connecte: false } si l'email doit être confirmé. */
export async function creerCompte(email, motDePasse) {
  const d = await appeler(`/auth/v1/signup`, {
    methode: `POST`,
    corps: { email: email.trim(), password: motDePasse },
  });
  if (d?.access_token) {
    memoriser(d);
    return { connecte: true };
  }
  return { connecte: false };
}

export async function seConnecter(email, motDePasse) {
  const d = await appeler(`/auth/v1/token?grant_type=password`, {
    methode: `POST`,
    corps: { email: email.trim(), password: motDePasse },
  });
  memoriser(d);
}

export function seDeconnecter() {
  ecrireSession(null);
}

// Jeton d'accès valide : renouvelé s'il expire dans moins d'une minute.
async function jetonValide() {
  const s = lireSession();
  if (!s) {
    return null;
  }
  if (s.expires_at - Math.floor(Date.now() / 1000) > 60) {
    return s.access_token;
  }
  try {
    const d = await appeler(`/auth/v1/token?grant_type=refresh_token`, {
      methode: `POST`,
      corps: { refresh_token: s.refresh_token },
    });
    return memoriser(d).access_token;
  } catch (e) {
    // refus définitif (session révoquée) : on se déconnecte ; simple coupure réseau : on garde
    if (e.statut >= 400 && e.statut < 500) {
      ecrireSession(null);
    }
    return null;
  }
}

const filtre = (id, chemin) => `user_id=eq.${id}&chemin=eq.${encodeURIComponent(chemin)}`;

/**
 * Même interface que la base de l'artefact claude.ai (`db.doc(chemin).get() / .set(données)`),
 * pour que nuage.js fonctionne tel quel. Renvoie null s'il n'y a pas de compte connecté.
 */
export async function baseDuCompte() {
  if (!compteConfigure()) {
    return null;
  }
  const jeton = await jetonValide();
  const compte = compteConnecte();
  if (!jeton || !compte) {
    return null;
  }
  const { id } = compte;
  return {
    id,
    db: {
      doc: (chemin) => ({
        async get() {
          const lignes = await appeler(`/rest/v1/documents?${filtre(id, chemin)}&select=donnees`, {
            jeton: (await jetonValide()) ?? jeton,
          });
          return {
            exists: lignes.length > 0,
            data: () => lignes[0]?.donnees,
          };
        },
        async set(donnees) {
          await appeler(`/rest/v1/documents?on_conflict=user_id,chemin`, {
            methode: `POST`,
            jeton: (await jetonValide()) ?? jeton,
            corps: { user_id: id, chemin, donnees, maj: new Date().toISOString() },
            entetes: { Prefer: `resolution=merge-duplicates,return=minimal` },
          });
        },
      }),
    },
  };
}
