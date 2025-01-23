import { z } from 'zod'


let ENV

// define zod schema for env-vars
export const envSchema = z.object({
  RESEND_API_KEY: z.string(),
});

export type ParsedEnv = z.infer<typeof envSchema>;

export function setupEnv(env: Env) {
  console.log(env)
  const parsedEnv = envSchema.safeParse(env);
    if (!parsedEnv.success) {
      throw new Error(`Invalid environment variables: ${parsedEnv.error.message}`);
    }
    ENV = parsedEnv.data;
}

export function getEnv(): ParsedEnv {
  return ENV
}


