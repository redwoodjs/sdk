import { defineApp } from "rwsdk/worker";
import { render, route } from "rwsdk/router";
import { Document } from "./app/Document.js";
import { HomePage } from "./app/pages/HomePage.js";
import { CssModulesPage } from "./app/pages/CssModulesPage.js";
import { SideEffectCssPage } from "./app/pages/SideEffectCssPage.js";

export type AppContext = {};

export default defineApp<AppContext>([
  render(Document, [
    route("/", HomePage),
    route("/css-modules", CssModulesPage),
    route("/side-effect-css", SideEffectCssPage),
  ]),
]);
