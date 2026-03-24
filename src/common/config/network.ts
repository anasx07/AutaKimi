export const NetworkConfig = {
  DEFAULT_UA: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  DEFAULT_TIMEOUT: 30000,
  DEFAULT_RETRY_ATTEMPTS: 3,
  DEFAULT_RETRY_DELAY: 1000,
} as const;

export const getEffectiveUA = (customUa?: string) => customUa || NetworkConfig.DEFAULT_UA;
