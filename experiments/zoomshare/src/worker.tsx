import { defineApp } from "@redwoodjs/sdk/worker";
import { index, layout, prefix, route } from "@redwoodjs/sdk/router";
import { Document } from "@/app/Document";
import { Home } from "@/app/pages/Home";
import { authRoutes } from "@/app/pages/auth/routes";
import { sessions, setupSessionStore } from "./session/store";
import { Session } from "./session/durableObject";
import { db, setupDb } from "./db";
import { User } from "@prisma/client";
import { InputJsonValue, JsonValue } from "@prisma/client/runtime/library";
export { SessionDurableObject } from "./session/durableObject";

import crypto from "node:crypto";

export type Context = {
  session: Session | null;
  user: User;
};

const testPayload = JSON.parse(
  '{"payload":{"account_id":"bxTu88fMRR6lJDWVEJ4P9A","object":{"uuid":"DUZke5GtTtuQlcx4mUo0Xw==","id":88031573992,"account_id":"bxTu88fMRR6lJDWVEJ4P9A","host_id":"Hb_L4uIhQeK1pCGVX_cnew","topic":"Peter Pistorius\'s Zoom Meeting","type":1,"start_time":"2025-02-26T13:31:01Z","timezone":"","host_email":"peter.pistorius@gmail.com","duration":0,"total_size":580216,"recording_count":3,"share_url":"https://us06web.zoom.us/rec/share/D2Ge18UEXSj88aMed-g92uB8jl4ifZu_O_x_e9MISH_fk-e8HjXqBaYevTE8ICD4.CHzVCPLdQ9sgABjL","recording_files":[{"id":"6606c8c8-9ab6-4700-8562-4685827be2ef","meeting_id":"DUZke5GtTtuQlcx4mUo0Xw==","recording_start":"2025-02-26T13:31:22Z","recording_end":"2025-02-26T13:31:39Z","file_type":"MP4","file_extension":"MP4","file_size":308098,"play_url":"https://us06web.zoom.us/rec/play/L21e_1yuMexp6X9eZV2ReylnlbN1WGQOydw_Mah-2rX62t1N0DlE3wnYqrfDDuxNeQIoobn2QqZiW7v7.nTUKh5GAAyjXRDcA","download_url":"https://us06web.zoom.us/rec/webhook_download/L21e_1yuMexp6X9eZV2ReylnlbN1WGQOydw_Mah-2rX62t1N0DlE3wnYqrfDDuxNeQIoobn2QqZiW7v7.nTUKh5GAAyjXRDcA/eiISnQERMsuV9Y9eJUX1aT7BvvtvGLiRXO2z6ILTxjfm2g_fYPNOTiguLKOCNisLtl7RVjQkIHQmEIMb--oMPWzUX5e90FhNaQCsdZYEMdh2ErDUf6_vJ0L47u5T79OrE4NKWW9ItjIrZIC4IYUjCPSv3ymkTuvbbP5TwQd-GkQvRNGgfZqscppK7CxyLoXsMdWRpJeqeLZsKHhONBLrPWMOZw0EU7rJ1V3zlqitQM6m98oCTZXviut54eCOhUuTlcaYdbwmSOBnckh68pq7KunN7MwklJDRGMUWV-bC2lsdChMmFlwOUtk9f6qL-AqO0qWn8rLxqh6mH3IGX9Snyg","status":"completed","recording_type":"shared_screen_with_speaker_view","encryption_fingerprint":""},{"id":"dbe16fc3-7789-4dd9-9ff9-3716bfb19269","meeting_id":"DUZke5GtTtuQlcx4mUo0Xw==","recording_start":"2025-02-26T13:31:22Z","recording_end":"2025-02-26T13:31:39Z","file_type":"M4A","file_extension":"M4A","file_size":265556,"play_url":"https://us06web.zoom.us/rec/play/IYcYs2JGtFiNyf8sMIjCy40fb6bwJu84fW1jziV8CQGuy99Pk6cQ86tPKhcyMka2a-BnlKGi4JRgHFJR.NI9ZIg6R-wWymuFQ","download_url":"https://us06web.zoom.us/rec/webhook_download/IYcYs2JGtFiNyf8sMIjCy40fb6bwJu84fW1jziV8CQGuy99Pk6cQ86tPKhcyMka2a-BnlKGi4JRgHFJR.NI9ZIg6R-wWymuFQ/SBLx-n28OAm8v0djzcyQQ0BSY6alj73FKIPXdkYxTDFrqO2-xNK_xTWMva7w-gySHHgq7mouhuiPqz012uYdFgtze9PpwLEpMtXlhMsmnHwqx9TCFQ_OM7wJEMLdZwCfMMpocSjuL6ZMjl7QHu7a17bt8SCw7i-ik_UkEYMVHOqAl5Y_tpzjI46Pb_rpDbIS1ka5qwPnrESW1C6RaZ3jqBWFltPnbE2u2RiKvyVTaHjpScwh_QsgKS69MDxmInSTaeUXWPeckGJBsYUMG-WDYa5IBPQ30vV797XT-7dIxpVuHoZp2BGk0pIY9JqVa23DKXGMarKn3wA6SD5mBOJW_w","status":"completed","recording_type":"audio_only","encryption_fingerprint":""},{"id":"d3e8730e-ccf1-4d2b-8be5-3b184b5d9b33","meeting_id":"DUZke5GtTtuQlcx4mUo0Xw==","recording_start":"2025-02-26T13:31:22Z","recording_end":"2025-02-26T13:31:39Z","file_type":"TIMELINE","file_extension":"JSON","file_size":6562,"download_url":"https://us06web.zoom.us/rec/webhook_download/XwuvtXlgkW7M8jtjD7q7btg0eIFSmxcCnBOQ5aRkpzOJuD1K1Cw_gNm_lV6A7hZgFh_cFzXitvaH0xhN.UuKcHEc6oh_zB55o/rmXWZcPwmyrpCvYL3z6vwL0h7V3ITPbeRU_vVSqFyy7LlMVLEQ3RgZBvLIvQbdEaXYlJw5qgNbk-yncCZ7PdrMzfNDwc_HU945b51S-5K0jxmQ_hSIQ17qNLYThE1Ce3ocJrcJ4Z6niTYIVcl2HcLCRABl3hdjpym6Jrmlm2OxOdvXW2itOhiWw_v8u9WNOX4hzryP2f5pvyy2sFMDcL7yL76CfKrzIsZkB5Smdxxb3fgzoa8hk3FYboFnwwXSvs9qA8JEdE0xn8nWNrqdyMijpr0Vy6YJQFqkS6GKrWKhxu31HL2JzAhyOXhBFQT15Asqgs1UsESqlm-UFYMkRD9g","status":"completed","recording_type":"timeline"}],"password":"W3t!$00v","recording_play_passcode":"oBGMTtJl0ZIZWO5x6CN3xH0X5LDGUlY3","on_prem":false}},"event_ts":1740576801627,"event":"recording.completed","download_token":"eyJzdiI6IjAwMDAwMSIsInptX3NrbSI6InptX28ybSIsInR5cCI6IkpXVCIsImFsZyI6IkVTMjU2In0.eyJhdWQiOiJXZWJSZWNEb3dubG9hZCIsImFjY291bnRJZCI6ImJ4VHU4OGZNUlI2bEpEV1ZFSjRQOUEiLCJpc3MiOiJFdmVudENvbnN1bWVyUmVjRG93bmxvYWQiLCJtaWQiOiJEVVprZTVHdFR0dVFsY3g0bVVvMFh3PT0iLCJleHAiOjE3NDA2NjMyMTcsImlhdCI6MTc0MDU3NjgxNywidXNlcklkIjoiSGJfTDR1SWhRZUsxcENHVlhfY25ldyJ9.tnybBqk4HmCjTE8yR6F4UWyh0bhbM_ENr0dZ_lNvVKgA0VsTJmkE_X5T_5LnI0hG3cCLSRJkyKZMO6oHjPgT1g"}',
);

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
    setupSessionStore(env);
    try {
      ctx.session = await sessions.load(request);
    } catch (error) {
      // no-op
    }

    ctx.user = { id: "1", username: "test" };
    // if (ctx.session?.userId) {
    //   ctx.user = await db.user.findUnique({
    //     where: {
    //       id: ctx.session.userId,
    //     },
    //   });
    // }
  },
  layout(Document, [
    index([Home]),
    //   prefix("/user", authRoutes),
  ]),

  prefix("/webhook", [
    route("/meeting.recording.completed", [
      // validateZoomWebhook,
      async function ({ env, ctx }) {
        // create an entry in the database for this recording


        const data = {
          id: testPayload.payload.object.uuid,
          topic: testPayload.payload.object.topic,
          startTime: testPayload.payload.object.start_time,
          duration: testPayload.payload.object.duration,
          shareUrl: testPayload.payload.object.share_url,
          rawPayload: JSON.stringify(testPayload),
        }

        await db.meeting.create({
          data,
        });

        // await db.meeting.upsert({
        //   create: data,
        //   update: data,
        //   where: {
        //     id: data.id,
        //   },
        // });

        const message = {
          version: "2025-02-26",
          action: "download",
          recordings: testPayload.payload.object.recording_files,
          downloadToken: testPayload.download_token,
        };
        // await env.QUEUE.send(message);
        return new Response('', { status: 200 });
      },
    ]),
  ]),
]);

export default {
  fetch: app.fetch,
  async queue(batch, env) {
    for (const message of batch.messages) {
      if (message.body.action === "download") {
        for (const recording of message.body.recordings) {
          const filename = `recording-${recording.meeting_id}-${recording.id}.${recording.file_extension.toLowerCase()}`;
          console.log(filename);
          const f = await fetch(recording.download_url, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${message.body.downloadToken}`,
            },
          });
          await env.R2.put(filename, f.body);
          // store this information in the database
        }
        // create another queue item so that we can email the user.
      }
    }
  },
} satisfies ExportedHandler<Env>;
