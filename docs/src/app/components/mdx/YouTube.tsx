const YOUTUBE_ID_RE = /^[\w-]{1,15}$/;

export function YouTube({ id }: { id: string }) {
  if (!YOUTUBE_ID_RE.test(id)) {
    console.error(`YouTube: invalid video id "${id}"`);
    return null;
  }

  return (
    <div className="relative my-4 aspect-video w-full overflow-hidden rounded-lg">
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
