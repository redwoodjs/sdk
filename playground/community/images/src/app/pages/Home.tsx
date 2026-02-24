import { Image } from "@/app/components/Image";

export const Home = () => {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem" }}>
      <h1>Image Optimization Demo</h1>

      <section>
        <h2>Hero image (priority, full width)</h2>
        <Image
          src="/_image/hero.jpg"
          alt="Hero"
          width={1200}
          height={600}
          sizes="100vw"
          priority
        />
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Card thumbnail</h2>
        <Image
          src="/_image/hero.jpg"
          alt="Card"
          width={400}
          height={300}
          sizes="(max-width: 768px) 100vw, 400px"
        />
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Fill mode (aspect ratio container)</h2>
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16/9",
          }}
        >
          <Image
            src="/_image/hero.jpg"
            alt="Banner"
            fill
            sizes="100vw"
          />
        </div>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>SVG (unoptimized, direct path)</h2>
        <Image
          src="/favicon-light.svg"
          alt="Logo"
          width={200}
          height={200}
          unoptimized
        />
      </section>
    </div>
  );
};
