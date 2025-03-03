import { defineApp } from "redwood-sdk/worker";
import { layout, prefix, route } from "redwood-sdk/router";
import { Document } from "@/app/Document";
import { authRoutes } from "@/app/pages/auth/routes";
import { Session } from "./session/durableObject";
import { db, setupDb } from "@/db";
import { User } from "@prisma/client";
export { SessionDurableObject } from "./session/durableObject";

import crypto from "node:crypto";
import { meetingRoutes } from "./app/pages/meetings/routes";

export type Context = {
  session: Session | null;
  user: User;
};

async function validateZoomWebhook(body: any, env: Env) {
  
  if (body?.event === "endpoint.url_validation") {
    const encryptedToken = crypto
      .createHmac("sha256", env.ZOOM_SECRET_TOKEN)
      .update(body.payload.plainToken)
      .digest("hex");

    return new Response(
      JSON.stringify({
        plainToken: body.payload.plainToken,
        encryptedToken,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}

const app = defineApp<Context>([
  async ({ env, ctx, request }) => {
    await setupDb(env);
  },

  layout(Document, [
    route("/", function () {
      return new Response("Hello World");
    }),
    prefix("/meetings", meetingRoutes),
  ]),
  prefix("/webhook", [
    route("/meeting.recording.completed", [
      async function ({ request, env, ctx }) {
        
        if (
          request.method !== "POST" &&
          request.headers.get("Content-Type") !== "application/json"
        ) {
          return new Response("Invalid request", { status: 400 });
        }

        const body = await request.json<{
          event: string;
          payload: {
            plainToken: string;
            object: {
              uuid: string;
              topic: string;
              start_time: string;
              duration: number;
              share_url: string;
              recording_files: {
                id: string;
                meeting_id: string;
                file_type: string;
                file_extension: string;
                file_size: number;
                recording_start: string;
                recording_end: string;
                download_url: string;
              }[];
            };
            download_token: string;
          };
          download_token: string;
        }>();

        validateZoomWebhook(body, env);
        console.log('-'.repeat(80))
        console.log(JSON.stringify(body));
        console.log('-'.repeat(80))

        const data = {
          id: body.payload.object.uuid,
          topic: body.payload.object.topic,
          startTime: body.payload.object.start_time,
          duration: body.payload.object.duration,
          shareUrl: body.payload.object.share_url,
          rawPayload: '// todo',
        };
        await db.meeting.upsert({
          create: data,
          update: data,
          where: {
            id: data.id,
          },
        });
        await env.QUEUE.send({
          version: "2025-02-26",
          action: "download",
          recordings: body.payload.object.recording_files,
          downloadToken: body.download_token,
        });
        return new Response("OK", { status: 200 });
      },
    ]),
  ]),
]);

export default {
  fetch: app.fetch,
  async queue(batch, env) {
    await setupDb(env);
    for (const message of batch.messages) {
      if (message.body.action === "download") {
        

        const recordings = message.body.recordings;
        console.log(`${recordings.length} recordings to download`);
        const downloadToken = message.body.downloadToken;
        
        for (const recording of recordings) {
        
          const filename = `recording-${recording.meeting_id}-${recording.id}.${recording.file_extension.toLowerCase()}`;
          console.log('downloading', filename);
          const downloadResponse = await fetch(recording.download_url, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${downloadToken}`,
            },
          });
          
          console.log('uploading', filename);
          await env.R2.put(filename, downloadResponse.body);

          const data = {
            id: recording.id,
            meetingId: recording.meeting_id,
            type: recording.recording_type,
            extension: recording.file_extension.toLowerCase(),
            size: recording.file_size,
            startTime: recording.recording_start,
            endTime: recording.recording_end,
            downloadUrl: recording.download_url,
          };
          await db.recording.upsert({
            create: data,
            update: data,
            where: {
              id: recording.id
            },
          });

          console.log(`saved ${recording.id} to db`);
        }
      }

      // if (message.body.action === "email") {
      //   // TODO (peterp, 2025-02-27): Send an email to the user.
      // }
    }
  },
} satisfies ExportedHandler<Env>;
