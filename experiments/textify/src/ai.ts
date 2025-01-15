export let AI: ReturnType<typeof createAI>;

export const createAI = (env: Env) => {
  const ai = {
    transcribeAudio: async (file: Blob) => {
      const response = await env.AI.run("@cf/openai/whisper", {
        audio: [...new Uint8Array(await file.arrayBuffer())],
      });
          console.log(response);
          return response.text;
    },
  };
  AI = ai;
  return ai;
};


export const setupAI = (env: Env) => {
  AI = createAI(env);
}; 