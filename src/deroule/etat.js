// État partagé du déroulé de la run (méta-progression, run en cours) et petits utilitaires.
import { chargerMeta } from "../sauvegarde/meta.js";
import { contexteMeta, nouvelEtatQuetes } from "../jeu/quetes.js";

export const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const choixAleatoireMath = (liste) => liste[Math.floor(Math.random() * liste.length)];
export const meta = chargerMeta();
export const quetesMeta = () => (meta.quetes ??= nouvelEtatQuetes());
export const ctxMeta = () => contexteMeta(meta);
// Run en cours (zone + run) : sert à la sauvegarde quand la page passe en arrière-plan.
export const etatRun = { active: null };
