import AdminPage from "./app/AdminPage";
import { App } from "./app/App";
import HomePage from "./app/HomePage";
import { renderToRscStream } from "./render/renderToRscStream";
import { transformRscToHtmlStream } from "./render/transformRscToHtmlStream";
import { injectRSCPayload } from "rsc-html-stream/server";

// todo(peterp, 2024-11-25): Make these lazy.
const routes = {
	'/': HomePage,
	'/admin': AdminPage
}

export default {
	async fetch(request: Request) {
		// todo(justinvdm, 2024-11-19): Handle RSC actions here

		const pathname = new URL(request.url).pathname as keyof typeof routes
		const Page = routes[pathname]
		if (!Page) {			
			// todo(peterp, 2024-11-25): Return not found page, if exists
			return new Response('Not found', { status: 404 })
		}

		const rscPayloadStream = renderToRscStream(<App><Page /></App>);
		const [rscPayloadStream1, rscPayloadStream2] = rscPayloadStream.tee();
		const htmlStream = await transformRscToHtmlStream(rscPayloadStream1);
		const html = htmlStream.pipeThrough(injectRSCPayload(rscPayloadStream2));
		return new Response(html, {
			headers: { "content-type": "text/html" },
		});
	},
};
