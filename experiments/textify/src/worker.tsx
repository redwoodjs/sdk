import { App } from "./app/App";
import HomePage from "./app/HomePage";
import { transformRscToHtmlStream } from "./render/transformRscToHtmlStream";
import { injectRSCPayload } from "rsc-html-stream/server";
import { renderToRscStream } from "./render/renderToRscStream";
import { ssrWebpackRequire } from "./imports/worker";
import { rscActionHandler } from "./register/worker";
import { TwilioClient } from "./twilio";
import { AI, setupAI } from "./ai";
// import { setupAI } from "./ai";
// import { TwilioClient } from "./twilio";

const routes = {
  "/": HomePage,
};

export default {
  async fetch(request: Request, env: Env) {
    globalThis.__webpack_require__ = ssrWebpackRequire;

    try {
      const url = new URL(request.url);

      const isRSCRequest = url.searchParams.has("__rsc");
      const isRSCActionHandler = url.searchParams.has("__rsc_action_id");

      if (isRSCActionHandler) {
        await rscActionHandler(request);
      }

      if (url.pathname.startsWith("/assets/")) {
        url.pathname = url.pathname.slice("/assets/".length);
        return env.ASSETS.fetch(new Request(url.toString(), request));
      }

      setupAI(env);


      if (request.method === "POST" && request.url.includes("/incoming")) {
        console.log("Incoming request received");
        const body = await request.text();
        const bodyData = new URLSearchParams(body);
        const attachmentUrl = bodyData.get("MediaUrl0");
        const originalMessageSid = bodyData.get("MessageSid");
        console.log("MessageSid", originalMessageSid);
        console.log("AttachmentUrl", attachmentUrl);
        if (attachmentUrl) {
          const twilioClient = new TwilioClient(env);
          const mediaUrl = await twilioClient.getMediaUrlFromTwilio(
            attachmentUrl,
          );
          const blob = await fetch(mediaUrl).then((res) => res.blob()); // fetch the audio blob
          //while waiting for the audio to be transcribed, send a message to the user
          await twilioClient.sendWhatsAppMessage(
            "Give me a moment while I transcribe your message...",
            bodyData.get("From")!,
            originalMessageSid,
          );
          const transcription = await AI.transcribeAudio(blob); // transcribe the audio blob
          await twilioClient.sendWhatsAppMessage(
            transcription!,
            bodyData.get("From")!,
            originalMessageSid,
          );
          // return new Response("OK", { status: 200 });
          return;
        }
        const twilioClient = new TwilioClient(env);
        await twilioClient.sendWhatsAppMessage(
          "Replying to your message...",
          bodyData.get("From")!,
          originalMessageSid,
        );
        return new Response("OK", { status: 200 });
        // return new Response("No audio attachment", { status: 400 });
      }

      const renderPage = async (Page: any, props = {}) => {
        const rscPayloadStream = renderToRscStream(<Page {...props} />);

        if (isRSCRequest) {
          return new Response(rscPayloadStream, {
            headers: { "content-type": "text/x-component; charset=utf-8" },
          });
        }
        const [rscPayloadStream1, rscPayloadStream2] = rscPayloadStream.tee();

        const htmlStream = await transformRscToHtmlStream({
          stream: rscPayloadStream1,
          Parent: App,
        });

        const html = htmlStream.pipeThrough(
          injectRSCPayload(rscPayloadStream2),
        );
        return new Response(html, {
          headers: { "content-type": "text/html" },
        });
      };

      const pathname = new URL(request.url).pathname as keyof typeof routes;
      const Page = routes[pathname];
      return renderPage(Page);
    } catch (e) {
      console.error("Unhandled error", e);
      throw e;
    }
  },
};
