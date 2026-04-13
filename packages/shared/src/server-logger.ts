import pino from "pino";

const loggerSingleton = Symbol.for("global-pulse.pino.logger");

type LoggerStore = {
  [loggerSingleton]?: pino.Logger;
};

function createRootLogger(): pino.Logger {
  const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

  return pino({
    level,
    base: {
      app: "global-pulse",
      env: process.env.NODE_ENV ?? "development",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export function getRootLogger(): pino.Logger {
  const store = globalThis as LoggerStore;
  if (!store[loggerSingleton]) {
    store[loggerSingleton] = createRootLogger();
  }
  return store[loggerSingleton]!;
}

export function getLogger(scope: string): pino.Logger {
  return getRootLogger().child({ scope });
}
