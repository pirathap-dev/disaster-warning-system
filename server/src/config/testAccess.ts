export const isTestAccessEnabled = () =>
  process.env.ENABLE_TEST_ACCESS === 'true' &&
  (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'demo');
