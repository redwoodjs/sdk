import { App } from "./app/App";
import { renderToRscStream } from "./render/renderToRscStream";
import { transformRscToHtmlStream } from "./render/transformRscToHtmlStream";
import { injectRSCPayload } from "rsc-html-stream/server";
import memoize from 'lodash/memoize.js'

export default {
	async fetch(_request: Request) {
		// todo(justinvdm, 2024-11-19): Handle RSC actions here

		console.log('### 1')
		const rscPayloadStream = renderToRscStream(<App />);
		console.log('### 2')
		//const [rscPayloadStream1, rscPayloadStream2] = rscPayloadStream.tee();
		console.log('### 3')
		const htmlStream = await transformRscToHtmlStream(rscPayloadStream);
		console.log('### 4')
		//const html = htmlStream.pipeThrough(injectRSCPayload(rscPayloadStream2));
		console.log('### 5')
		return new Response(htmlStream, {
			headers: { "content-type": "text/html" },
		});
	},
};
