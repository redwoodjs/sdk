import { index, route } from "@redwoodjs/sdk/router";
import { MeetingList } from "./MeetingList";
import { MeetingDetail } from "./MeetingDetail";

export const meetingRoutes = [
    route('/', MeetingList),
    route('/:meetingId', MeetingDetail)
]