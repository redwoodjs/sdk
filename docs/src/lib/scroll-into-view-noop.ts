// rwsdk re-renders the full RSC tree on every client-side navigation,
// which causes fumadocs sidebar items to remount and trigger
// scroll-into-view-if-needed. We replace it with a no-op to prevent
// unwanted sidebar scrolling on page transitions.
export default function scrollIntoView() {}
