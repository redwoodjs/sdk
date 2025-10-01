export const SETUP_PLAYGROUND_ENV_TIMEOUT = process.env
  .RWSDK_SETUP_PLAYGROUND_ENV_TIMEOUT
  ? parseInt(process.env.RWSDK_SETUP_PLAYGROUND_ENV_TIMEOUT, 10)
  : 15 * 60 * 1000;

export const DEPLOYMENT_TIMEOUT = process.env.RWSDK_DEPLOYMENT_TIMEOUT
  ? parseInt(process.env.RWSDK_DEPLOYMENT_TIMEOUT, 10)
  : 5 * 60 * 1000;

export const DEPLOYMENT_MIN_TRIES = process.env.RWSDK_DEPLOYMENT_MIN_TRIES
  ? parseInt(process.env.RWSDK_DEPLOYMENT_MIN_TRIES, 10)
  : 5;

export const DEPLOYMENT_CHECK_TIMEOUT = process.env
  .RWSDK_DEPLOYMENT_CHECK_TIMEOUT
  ? parseInt(process.env.RWSDK_DEPLOYMENT_CHECK_TIMEOUT, 10)
  : 5 * 60 * 1000;

export const PUPPETEER_TIMEOUT = process.env.RWSDK_PUPPETEER_TIMEOUT
  ? parseInt(process.env.RWSDK_PUPPETEER_TIMEOUT, 10)
  : 60 * 1000 * 2;

export const HYDRATION_TIMEOUT = process.env.RWSDK_HYDRATION_TIMEOUT
  ? parseInt(process.env.RWSDK_HYDRATION_TIMEOUT, 10)
  : 5000;

export const DEV_SERVER_TIMEOUT = process.env.RWSDK_DEV_SERVER_TIMEOUT
  ? parseInt(process.env.RWSDK_DEV_SERVER_TIMEOUT, 10)
  : 5 * 60 * 1000;

export const DEV_SERVER_MIN_TRIES = process.env.RWSDK_DEV_SERVER_MIN_TRIES
  ? parseInt(process.env.RWSDK_DEV_SERVER_MIN_TRIES, 10)
  : 5;

export const SETUP_WAIT_TIMEOUT = process.env.RWSDK_SETUP_WAIT_TIMEOUT
  ? parseInt(process.env.RWSDK_SETUP_WAIT_TIMEOUT, 10)
  : 10 * 60 * 1000;

export const TEST_MAX_RETRIES = process.env.RWSDK_TEST_MAX_RETRIES
  ? parseInt(process.env.RWSDK_TEST_MAX_RETRIES, 10)
  : 10;

export const TEST_MAX_RETRIES_PER_CODE = process.env
  .RWSDK_TEST_MAX_RETRIES_PER_CODE
  ? parseInt(process.env.RWSDK_TEST_MAX_RETRIES_PER_CODE, 10)
  : 6;

export const INSTALL_DEPENDENCIES_RETRIES = process.env
  .RWSDK_INSTALL_DEPENDENCIES_RETRIES
  ? parseInt(process.env.RWSDK_INSTALL_DEPENDENCIES_RETRIES, 10)
  : 10;
