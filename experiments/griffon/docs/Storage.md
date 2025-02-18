RedwoodJS Redwood SDK uses Cloudflare R2 for Storage. R2 is functionally equivalant to AWS S3.

If you want to store images, consider using Cloudflare's image optimized storage service called "Cloudflare Images," which allows
you to resize and deliver images more efficiently. Generally using R2 is "good enough."


## Requirements

You must have a R2 bucket
```terminal
npx wrangler [command to create a bucket]
```

## Uploading and downloading files

Focus on web standards. That means uploading via a multipart form.
Streaming the uploaded file into R2.
