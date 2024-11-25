import { App } from "./app/App";
import { db, setupDb } from './db';
import { renderToRscStream } from "./render/renderToRscStream";
import { transformRscToHtmlStream } from "./render/transformRscToHtmlStream";
import { injectRSCPayload } from "rsc-html-stream/server";

export default {
	async fetch(_request: Request, env: Env): Promise<Response> {
		setupDb(env)
		// todo(justinvdm, 2024-11-19): Handle RSC actions here

		// harryhcs just loging the data out here
		// useing npx wrangler tail to get the logs inmy terminal

		const results = await db.user.findMany()
		console.log('##', results)

		const rscPayloadStream = renderToRscStream(<App />);
		const [rscPayloadStream1, rscPayloadStream2] = rscPayloadStream.tee();
		const htmlStream = await transformRscToHtmlStream(rscPayloadStream1);

		const html = htmlStream.pipeThrough(injectRSCPayload(rscPayloadStream2));
		return new Response(html, {
			headers: { "content-type": "text/html" },
		});
	},
};
