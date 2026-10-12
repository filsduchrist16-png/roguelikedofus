import { describe, expect, it } from "vitest";
import { actionRetour } from "../src/ui/commun.js";

describe(`C11 : bouton retour du téléphone`, () => {
  const base = { confirmationOuverte: false, combat: false, retour: false, quitterLibre: false };
  it(`un bouton Retour est cliqué`, () => {
    expect(actionRetour({ ...base, retour: true })).toBe(`cliquer`);
  });
  it(`en combat : confirmation, jamais de sortie directe`, () => {
    expect(actionRetour({ ...base, combat: true })).toBe(`confirmer`);
    expect(actionRetour({ ...base, combat: true, retour: true, quitterLibre: true })).toBe(
      `confirmer`,
    );
  });
  it(`accueil et connexion laissent quitter`, () => {
    expect(actionRetour({ ...base, quitterLibre: true })).toBe(`quitter`);
  });
  it(`autre écran sans Retour : confirmation`, () => {
    expect(actionRetour(base)).toBe(`confirmer`);
  });
  it(`une confirmation déjà ouverte est ignorée`, () => {
    expect(actionRetour({ ...base, confirmationOuverte: true, retour: true })).toBe(`ignorer`);
  });
});
