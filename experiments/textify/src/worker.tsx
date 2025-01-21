import { ssrWebpackRequire } from "./imports/worker";
import { rscActionHandler } from "./register/worker";
import { TwilioClient } from "./twilio";
import { setupAI } from "./ai";
import { db, setupDb } from "./db";
import languages from "./languages";
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
      setupDb(env);


      if (request.method === "POST" && request.url.includes("/incoming")) {
        console.log("Incoming request received");
        const body = await request.text();
        const bodyData = new URLSearchParams(body);
        const attachmentUrl = bodyData.get("MediaUrl0");
        const originalMessageSid = bodyData.get("MessageSid");
        console.log("MessageSid", originalMessageSid);
        console.log("AttachmentUrl", attachmentUrl);
        const twilioClient = new TwilioClient(env);

        // send a message to the user that we are thinking
        await twilioClient.sendWhatsAppMessage("...", bodyData.get("From")!, originalMessageSid);

        // do we have a record of this number in the db?
        const user = await db.user.findFirst({
          where: {
            cellnumber: bodyData.get("From")!,
          },
        });
        if (!user) {
          // we dont know this user yet, so we will create a new record
          // we need to ask the user what language they would want to translate to, default is english
          console.log("Creating new user record");
          await db.user.create({
            data: {
              cellnumber: bodyData.get("From")!,
            },
          });
          await env.ai_que.send({ 
            from: bodyData.get("From")!,
            messageSid: bodyData.get("MessageSid")!,
            queue: "message-que",
            input: {
              text: "Hi there! I'm Frikkie, your friendly assistant. To make things personal, could you please tell me what language you'd like me to translate to? Just reply with the language you prefer like this: '@language english', and I'll be ready to help you! (I support 99 languages)",
            },
          });
        }

        if (attachmentUrl) {
          

          const mediaUrl =
            await twilioClient.getMediaUrlFromTwilio(attachmentUrl);
          console.log("MediaUrl", mediaUrl);
          const res = await fetch(mediaUrl);
          const arrayBuffer = await res.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Convert to base64 in chunks, so we dont exeed the max stack size
          const chunkSize = 0x8000; // 32KB chunks
          let base64String = "";

          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = Array.from(uint8Array.slice(i, i + chunkSize));
            base64String += String.fromCharCode.apply(null, chunk);
          }
          // convert to base64 for model
          base64String = btoa(base64String);

          // TODO: harryhcs - the queue cant take messages of over 128kb, 
          // I need to find a way to split the audio into chunks, and send them to the queue one by one
          const input = {
            audio: base64String,
            task: "translate",
            language: user?.language || "en",
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

        if (bodyData.get("Body")?.includes("@help")) {
          // the user has replied with a language
          await env.ai_que.send({ 
            from: bodyData.get("From")!,
            messageSid: bodyData.get("MessageSid")!,
            queue: "message-que",
            input: {
              text: "I'm here to help you with your messages. You can ask me to translate your messages to any of the 99 languages I support. Just reply with '@language <language>' and I'll be ready to help you! Im not that smart, so if I reply in english, it means I could not translate your message. Err, sorry...",
            },
          });
          return new Response(null, { status: 200 });
        }

        if (bodyData.get("Body")?.includes("@language")) {
          // the user has replied with a language
          const language = bodyData.get("Body")?.split(" ")[1].toLowerCase();
          console.log("Language", language);
          const languageCode = languages.find(
            (lang) => lang.name.toLowerCase() === language,
          )?.code;
          if (!languageCode) {
            await env.ai_que.send({
              from: bodyData.get("From")!,
              messageSid: bodyData.get("MessageSid")!,
              queue: "message-que",
              input: {
                text: "I don't support that language. Please try again with a supported language.",
              },
            });
            return new Response(null, { status: 200 });
          }
          await db.user.update({
            where: {
              cellnumber: bodyData.get("From")!,
            },
            data: {
              language: languageCode,
            },
          });

          await env.ai_que.send({ 
            from: bodyData.get("From")!,
            messageSid: bodyData.get("MessageSid")!,
            queue: "message-que",
            input: {
              text: `Great! I'll now translate your messages to ${language}. You can update your language preference anytime by replying with '@language <language>'`,
            },
          });

          return new Response(null, { status: 200 });
        } else {
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

      if (message.body.queue == "message-que") {
        // send a message to the user
        const twilioClient = new TwilioClient(env);
        await twilioClient.sendWhatsAppMessage(
          message.body.input.text,
          message.body.from,
          message.body.messageSid,
        );
      }

      if (message.body.queue === "thinking") {
        // send a message to the user
        const twilioClient = new TwilioClient(env);
        await twilioClient.sendWhatsAppMessage(
          "..",
          message.body.from,
          message.body.messageSid,
        );
      }

      if (message.body.queue === "voice-que") {
        console.log("Running whisper model");
        const response = await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
          audio: message.body.input.audio,
          task: message.body.input.task,
          language: message.body.input.language,
        });

        const twilioClient = new TwilioClient(env);
        await twilioClient.sendWhatsAppMessage(
          response.text!,
          message.body.from,
          message.body.messageSid,
        );
      }

      if (message.body.queue === "text-que") {
        console.log("Running text model");
        const response = await env.AI.run("@cf/meta/llama-2-7b-chat-fp16", {
          messages: [
            {
              role: "system",
              content:
                "You are a helpfull and friendly assistant named Frikkie from South Africa and you love meat and rugby.",
            },
            {
              role: "user",
              content: message.body.input.text
            },
          ],
        });
        const twilioClient = new TwilioClient(env);
        await twilioClient.sendWhatsAppMessage(
          response.response!,
          message.body.from,
          message.body.messageSid,
        );
      }
    }
  },
};
