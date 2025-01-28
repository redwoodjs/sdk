import { z } from 'zod'


let ENV: ParsedEnv | undefined

// define zod schema for env-vars
export const envSchema = z.object({
  
});

export type ParsedEnv = z.infer<typeof envSchema>;

export function setupEnv(env: Env) {
  const parsedEnv = envSchema.safeParse(env);
    if (!parsedEnv.success) {
      throw new Error(`Invalid environment variables: ${parsedEnv.error.message}`);
    }
    ENV = parsedEnv.data;
}

export function getEnv(): ParsedEnv {
  if (!ENV) {
    throw new Error("ENV is undefined.")
  }
  return ENV
}


