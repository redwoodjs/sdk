import { forwardRef } from "react";

interface ImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  quality?: number;
  priority?: boolean;
  unoptimized?: boolean;
}

// Append ?w= and ?q= params to the image path for the transform route.
// Uses a dummy base so this works in both server and client components.
function buildUrl(src: string, width: number, quality: number): string {
  const url = new URL(src, "http://n");
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality));
  return url.pathname + url.search;
}

// Common device widths covering phones through 4K displays.
const DEVICE_WIDTHS = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];

function buildSrcSet(
  src: string,
  baseWidth: number,
  quality: number,
): string {
  // Cap at 2× the base width — screens beyond 2× DPR show no visible
  // improvement, and larger variants waste bandwidth.
  const widths = DEVICE_WIDTHS.filter((w) => w <= baseWidth * 2);

  // Always include the exact base width so there's a 1:1 match.
  if (!widths.includes(baseWidth)) {
    widths.push(baseWidth);
    widths.sort((a, b) => a - b);
  }

  return widths
    .map((w) => `${buildUrl(src, w, quality)} ${w}w`)
    .join(", ");
}

export const Image = forwardRef<HTMLImageElement, ImageProps>(
  function Image(
    {
      src,
      alt,
      width,
      height,
      fill = false,
      sizes,
      quality = 85,
      priority = false,
      unoptimized = false,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const effectiveWidth = width ?? 800;

    const imageSrc = unoptimized
      ? src
      : buildUrl(src, effectiveWidth, quality);

    const srcSet = unoptimized
      ? undefined
      : buildSrcSet(src, effectiveWidth, quality);

    return (
      <img
        ref={ref}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        className={className}
        style={{
          ...(fill
            ? {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }
            : {}),
          ...style,
        }}
        // Keep sizes → srcSet → src in this order so Safari reads
        // srcSet before it starts fetching src (avoids extra requests).
        sizes={sizes}
        srcSet={srcSet}
        src={imageSrc}
        {...props}
      />
    );
  },
);
