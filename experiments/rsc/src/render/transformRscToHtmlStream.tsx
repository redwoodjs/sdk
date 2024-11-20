import React from "react";
import { createFromReadableStream } from "react-server-dom-webpack/client.edge";
import { createModuleMap } from "./createModuleMap.js";
import { renderToReadableStream } from "react-dom/server.edge";

export const transformRscToHtmlStream = async (stream: ReadableStream) => {
	const thenable = createFromReadableStream(stream, {
		ssrManifest: {
			moduleMap: createModuleMap(),
			moduleLoading: null,
		},
	})

	const Component = () => <>{React.use(thenable)}</>

	//const r = renderToString(<Component />)
	//console.log('####',r)
	const r = await renderToReadableStream(<Component />, { onError: (e) => console.error('###############',e) });
	console.log('####',r)
	return r
};
