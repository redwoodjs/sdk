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

      if (request.url.includes("/test")) {
        const from = "whatsapp:+27724217253";
        const messageSid = "1234567890";

        // get a sample audio file
        const testAudio = await fetch(
          "https://mms.twiliocdn.com/AC75b2913291a6bf08df5e07f2f2c12d06/209b38bcd6fb7785b0016abecd2a0005?Expires=1737373130&Signature=O%7EplHd43HCaLRCiFFwY3NpX8HrUU5Q6coUed0h7mi5AQaH87kG4mHpOtWL4ct9oP%7EpNLvxaMQF4ipW50A43DxWdMUMvLeJqxvQV73Dhvx3li4tFbOMl9PUzEGySu44JKTVmyRMDDIWP6slnItZIKMV7KZxxYDPftLzpy76dyOKysD-LV2XHxhbAfIVKR0zHUy2nF%7EnWonIHZ9BinowOrUQGG51VwgnqX0JDjPxAIATrUviuLEbgw7NcXR85hiNSUxMLX0mQXXWGd0ysTVUS2Kj%7EIeq1eZ9vO-N-R7fA6NkE4QCXXFQdhz%7EbxSH5GcUX86G8Dg7HWxqyiqubOSzlPlA__&Key-Pair-Id=APKAIRUDFXVKPONS3KUA",
        );

        const blob = await testAudio.arrayBuffer();
        const base64String = btoa(String.fromCharCode(...new Uint8Array(blob)));

        const input = {
          audio: base64String,
          task: "translate",
        };
        await env.ai_que.send({
          input,
          from,
          messageSid,
          queue: "voice-que",
        });

        return new Response("OK", { status: 200 });
      }

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
          // await twilioClient.sendWhatsAppMessage(
          //   "Give me a moment while I translate your message...",
          //   bodyData.get("From")!,
          //   originalMessageSid,
          // );

          const mediaUrl =
            await twilioClient.getMediaUrlFromTwilio(attachmentUrl);
          console.log("MediaUrl", mediaUrl);
          const res = await fetch(mediaUrl);
          const arrayBuffer = await res.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Convert to base64 in chunks
          const chunkSize = 0x8000; // 32KB chunks
          let base64String = "";

          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = Array.from(uint8Array.slice(i, i + chunkSize));
            base64String += String.fromCharCode.apply(null, chunk);
          }

          base64String = btoa(base64String);

          const input = {
            audio: base64String,
            task: "translate",
          };
          await env.ai_que.send({
            input,
            from: bodyData.get("From")!,
            messageSid: bodyData.get("MessageSid")!,
            queue: "voice-que",
          });

          console.log("Sent to voice-que");

          return new Response(null, { status: 200 });
        }

        // if its text we will have a conversation with the user
        await env.ai_que.send({
          input: {
            text: bodyData.get("Body") || "",
          },
          from: bodyData.get("From")!,
          messageSid: bodyData.get("MessageSid")!,
          queue: "text-que",
        });

        return new Response(null, { status: 200 });
      }

      return new Response(null, { status: 200 });
    } catch (e) {
      console.error("Unhandled error", e);
      throw e;
    }
  },

  async queue(batch: any, env: Env): Promise<void> {
    console.log("Que worker received batch: ", batch.messages.length);
    for (const message of batch.messages) {
      console.log("Audio length: ", message.body.input.audio.length);
      message.ack();
    }

    const response = await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
      audio: batch.messages[1].body.input.audio,
      task: batch.messages[1].body.input.task,
    });

    const twilioClient = new TwilioClient(env);
    await twilioClient.sendWhatsAppMessage(
      response.text!,
      batch.messages[1].body.from,
      batch.messages[1].body.messageSid,
    );

    console.log("Response: ", response);
  },
  //   for (const message of batch.messages) {

  //     if (message.body.queue === "voice-que") {
  //       console.log("Running whisper model");
  //       const response = await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
  //         audio: message.body.input.audio,
  //         task: message.body.input.task,
  //       });

  //       const twilioClient = new TwilioClient(env);
  //       await twilioClient.sendWhatsAppMessage(
  //         response.text!,
  //         message.body.from,
  //         message.body.messageSid,
  //       );
  //     }

  //     if (message.body.queue === "text-que") {
  //       console.log("Running text model");
  //       const response = await env.AI.run("@cf/meta/llama-2-7b-chat-fp16", {
  //         messages: [
  //           {
  //             role: "system",
  //             content:
  //               "You are a helpfull and friendly assistant named Frikkie from South Africa and you love meat and rugby.",
  //           },
  //           { role: "user", content: message.body.input.text },
  //         ],
  //       });
  //       const twilioClient = new TwilioClient(env);
  //       await twilioClient.sendWhatsAppMessage(
  //         response.response!,
  //         message.body.from,
  //         message.body.messageSid,
  //       );
  //     }
  //   }
  // },
};
