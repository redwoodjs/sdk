import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections'
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers'
import { pluginCodeCaption } from "@fujocoded/expressive-code-caption";

/** @type {import('@astrojs/starlight/expressive-code').StarlightExpressiveCodeOptions} */
export default{
  plugins: [pluginCodeCaption(), pluginCollapsibleSections(), pluginLineNumbers(), ],
}