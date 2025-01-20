RedwoodJS Reloaded uses Cloudflare R2 for Storage. R2 is functionally equivalant to AWS S3.


If you want to store images, consider using Cloudflare's image optimized storage service called "Cloudflare Images," which allows
you to resize and deliver images efficiently. Generally using R2 is "good enough."


## Requirements

You must have a R2 bucket
```terminal
npx wrangler [command to create a bucket]
```

You must [generate an API token](https://dash.cloudflare.com/?to=/:account/r2/api-tokens) to access R2 Storage.
Doing so will give you an access key id, secret access key as well as an account id, which will be used to instantiate your R2 Client.

## Uploading and downloading files

The simplest way to upload a file is to generate a presigned URL per upload.

Reloaded has included a simple abstraction on top of S3/ AWS4Fetch to allows you to do so.

```
  import { generateUploadUrl } from './lib/storage'
  const uploadUrl = await generateUploadUrl(bucket, expires=3600)`
```


## Questions

Do we name it URL or Url?

