import { App } from "./app/App";
import { renderToRscStream } from "./render/renderToRscStream";
import { transformRscToHtmlStream } from "./render/transformRscToHtmlStream";
import { injectRSCPayload } from "rsc-html-stream/server";
import memoize from 'lodash/memoize.js'

export default {
	async fetch(_request: Request) {
		// todo(justinvdm, 2024-11-19): Handle RSC actions here

		const rscPayloadStream = renderToRscStream(<App />);
		const [rscPayloadStream1, rscPayloadStream2] = rscPayloadStream.tee();
		const htmlStream = await transformRscToHtmlStream(rscPayloadStream1);

		const html = htmlStream.pipeThrough(injectRSCPayload(rscPayloadStream2));
		return new Response(html, {
			headers: { "content-type": "text/html" },
		});
	},
};
