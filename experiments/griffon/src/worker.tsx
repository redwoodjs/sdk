import { App } from "./app/App";
import { db, setupDb } from "./db";

import { transformRscToHtmlStream } from "./render/transformRscToHtmlStream";
import { injectRSCPayload } from "rsc-html-stream/server";
import { renderToRscStream } from "./render/renderToRscStream";

import { ssrWebpackRequire } from "./imports/worker";
import { rscActionHandler } from "./register/worker";
import { ErrorResponse } from "./error";
import { getSession } from "./auth";
import { setupEnv } from "./env";
import HomePage from "./app/pages/Home/HomePage";

import { defineRoutes, index, prefix } from "./lib/router";
import { authRoutes } from "./app/pages/auth/routes";
import { link } from "src/shared/links";
import { sensorRoutes } from "src/pages/sensor/routes";

export { SessionDO } from "./session";

export const getContext = async (
  session: Awaited<ReturnType<typeof getSession>> | undefined,
) => {
  const user = await db.user.findFirstOrThrow({
    select: {
      id: true,
      email: true,
    },
    where: { id: session?.userId },
  });
  return {
    user,
  };
};

function authRequired({ ctx }: any) {
  if (!ctx.user) {
    return new Response("Unauthorized", { status: 401 });
  }
}

export default {
  async fetch(request: Request, env: Env) {
    globalThis.__webpack_require__ = ssrWebpackRequire;

    const router = defineRoutes([
      index([
        function ({ ctx }) {
          if (ctx.user) {
            return new Response(null, {
              status: 302,
              headers: { Location: link('/sensor/list') },
            });
          }
        },
        HomePage,
      ]),
      ...prefix("/user", authRoutes),
      ...prefix("/sensor", sensorRoutes),
    ]);

    try {
      setupDb(env);
      setupEnv(env);
      // todo(justinvdm, 30 Jan 2025): Figure out how to avoid this.
      //
      // ## Context:
      // Vite sends an initial request to the worker when running the dev server,
      // at which point the Prisma WASM is imported. Using the Prisma for the first time _after_ this initial request
      // (e.g. if we only run the db for a request to /some/subpath) causes vite to not try import the WASM module
      // at all, and ultimately the request ends up hanging indefinetely.
      // * However, once the WASM has been imported, it is cached in some way that persists on the file system
      // (from experimentation, it is not in node_modules/.vite). This means that if you were to subsequently
      // change the code to _not_ have Prisma used after the initial request, the WASM will still be cached and
      // the request will not hang. This makes this issue particularly hard to debug.
      await db.$queryRaw`SELECT 1`;

      let ctx: Awaited<ReturnType<typeof getContext>> = {};
      let session: Awaited<ReturnType<typeof getSession>> | undefined;
      try {
        session = await getSession(request, env);
        ctx = await getContext(session);
      } catch (e) {
        console.error("Error getting session", e);
      }

      const url = new URL(request.url);
      const isRSCRequest = url.searchParams.has("__rsc");
      const isRSCActionHandler = url.searchParams.has("__rsc_action_id");
      let actionResult: any;
      if (isRSCActionHandler) {
        actionResult = await rscActionHandler(request, ctx); // maybe we should include params and ctx in the action handler?
      }

      const renderPage = async (Page: any, props = {}) => {
        const rscPayloadStream = renderToRscStream({
          node: <Page {...props} />,
          actionResult: actionResult,
        });
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

      // sample iot data from temp and humd sensor:
      // {
      //   "sensorUid": "123",
      //   "temperature": 20,
      //   "humidity": 50
      // }

      // match /api/sensor/<userId>/data - user id is a uuid
      const match = url.pathname.match(/^\/api\/sensor\/([0-9a-f-]{36})\/data$/);
      if (request.method === "POST" && match) {
        const userId = match[1];
        const data = await request.json();
        
        // Common field names that might contain a sensor identifier
        const possibleUidFields = ['sensorUid', 'sensor_id', 'id', 'deviceId', 'device_id', 'uid', 'identifier'];
        
        // Find the first field that exists in the data object
        const sensorUid = possibleUidFields
          .map(field => (data as any)[field])
          .find(value => value !== undefined);
          
        if (!sensorUid) {
          console.error('Could not find sensor identifier in data:', data);
          return new Response("Missing sensor identifier in data, try adding a field like 'sensorUid' or 'sensor_id' or 'id' or 'deviceId' or 'device_id' or 'uid' or 'identifier'", { status: 400 });
        }

        const sensor = await db.sensor.findFirst({
          where: {
            uniqueId: sensorUid,
            userId: userId,
          },
        });
        if (!sensor) {
          return new Response("Sensor not found", { status: 404 });
        }   
        return new Response(JSON.stringify(sensor), { status: 200 });
        // save the data to the sensor
        // await db.sensorDataLog.create({
        //   data: {
        //     sensorId: sensor.id,
        //     data: JSON.stringify(data),
        //   },
        // });
      }

      const response = await router.handle({
        request,
        ctx,
        env,
        renderPage,
      });
      return response;
    } catch (e) {
      if (e instanceof ErrorResponse) {
        return new Response(e.message, { status: e.code });
      }

      console.error("Unhandled error", e);
      throw e;
    }
  },
};
