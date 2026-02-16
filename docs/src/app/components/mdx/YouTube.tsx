/**
 * Stub for astro-embed's <YouTube> component.
 * Renders a link to the video.
 */
export function YouTube({ id }: { id: string }) {
  return (
    <div className="youtube-embed">
      <a
        href={`https://www.youtube.com/watch?v=${id}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Watch on YouTube
      </a>
    </div>
  );
}
