import { WriteStream } from "fs";

export interface SmokeTestResult {
  status: string;
  verificationPassed: boolean;
  timestamp?: number;
  rawResult?: unknown;
  error?: string;
  serverTimestamp?: number;
  clientTimestamp?: number;
}

export interface SmokeTestOptions {
  customPath?: string;
  skipDev?: boolean;
  skipRelease?: boolean;
  skipClient?: boolean;
  projectDir?: string;
  artifactDir?: string;
  keep?: boolean;
  headless?: boolean;
  sync?: boolean;
  ci?: boolean;
  bail?: boolean;
  copyProject?: boolean;
  realtime?: boolean;
  skipHmr?: boolean;
}

export interface TestResources {
  tempDirCleanup?: () => Promise<void>;
  workerName?: string;
  originalCwd: string;
  targetDir?: string;
  workerCreatedDuringTest: boolean;
  stopDev?: () => Promise<void>;
  resourceUniqueKey: string;
}

export interface StreamCapturer {
  stdoutLogFile: WriteStream | null;
  stderrLogFile: WriteStream | null;
  combinedLogFile: WriteStream | null;
  originalStdoutWrite: (
    chunk: Uint8Array | string,
    encoding?: BufferEncoding,
    callback?: (error?: Error | null) => void,
  ) => boolean;
  originalStderrWrite: (
    chunk: Uint8Array | string,
    encoding?: BufferEncoding,
    callback?: (error?: Error | null) => void,
  ) => boolean;
  start: (artifactDir: string) => void;
  stop: () => void;
}

export interface TestStatus {
  dev: {
    overall: string;
    initialServerSide: string;
    initialClientSide: string;
    initialServerRenderCheck: string;
    realtimeUpgrade: string;
    realtimeServerSide: string;
    realtimeClientSide: string;
    realtimeServerRenderCheck: string;
    initialServerHmr: string;
    initialClientHmr: string;
    realtimeServerHmr: string;
    realtimeClientHmr: string;
  };
  production: {
    overall: string;
    releaseCommand: string;
    initialServerSide: string;
    initialClientSide: string;
    initialServerRenderCheck: string;
    realtimeUpgrade: string;
    realtimeServerSide: string;
    realtimeClientSide: string;
    realtimeServerRenderCheck: string;
    initialServerHmr: string;
    initialClientHmr: string;
    realtimeServerHmr: string;
    realtimeClientHmr: string;
  };
}
