import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().transform(Number),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(1),

  ACCESS_KEY_ID: z.string().min(1),
  SECRET_ACCESS_KEY: z.string().min(1),
  ACCOUNT_ID: z.string().min(1)
});


type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);


