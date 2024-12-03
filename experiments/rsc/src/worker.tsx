import AdminPage from "./app/AdminPage";
import { App } from "./app/App";
import { db, setupDb } from "./db";
import HomePage from "./app/HomePage";
import { transformRscToHtmlStream } from "./render/transformRscToHtmlStream";
import { injectRSCPayload } from "rsc-html-stream/server";
import { renderToRscStream } from "./render/renderToRscStream";
import { rscActionHandler } from "./register/rsc";
import { setupTwilioClient } from "./twilio";
// import vCards from "vcard-creator";

// todo(peterp, 2024-11-25): Make these lazy.
const routes = {
  "/": HomePage,
  "/admin": AdminPage,
};

// This will come from the DB
const tradesmen = [
  {
    name: "Jack Parrow",
    phone: "+27724217253",
    email: "jackparrow@gmail.com",
    address: "123 Main Street, Springfield, USA",
    jobTitle: "Plumber",
  },
  {
    name: "John Doe",
    phone: "+27724378171",
    email: "john.doe@example.com",
    address: "123 Main Street, Springfield, USA",
    jobTitle: "Plumber",
  },
  {
    name: "Jane Doe",
    phone: "+27724378172",
    email: "jane.doe@example.com",
    address: "123 Main Street, Springfield, USA",
    jobTitle: "Electrician",
  },
];

// Keeping it simple, we just get the unique professions from the tradesmen, but we can also make a professions table in the DB
const tradeProfessions = [
  ...new Set(tradesmen.map((tradesman) => tradesman.jobTitle)),
];

// todo(harryhcs, 2024-12-02): Add vCards
// todo(harryhcs, 2024-12-02): Remove all this twilio stuff from the main worker file
const quickReplyMessage = `
    Welcome to *The Valley Directory!* We have the following tradesmen available:\n\n${formatQuickReply(tradeProfessions)}\n\nPlease reply with the name of the profession you would like to contact and we will send you the contact details for the tradesmen available in your area.`;

function formatQuickReply(tradeProfessions: string[]): string {
  return tradeProfessions.map((profession) => `*${profession}*`).join("\n");
}

export default {
  async fetch(request: Request, env: Env) {
    try {
      setupDb(env);
      // todo(harryhcs, 2024-12-02): Setup Twilio client
      const client = setupTwilioClient(env);
      console.log(client);

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

      if (request.method === "POST" && request.url.includes("/api/login")) {
        console.log("Login request received");
        return new Response("Login successful", { status: 200 });
      }

      // incoming twilio request
      if (request.method === "POST" && request.url.includes("/incoming")) {
        const body = await request.text();
        const bodyData = new URLSearchParams(body);
        const messageBody = bodyData.get("Body");

        const matchingTradesmen = tradesmen.filter((tradesman) =>
          messageBody?.toLowerCase().includes(tradesman.jobTitle.toLowerCase()),
        );

        if (matchingTradesmen.length > 0) {
          // we will need to twilio client message here
          return new Response(
            `Glad we can help! Here are the contact details for ${matchingTradesmen.length} ${matchingTradesmen.length === 1 ? "tradesman" : "tradesmen"} you requested:`,
            { status: 200 },
          );

          // send vCards
        }

        return new Response(quickReplyMessage, { status: 200 });
      }

      if (
        request.method === "POST" &&
        request.url.includes("/api/create-user")
      ) {
        const formData = await request.formData();
        const name = formData.get("name");
        const cell = formData.get("cell") as string;

        const user = await db
          .insertInto("User")
          .values({
            name: name as string,
            cellnumber: cell,
          })
          .execute();

        if (!user) {
          return new Response("User creation failed", { status: 500 });
        }

        const referer = request.headers.get("Referer") || "/admin";
        return Response.redirect(referer, 303);
      }

      const pathname = new URL(request.url).pathname as keyof typeof routes;
      const Page = routes[pathname];
      if (!Page) {
        // todo(peterp, 2024-11-25): Return not found page, if exists
        return new Response("Not found", { status: 404 });
      }

      const rscPayloadStream = renderToRscStream(
        <App>
          <Page />
        </App>,
      );

      if (isRSCRequest) {
        return new Response(rscPayloadStream, {
          headers: { "content-type": "text/x-component; charset=utf-8" },
        });
      }

      const [rscPayloadStream1, rscPayloadStream2] = rscPayloadStream.tee();
      const htmlStream = await transformRscToHtmlStream(rscPayloadStream1);
      const html = htmlStream.pipeThrough(injectRSCPayload(rscPayloadStream2));
      return new Response(html, {
        headers: { "content-type": "text/html" },
      });
    } catch (e) {
      console.error("Unhandled error", e);
      throw e;
    }
  },
};
