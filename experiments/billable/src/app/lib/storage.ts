import { AwsClient } from "aws4fetch";

import { env } from './env'



// todo, where do I store these safely?

const client = new AwsClient({
  service: "s3",
  region: "auto",
  accessKeyId: env.ACCESS_KEY_ID,
  secretAccessKey: env.SECRET_ACCESS_KEY
});

export async function generateUploadUrl(path: string, expires = 3600) {

  const R2_URL = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com`;

  await client.sign(
    new Request(`${R2_URL}/${path}?X-Amz-Expires=${expires}`, {
      method: "PUT",
    }),
    {
      aws: { signQuery: true },
    },
  )

}
