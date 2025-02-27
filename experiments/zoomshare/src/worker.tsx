import { defineApp } from "@redwoodjs/sdk/worker";
import { layout, prefix, route } from "@redwoodjs/sdk/router";
import { Document } from "@/app/Document";
import { authRoutes } from "@/app/pages/auth/routes";
import { Session } from "./session/durableObject";
import { db, setupDb } from "./db";
import { User } from "@prisma/client";
export { SessionDurableObject } from "./session/durableObject";

import crypto from "node:crypto";
import { meetingRoutes } from "./app/pages/meetings/routes";

export type Context = {
  session: Session | null;
  user: User;
};

async function validateZoomWebhook({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) {
  if (
    request.method !== "POST" &&
    request.headers.get("Content-Type") !== "application/json"
  ) {
    return;
  }

  const body = await request.json<{
    event: string;
    payload: { plainToken: string };
  }>();
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
    setupDb(env);
  },

  layout(Document, [
    route("/", function () {
      return new Response("Hello World");
    }),
    prefix("/meetings", meetingRoutes),
  ]),
  prefix("/webhook", [
    route("/meeting.recording.completed", [
      validateZoomWebhook,
      async function ({ request, env, ctx }) {
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

        const data = {
          id: body.payload.object.uuid,
          topic: body.payload.object.topic,
          startTime: body.payload.object.start_time,
          duration: body.payload.object.duration,
          shareUrl: body.payload.object.share_url,
          rawPayload: "// todo",
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
    for (const message of batch.messages) {
      if (message.body.action === "download") {
        let meetingId: string | null = null;
        console.log("hello....");
        for (const recording of message.body.recordings) {
          meetingId = recording.meeting_id;
          const filename = `recording-${recording.meeting_id}-${recording.id}.${recording.file_extension.toLowerCase()}`;
          console.log(filename);
          const f = await fetch(recording.download_url, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${message.body.downloadToken}`,
            },
          });
          // TODO: (peterp, 2025-02-27): We need to ensure that we put in the correct mime type?
          await env.R2.put(filename, f.body);
          console.log("saved to r2");
          const data = {
            id: recording.id,
            meetingId: recording.meeting_id,
            type: recording.file_type,
            extension: recording.file_extension.toLowerCase(),
            size: recording.file_size,
            startTime: recording.recording_start,
            endTime: recording.recording_end,
            downloadUrl: recording.download_url,
          };
          console.log("saving to db");
          await db.recording.upsert({
            create: data,
            update: data,
            where: {
              id: data.id,
            },
          });
          console.log("saved to db");
        }
      }

      if (message.body.action === "email") {
        // TODO (peterp, 2025-02-27): Send an email to the user.
      }
    }
  },
} satisfies ExportedHandler<Env>;
