import { route } from "@redwoodjs/sdk/router";
import { MeetingList } from "./MeetingList";
import { MeetingDetail } from "./MeetingDetail";
import { db } from "@/db";

export const meetingRoutes = [
  route("/", MeetingList),
  route("/:meetingId", MeetingDetail),
  route("/:meetingid/:recordingId", async function ({ env, params }) {
    const recording = await db.recording.findUniqueOrThrow({
      where: {
        id: params.recordingId,
        meetingId: params.meetingId,
      },
    });

    const filename = `recording-${recording.meetingId}-${recording.id}.${recording.extension.toLowerCase()}`;
    const object = await env.R2.get(filename);
    if (!object) {
      return new Response("File not found", { status: 404 });
    }
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType as string,
      },
    });
  }),
];
