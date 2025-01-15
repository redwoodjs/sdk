export let AI: ReturnType<typeof createAI>;

export const createAI = (env: Env) => {
  const ai = {
    transcribeAudio: async (blob: Blob) => {
      try {
        const response = await env.AI.run("@cf/openai/whisper", {
          audio: [...new Uint8Array(await blob.arrayBuffer())],
        });
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