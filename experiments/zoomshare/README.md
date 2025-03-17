# Zoomshare

This application receives a webhook from Zoom after a meeting's recording becomes available. The webhook allows this application to upload the video file into R2, transcribe it, and email the participants in the meeting a link to the video.

A Zoom Pro subscription is required, by default you only get 5 GB of Cloud Storage.

## TODO

- [ ] Share with meeting particpants.
This is done via the reports api: https://developers.zoom.us/docs/api/meetings/#tag/reports/GET/report/meetings/{meetingId}/participants

- [ ] Add tailwind
- [ ] Add ShadCN
- [ ] 


pnpm add tailwindcss-animate class-variance-authority clsx tailwind-merge lucide-react
