import { ssrWebpackRequire } from "./imports/worker";
import { rscActionHandler } from "./register/worker";
import { TwilioClient } from "./twilio";
import { setupAI } from "./ai";
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
        const twilioClient = new TwilioClient(env);

        if (attachmentUrl) {
          // while waiting for the audio to be transcribed, send a message to the user
          await twilioClient.sendWhatsAppMessage(
            "Give me a moment while I translate your message...",
            bodyData.get("From")!,
            originalMessageSid,
          );

          const mediaUrl =
            await twilioClient.getMediaUrlFromTwilio(attachmentUrl);
          console.log("MediaUrl", mediaUrl);
          console.log(mediaUrl);
          const res = await fetch(mediaUrl);

          const blob = await res.arrayBuffer();
          const base64String = btoa(
            String.fromCharCode(...new Uint8Array(blob)),
          );

          const input = {
            audio: base64String,
            task: "translate",
          };

          const response = await env.AI.run(
            "@cf/openai/whisper-large-v3-turbo",
            input,
          );

          console.log(response);

          return new Response(response.text!, { status: 200 });
        }

        //if its text we will have a conversation with the user
        await twilioClient.sendWhatsAppMessage(
          "...",
          bodyData.get("From")!,
          bodyData.get("MessageSid")!,
        );
        const response = await env.AI.run("@cf/meta/llama-2-7b-chat-fp16", {
          messages: [
            {
              role: "system",
              content:
                "You are a sarcastic assistant named Frikkie from South Africa and you love meat, rugby and cars and woman. You think you are gods gift to woman.",
            },
            { role: "user", content: bodyData.get("Body") || "" },
          ],
        });
        return new Response(response.response!, { status: 200 });
      }
      const twilioClient = new TwilioClient(env);
      const body = await request.text();
      const bodyData = new URLSearchParams(body);
      await twilioClient.sendWhatsAppMessage(
        "Give me a moment to think about that...",
        bodyData.get("From")!,
        bodyData.get("MessageSid")!,
      );
      const response = await env.AI.run("@cf/meta/llama-2-7b-chat-fp16", {
        messages: [
          { role: "system", content: "You are an unfriendly assistant" },
          // { role: "user", content: bodyData.get("Body") || "" },
          { role: "user", content: bodyData.get("Body") || "" },
        ],
      });
      return new Response(response.response!, { status: 200 });
    } catch (e) {
      console.error("Unhandled error", e);
      throw e;
    }
  },
};
