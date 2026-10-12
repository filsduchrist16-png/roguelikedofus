// Compte et sauvegarde en ligne hors de claude.ai : Supabase, par son API REST (aucune dépendance).
//  - authentification par email + mot de passe (GoTrue) ;
//  - les « documents » de nuage.js sont rangés dans la table public.documents (voir
//    outils/supabase.sql), protégée par RLS : chacun ne touche qu'à ses lignes.
import { SUPABASE_CLE, SUPABASE_URL } from "../config-en-ligne.js";

const CLE_SESSION = `rld_auth_v0`;
let config = { url: SUPABASE_URL, cle: SUPABASE_CLE };
/** Pour les tests. */
export const configurerCompte = (nouvelleConfig) => {
  config = nouvelleConfig;
};
export const compteConfigure = () => !!(config.url && config.cle);

function lireSession() {
  try {
    const session = JSON.parse(localStorage.getItem(CLE_SESSION) ?? `null`);
    return session?.access_token && session?.refresh_token && session?.user?.id ? session : null;
  } catch {
    return null;
  }
}
function ecrireSession(session) {
  try {
    if (session) {
      localStorage.setItem(CLE_SESSION, JSON.stringify(session));
    } else {
      localStorage.removeItem(CLE_SESSION);
    }
  } catch {}
}

/** Le compte connecté sur cet appareil : { id, email } ou null. */
export function compteConnecte() {
  const session = lireSession();
  return session ? { id: session.user.id, email: session.user.email } : null;
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

function memoriser(donnees) {
  const session = {
    access_token: donnees.access_token,
    refresh_token: donnees.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (donnees.expires_in ?? 3600),
    user: { id: donnees.user.id, email: donnees.user.email },
  };
  ecrireSession(session);
  return session;
}

/** Crée un compte. Renvoie { connecte: true } ou { connecte: false } si l'email doit être confirmé. */
export async function creerCompte(email, motDePasse) {
  const donnees = await appeler(`/auth/v1/signup`, {
    methode: `POST`,
    corps: { email: email.trim(), password: motDePasse },
  });
  if (donnees?.access_token) {
    memoriser(donnees);
    return { connecte: true };
  }
  return { connecte: false };
}

export async function seConnecter(email, motDePasse) {
  const donnees = await appeler(`/auth/v1/token?grant_type=password`, {
    methode: `POST`,
    corps: { email: email.trim(), password: motDePasse },
  });
  memoriser(donnees);
}

export function seDeconnecter() {
  ecrireSession(null);
  // à la prochaine ouverture, la page de connexion est de nouveau proposée
  try {
    localStorage.removeItem(CLE_SANS_COMPTE);
  } catch {}
}

const CLE_SANS_COMPTE = `rld_sans_compte_v0`;
/** Faut-il proposer la page de connexion ? Oui s'il y a un serveur, pas de compte connecté et que le joueur n'a pas choisi de jouer sans. */
export function connexionRequise() {
  if (!compteConfigure() || compteConnecte()) {
    return false;
  }
  try {
    return localStorage.getItem(CLE_SANS_COMPTE) !== `1`;
  } catch {
    return false;
  }
}
/** Le joueur choisit de jouer sans compte (sauvegarde locale seulement) ; on ne le redemande plus. */
export function jouerSansCompte() {
  try {
    localStorage.setItem(CLE_SANS_COMPTE, `1`);
  } catch {}
}

// Jeton d'accès valide : renouvelé s'il expire dans moins d'une minute.
async function jetonValide() {
  const session = lireSession();
  if (!session) {
    return null;
  }
  if (session.expires_at - Math.floor(Date.now() / 1000) > 60) {
    return session.access_token;
  }
  try {
    const donnees = await appeler(`/auth/v1/token?grant_type=refresh_token`, {
      methode: `POST`,
      corps: { refresh_token: session.refresh_token },
    });
    return memoriser(donnees).access_token;
  } catch (echec) {
    // refus définitif (session révoquée) : on se déconnecte ; simple coupure réseau : on garde
    if (echec.statut >= 400 && echec.statut < 500) {
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
