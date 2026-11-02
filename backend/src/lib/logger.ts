const ts = () => new Date().toISOString();

export const logger = {
  info: (scope: string, msg: string, extra?: unknown) =>
    console.log(`${ts()} INFO  [${scope}] ${msg}`, extra ?? ''),
  warn: (scope: string, msg: string, extra?: unknown) =>
    console.warn(`${ts()} WARN  [${scope}] ${msg}`, extra ?? ''),
  error: (scope: string, msg: string, extra?: unknown) =>
    console.error(`${ts()} ERROR [${scope}] ${msg}`, extra ?? ''),
};
