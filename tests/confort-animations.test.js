import { beforeEach, describe, expect, it, vi } from "vitest";

describe(`C10 : réduire les animations`, () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.localStorage = {
      _m: new Map(),
      getItem(k) {
        return this._m.has(k) ? this._m.get(k) : null;
      },
      setItem(k, v) {
        this._m.set(k, String(v));
      },
      removeItem(k) {
        this._m.delete(k);
      },
    };
  });

  it(`comportementDefilement : auto si réglage ou système, sinon smooth`, async () => {
    const { comportementDefilement } = await import(`../src/sauvegarde/parametres.js`);
    expect(comportementDefilement(false, false)).toBe(`smooth`);
    expect(comportementDefilement(undefined)).toBe(`smooth`);
    expect(comportementDefilement(true, false)).toBe(`auto`);
    expect(comportementDefilement(false, true)).toBe(`auto`);
  });

  it(`ancien réglage sans le champ ou valeur étrangère : désactivé`, async () => {
    const { chargerParametres } = await import(`../src/sauvegarde/parametres.js`);
    expect(chargerParametres().reduireAnimations).toBe(false);
    localStorage.setItem(`rld_settings_v0`, JSON.stringify({ reduireAnimations: `oui` }));
    expect(chargerParametres().reduireAnimations).toBe(false);
    localStorage.setItem(`rld_settings_v0`, JSON.stringify({ reduireAnimations: true }));
    expect(chargerParametres().reduireAnimations).toBe(true);
  });
});
