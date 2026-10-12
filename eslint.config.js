import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: [`dist/`, `dist-artefact/`, `node_modules/`, `public/`, `src/data/`] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: `latest`,
      sourceType: `module`,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-empty": [`error`, { allowEmptyCatch: true }],
      "no-shadow": `warn`,
      "no-unused-vars": [`warn`, { args: `none`, caughtErrors: `none` }],
      "no-sequences": `warn`,
      eqeqeq: [`warn`, `always`, { null: `ignore` }],
    },
  },
];
