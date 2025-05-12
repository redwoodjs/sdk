await runDevTest(
  url,
  options.artifactDir,
  options.customPath,
  browserPath,
  options.headless !== false,
  options.bail,
  options.skipClient,
  options.realtime,
);
