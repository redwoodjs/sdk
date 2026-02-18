"use client";
// This file is NOT imported at runtime. It exists solely so RedwoodSDK's
// directive scan discovers fumadocs-ui's client modules via the glob pre-scan.
// Without this, you get: TypeError: Cannot read properties of undefined (reading 'TreeContextProvider')
import "fumadocs-ui/layouts/docs";
import "fumadocs-ui/layouts/docs/page";
import "fumadocs-ui/mdx";
import "fumadocs-ui/components/callout";
import "fumadocs-ui/components/card";
import "fumadocs-ui/components/tabs";
import "fumadocs-ui/components/files";
