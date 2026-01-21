import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import { pluginCodeCaption } from "@fujocoded/expressive-code-caption";
import { pluginColorChips } from "expressive-code-color-chips";
import { createRequire } from "node:module";

// @fujocoded/expressive-code-output is published as ESM + CJS, but the ESM build
// currently contains a dynamic require shim that breaks when Astro loads this
// config file during "astro:config:setup". Force the CJS export.
const require = createRequire(import.meta.url);
const { pluginCodeOutput } = require("@fujocoded/expressive-code-output");

/** @type {import('@astrojs/starlight/expressive-code').StarlightExpressiveCodeOptions} */
export default {
  plugins: [
    pluginCodeCaption(),
    pluginCollapsibleSections(),
    pluginLineNumbers(),
    pluginCodeOutput(),
    pluginColorChips(),
  ],
  defaultProps: {
    // disable line numbers by default
    showLineNumbers: false,
    // But enable line numbers for certain languages
    overridesByLang: {
      "js,ts,css,tsx,jsx": {
        showLineNumbers: true,
      },
    },
  },
};
