import { beforeEach, describe, expect, it, vi } from "vitest";

// Faux serveur Supabase : auth + table documents.
function stockage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
const lignes = new Map();
let appels;
function faux(maintenant = () => Date.now()) {
  appels = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = new URL(url);
    appels.push({
      chemin: u.pathname + u.search,
      methode: init.method ?? `GET`,
      entetes: init.headers,
    });
    const reponse = (corps, statut = 200) => ({
      ok: statut < 400,
      status: statut,
      json: async () => corps,
    });
    if (u.pathname === `/auth/v1/token`) {
      const corps = JSON.parse(init.body);
      if (u.searchParams.get(`grant_type`) === `password`) {
        return corps.password === `bon-mdp`
          ? reponse({
              access_token: `A1`,
              refresh_token: `R1`,
              expires_in: 3600,
              user: { id: `u1`, email: corps.email },
            })
          : reponse({ error_code: `invalid_credentials`, msg: `x` }, 400);
      }
      return reponse({
        access_token: `A2`,
        refresh_token: `R2`,
        expires_in: 3600,
        user: { id: `u1`, email: `a@b.c` },
      });
    }
    if (u.pathname === `/auth/v1/signup`) {
      return reponse({ id: `u2`, email: `n@b.c` }); // confirmation d'email requise : pas de jeton
    }
    if (u.pathname === `/rest/v1/documents`) {
      if (init.method === `POST`) {
        const c = JSON.parse(init.body);
        lignes.set(`${c.user_id}|${c.chemin}`, c.donnees);
        return reponse(null, 201);
      }
      const id = u.searchParams.get(`user_id`).slice(3);
      const chemin = decodeURIComponent(u.searchParams.get(`chemin`).slice(3));
      return reponse(
        lignes.has(`${id}|${chemin}`) ? [{ donnees: lignes.get(`${id}|${chemin}`) }] : [],
      );
    }
    return reponse({}, 404);
  });
}

describe(`compte Supabase`, () => {
  let compte;
  beforeEach(async () => {
    vi.resetModules();
    lignes.clear();
    globalThis.localStorage = stockage();
    faux();
    compte = await import(`../src/sauvegarde/compte.js`);
    compte.configurerCompte({ url: `https://x.supabase.co`, cle: `CLE-PUBLIQUE` });
  });

  it(`se connecte, range et relit un document, avec la clé publique et le jeton`, async () => {
    expect(compte.compteConnecte()).toBe(null);
    await compte.seConnecter(` moi@mail.com `, `bon-mdp`);
    expect(compte.compteConnecte()).toEqual({ id: `u1`, email: `moi@mail.com` });
    const base = await compte.baseDuCompte();
    await base.db.doc(`data/users/u1/sauvegarde`).set({ version: `v1`, n: 1 });
    const lu = await base.db.doc(`data/users/u1/sauvegarde`).get();
    expect(lu.exists).toBe(true);
    expect(lu.data()).toEqual({ version: `v1`, n: 1 });
    expect((await base.db.doc(`autre`).get()).exists).toBe(false);
    const requeteDoc = appels.find((a) => a.chemin.startsWith(`/rest/v1/documents`));
    expect(requeteDoc.entetes.apikey).toBe(`CLE-PUBLIQUE`);
    expect(requeteDoc.entetes.Authorization).toBe(`Bearer A1`);
  });

  it(`un mauvais mot de passe donne un message clair et aucune session`, async () => {
    await expect(compte.seConnecter(`a@b.c`, `faux`)).rejects.toThrow(/incorrect/);
    expect(compte.compteConnecte()).toBe(null);
    expect(await compte.baseDuCompte()).toBe(null);
  });

  it(`la création de compte sans jeton demande de confirmer l'email`, async () => {
    expect(await compte.creerCompte(`n@b.c`, `123456`)).toEqual({ connecte: false });
    expect(compte.compteConnecte()).toBe(null);
  });

  it(`le jeton proche de l'expiration est renouvelé, la déconnexion efface la session`, async () => {
    await compte.seConnecter(`a@b.c`, `bon-mdp`);
    const s = JSON.parse(localStorage.getItem(`rld_auth_v0`));
    s.expires_at = Math.floor(Date.now() / 1000) + 10;
    localStorage.setItem(`rld_auth_v0`, JSON.stringify(s));
    await compte.baseDuCompte();
    expect(appels.some((a) => a.chemin.includes(`grant_type=refresh_token`))).toBe(true);
    expect(JSON.parse(localStorage.getItem(`rld_auth_v0`)).access_token).toBe(`A2`);
    compte.seDeconnecter();
    expect(compte.compteConnecte()).toBe(null);
  });

  it(`sans configuration, rien n'est disponible`, async () => {
    compte.configurerCompte({ url: ``, cle: `` });
    expect(compte.compteConfigure()).toBe(false);
    expect(await compte.baseDuCompte()).toBe(null);
  });
});
