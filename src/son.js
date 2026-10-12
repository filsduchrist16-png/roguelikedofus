// Sons synthétisés avec WebAudio (aucun fichier audio). Coupés par défaut ; le contexte audio n'est
// créé qu'après un geste du joueur (règle d'iOS Safari) et tout est protégé par try/catch : un son
// qui échoue ne doit jamais gêner le jeu.

// Volume général, volontairement discret.
export const VOLUME_SONS = 0.08;

// Chaque son est une suite de notes : f = fréquence (Hz), t = début (s), d = durée (s),
// type = forme d'onde, v = volume relatif (0 à 1).
export const SONS = {
  clic: [{ f: 520, t: 0, d: 0.05, type: `triangle`, v: 0.5 }],
  coup: [
    { f: 180, t: 0, d: 0.09, type: `sawtooth`, v: 0.8 },
    { f: 110, t: 0.04, d: 0.1, type: `square`, v: 0.5 },
  ],
  soin: [
    { f: 523, t: 0, d: 0.1, type: `sine`, v: 0.7 },
    { f: 784, t: 0.08, d: 0.14, type: `sine`, v: 0.7 },
  ],
  victoire: [
    { f: 523, t: 0, d: 0.12, type: `triangle`, v: 0.8 },
    { f: 659, t: 0.12, d: 0.12, type: `triangle`, v: 0.8 },
    { f: 784, t: 0.24, d: 0.12, type: `triangle`, v: 0.8 },
    { f: 1047, t: 0.36, d: 0.3, type: `triangle`, v: 0.9 },
  ],
  defaite: [
    { f: 330, t: 0, d: 0.18, type: `sine`, v: 0.8 },
    { f: 247, t: 0.18, d: 0.18, type: `sine`, v: 0.8 },
    { f: 165, t: 0.36, d: 0.4, type: `sine`, v: 0.8 },
  ],
};

/** Notes d'un son (liste vide pour un nom inconnu). */
export const notesDuSon = (nom) => (Object.hasOwn(SONS, nom) ? SONS[nom] : []);

let contexte = null;
let actif = false;
let installe = false;

/** Active ou coupe les sons (réglage du joueur). */
export function definirSons(oui) {
  actif = oui === true;
  if (actif) {
    contexteAudio();
  }
}

// Crée (ou réveille) le contexte audio. Appelé seulement depuis un geste du joueur (écouteurs
// ci-dessous, ou bouton « Sons » des Paramètres) ; au démarrage il n'est jamais créé.
function contexteAudio() {
  try {
    if (!contexte) {
      const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctx) {
        return null;
      }
      contexte = new Ctx();
    }
    if (contexte.state === `suspended`) {
      contexte.resume?.();
    }
    return contexte;
  } catch {
    return null;
  }
}

// Joue un son si les sons sont activés et si le joueur a déjà fait un geste.
export function jouerSon(nom) {
  if (!actif || !contexte) {
    return;
  }
  try {
    const ctx = contexteAudio();
    if (!ctx) {
      return;
    }
    const debut = ctx.currentTime;
    for (const n of notesDuSon(nom)) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type;
      osc.frequency.value = n.f;
      const t0 = debut + n.t;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(VOLUME_SONS * n.v, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + n.d + 0.02);
    }
  } catch {}
}

// Premier geste (appui ou touche) : c'est lui qui autorise l'audio.
function surGeste() {
  if (actif) {
    contexteAudio();
  }
}

// Son d'un élément ajouté à la page (effets de combat, voile de fin de combat).
function sonDeNoeud(el) {
  const c = el.classList;
  if (c.contains(`fin-combat-voile`)) {
    return c.contains(`victoire`) ? `victoire` : `defaite`;
  }
  if (c.contains(`fx-num`)) {
    if (c.contains(`soin`)) {
      return `soin`;
    }
    if (c.contains(`dmg`) || c.contains(`crit`)) {
      return `coup`;
    }
  }
  return null;
}

/** À appeler une fois au démarrage : écouteurs de gestes, de clics et d'événements de combat. */
export function installerSons(actifAuDepart = false) {
  actif = actifAuDepart === true;
  if (installe) {
    return;
  }
  installe = true;
  try {
    document.addEventListener(`pointerdown`, surGeste, { capture: true, passive: true });
    document.addEventListener(`keydown`, surGeste, { capture: true, passive: true });
    document.addEventListener(
      `click`,
      (ev) => {
        if (ev.target?.closest?.(`button, [role="button"], summary`)) {
          jouerSon(`clic`);
        }
      },
      { passive: true },
    );
    new MutationObserver((lots) => {
      let son = null;
      for (const lot of lots) {
        for (const n of lot.addedNodes) {
          if (n.nodeType === 1) {
            const s = sonDeNoeud(n);
            // un seul son par lot, le plus marquant (victoire/défaite avant coup avant soin)
            if (s && (!son || s === `victoire` || s === `defaite`)) {
              son = s;
            }
          }
        }
      }
      if (son) {
        jouerSon(son);
      }
    }).observe(document.body, { childList: true, subtree: true });
  } catch {}
}
