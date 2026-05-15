import { RequestInfo } from "rwsdk/worker";
import { ImageResponse } from "workers-og";

export async function OgImage({ ctx, request }: RequestInfo) {
  return new ImageResponse(
    <div
      style={{
        fontSize: 40,
        background: "white",
        width: "100%",
        height: "100%",
        display: "flex",
        textAlign: "center",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      Hello WASM
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}

