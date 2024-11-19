import { use as reactUse } from "react";
import { createFromReadableStream } from "react-server-dom-webpack/client.edge";
import { createClientManifest } from "./createClientManifest.js";
import { renderToReadableStream } from "react-dom/server.edge";

export const transformRscToHtmlStream = (stream: ReadableStream) => {
	const Component = () =>
		reactUse<React.ReactElement>(
			createFromReadableStream(stream, {
				ssrManifest: {
					moduleMap: createClientManifest(),
					moduleLoading: null,
				},
			}),
		);

	return renderToReadableStream(<Component />);
};
