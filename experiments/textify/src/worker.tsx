import { ssrWebpackRequire } from "./imports/worker";
import { rscActionHandler } from "./register/worker";
import { TwilioClient } from "./twilio";
import { db, setupDb } from "./db";
import languages from "./languages";

const VOICE_MODEL = "@cf/openai/whisper-large-v3-turbo";
const TEXT_MODEL = "@cf/meta/llama-2-7b-chat-fp16";
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

      setupDb(env);
      // for testing
      if (request.url.includes("/test")) {
        await env.ai_que.send({ 
          from: "whatsapp:+27724217253",
          messageSid: "test",
          queue: "message-que",
          input: {
            text: "test",
          },
        });
        return new Response('OK', { status: 200 });
      }

      // for incoming messages from twilio
      if (request.method === "POST" && request.url.includes("/incoming")) {
        console.log("Incoming request received");
        const body = await request.text();
        const bodyData = new URLSearchParams(body);
        const attachmentUrl = bodyData.get("MediaUrl0");
        const originalMessageSid = bodyData.get("MessageSid");
        const twilioClient = new TwilioClient(env);
        // send a message to the user that we are thinking
        await twilioClient.sendWhatsAppMessage(
          "...",
          bodyData.get("From")!,
          originalMessageSid,
        );
        // do we have a record of this number in the db?
        let user = await db.user.findFirst({
          where: {
            cellnumber: bodyData.get("From")!,
          },
        });
        if (!user) {
          user = await db.user.create({
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
          const mediaUrl = await twilioClient.getMediaUrlFromTwilio(attachmentUrl);
          const response = await fetch(mediaUrl);
          const arrayBuffer = await response.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Process in chunks of 32KB for better performance while staying safe
          const CHUNK_SIZE = 32 * 1024; // 32KB
          let base64AudioString = '';
          
          for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
            const chunk = uint8Array.slice(i, Math.min(i + CHUNK_SIZE, uint8Array.length));
            const binaryString = Array.from(chunk)
              .map(byte => String.fromCharCode(byte))
              .join('');
            base64AudioString += btoa(binaryString);
          }

          if (user) {
            const audioChunk = await db.audioChunk.create({
              data: {
                user_id: user.id,
                chunk: base64AudioString,
              },
            });
            
            if (audioChunk) {
              await env.ai_que.send({
                audioChunkId: audioChunk.id,
                queue: "voice-que",
              });
            } else {
              throw new Error("Audio chunk not created");
            }
          } else {
            throw new Error("User not found");
          }
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
          const languageCode = languages.find(
            (lang) => lang.name.toLowerCase() === language,
          )?.code;
          if (!languageCode) {
            await env.ai_que.send({
              from: bodyData.get("From")!,
              messageSid: bodyData.get("MessageSid")!,
              queue: "message-que",
              input: {
                text: "I don't support that language. Please try again with a supported language or check your spelling.",
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
              text: `Great! I'll now translate your messages to ${language}. ${languages.find((lang) => lang.code === languageCode)?.symbol} You can update your language preference anytime by replying with '@language <language>'`,
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

      return new Response('OK', { status: 200 });
    } catch (e) {
      console.error("Unhandled error", e);
      throw e;
    }
  },

  async queue(batch: any, env: Env): Promise<void> {
    setupDb(env);
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

      if (message.body.queue === "voice-que") {
        console.log("Running whisper model");
        let response = "I could not translate your message, sorry!";
        const audioChunk = await db.audioChunk.findUnique({
          where: {
            id: message.body.audioChunkId,
          },
        });
        const user = await db.user.findUnique({
          where: {
            id: audioChunk?.user_id,
          },
        });
        let sent = true;
        try {
          if (!user) {
            throw new Error("User not found");
          }
          
          const result = await env.AI.run(VOICE_MODEL, {
            audio: audioChunk?.chunk,
            task: "translate",
            language: user.language,
          });
          
          if (!result || !result.text) {
            sent = false;
            throw new Error("No text in whisper response");
          }
          
          response = result.text;
        } catch (e) {
          sent = false;
          console.error("Error running whisper model:", {
            error: e,
            errorMessage: e.message,
            errorStack: e.stack,
            inputLength: message.body.input.audio?.length,
            task: message.body.input.task,
            language: message.body.input.language
          });
          response = "Sorry, I encountered an error while processing your audio message. Please try again.";
        } 
        try {
          const twilioClient = new TwilioClient(env);
          // we need to get the user from the db
          if (!user) {
            throw new Error("User not found");
          }
          await twilioClient.sendWhatsAppMessage(
            response,
            user?.cellnumber,
            null,
          );
        } catch (e) {
          sent = false;
          console.error("Error sending WhatsApp message:", {
            error: e,
            errorMessage: e.message,
            errorStack: e.stack,
            to: message.body.from,
            messageSid: message.body.messageSid,
            responseLength: response?.length
          });
          // Re-throw to ensure the message isn't acked if sending failed
          throw e;
        }

        if (sent) {
          message.ack();
          await db.audioChunk.delete({
            where: {
              id: message.body.audioChunkId,
            },
          });
        } else {
          message.retry();
        }
        
        
      }

      if (message.body.queue === "text-que") {
        console.log("Running text model");
        const response = await env.AI.run(TEXT_MODEL, {
          messages: [
            {
              role: "system",
              content:
                "You are a helpfull and friendly assistant named Frikkie from South Africa and you love meat and rugby.",
            },
            {
              role: "user",
              content: message.body.input.text,
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
