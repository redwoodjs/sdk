import { renderToRscStream as baseRenderToRscStream } from "vendor/react-rsc-worker";
import { createClientManifest } from "./createClientManifest.js";

export const renderToRscStream = (app: React.ReactElement) =>
  baseRenderToRscStream(app, createClientManifest());
