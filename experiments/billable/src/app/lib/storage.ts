import { AwsClient } from "aws4fetch";

// import { env } from './env'


const r2 = new AwsClient({
  // Use the wrangler binding.
  accessKeyId: "",
  secretAccessKey: ""
});

// check the uploadify example, copy that.
export async function generateUploadUrl(path: string, expires = 3600) {

  // How do we make this work locally?

  console.log('R2_ACCESS_KEY_ID', process.env)

  const ACCOUNT_ID = ""
  const R2_URL = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

  const signed = await r2.sign(
    new Request(`${R2_URL}/${path}?X-Amz-Expires=${expires}`, {
      method: "PUT",
    }),
    {
      aws: { signQuery: true },
    },
  )

  return signed.url
}
