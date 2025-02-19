export async function handleAssets(request: Request, env: { ASSETS: Fetcher }) {
  const url = new URL(request.url);

  // Skip API and page routes
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/pages/')) {
    return null;
  }

  // Serve static assets
  try {
    return await env.ASSETS.fetch(request);
  } catch {
    return null;
  }
}
