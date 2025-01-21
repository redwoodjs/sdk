RedwoodJS Reloaded uses Cloudflare R2 for Storage. R2 is functionally equivalant to AWS S3.

If you want to store images, consider using Cloudflare's image optimized storage service called "Cloudflare Images," which allows
you to resize and deliver images efficiently. Generally using R2 is "good enough."


Apparently I'm very wrong about requiring any sort of setup. Wrangler does bindings, which give you all the good stuff. I have no idea how this works locally? Does it even? IDK.


## Requirements

You must have a R2 bucket
```terminal
npx wrangler [command to create a bucket]
```

## Uploading and downloading files

The simplest way to upload a file is to generate a presigned URL per upload.

Reloaded has included a simple abstraction on top of S3/ AWS4Fetch to allows you to do so.

```
  import { generateUploadUrl } from './lib/storage'
  const uploadUrl = await generateUploadUrl(bucket, expires=3600)`
```


## Questions

Do we name it URL or Url?

How does development work?

There's a binding on "env."


