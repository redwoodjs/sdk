import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections'
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers'
import { pluginCodeCaption } from "@fujocoded/expressive-code-caption";
import { pluginCodeOutput } from "@fujocoded/expressive-code-output";

/** @type {import('@astrojs/starlight/expressive-code').StarlightExpressiveCodeOptions} */
export default{
  plugins: [pluginCodeCaption(), pluginCollapsibleSections(), pluginLineNumbers(), pluginCodeOutput()],
  defaultProps: {
    // disable line numbers by default
    showLineNumbers: false,
    // But enable line numbers for certain languages
    overridesByLang: {
      'js,ts,css,tsx,jsx': {
        showLineNumbers: true,
      }
    }
  }
}
