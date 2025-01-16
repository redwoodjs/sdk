export let AI: ReturnType<typeof createAI>;

export const createAI = (env: Env) => {
  const ai = {
    transcribeAudio: async (blob: Blob) => {
      try {
        console.log("Trying to transcribe audio");
        console.log(blob);
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const response = await env.AI.run("@cf/openai/whisper", {
          audio: [...uint8Array],
        });
        console.log(response);
        return response.text;
      } catch (error) {
        console.error("Error transcribing audio", error);
        return "Failed to transcribe audio";
      }
    },
  };
  AI = ai;
  return ai;
};


export const setupAI = (env: Env) => {
  AI = createAI(env);
}; 