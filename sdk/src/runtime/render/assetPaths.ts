/**
 * Ensures asset hrefs from the Vite manifest are absolute paths.
 *
 * Vite's manifest stores file paths without a leading slash (e.g. "assets/foo.js").
 * When used as href attributes, these resolve relative to the current page URL,
 * breaking on nested routes (e.g. /dashboard/editor resolves "assets/foo.js"
 * as "/dashboard/assets/foo.js" instead of "/assets/foo.js").
 *
 * Prepends import.meta.env.BASE_URL (defaults to "/") to make paths absolute.
 */
export const toAbsoluteHref = (href: string) =>
  href.startsWith("/") ? href : import.meta.env.BASE_URL + href;
