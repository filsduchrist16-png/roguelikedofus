// Production : les données du jeu (équipements, monstres, succès…) sont dans des fichiers séparés du
// code, mis en cache à part et chargés en parallèle. La version claude.ai a sa propre configuration
// (outils/artefact/vite.config.js, copiée par construire.sh).
export default {
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes(`/src/data/`) && id.endsWith(`.json`)) {
            return `donnees`;
          }
        },
      },
    },
  },
};
