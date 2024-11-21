import { createModuleMap } from "./createModuleMap.js";
import { use, renderToHtmlStream } from "vendor/react-ssr";
import { createFromReadableStream } from 'vendor/react-rsc-worker';

export const transformRscToHtmlStream = async (stream: ReadableStream) => {
	const thenable = createFromReadableStream(stream, {
		ssrManifest: {
			moduleMap: createModuleMap(),
			moduleLoading: null,
		},
	})

	//const Component = () => <>{use(thenable)}</>
  const Component = () => <div>hello</div>

	//const r = renderToString(<Component />)
	//console.log('####',r)
	const r = await renderToHtmlStream(<Component />, { onError: (e) => console.error('###############',e) });
	console.log('####',r)
	return r
};
