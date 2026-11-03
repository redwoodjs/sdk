export function Home() {
  return (
    <>
      <a href="#home-main">Skip to Home content</a>
      <main id="home-main">
        <h1>Home</h1>
        <a href="/widget" id="link-to-widget">
          Go to Widget
        </a>
        <a href="/non-div-widget" id="link-to-non-div-widget">
          Go to non-div Widget
        </a>
      </main>
    </>
  );
}
