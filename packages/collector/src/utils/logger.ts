import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("collector");

export class Logger {
  static info(message: string): void {
    logger.info(message);
  }

  static warn(message: string): void {
    logger.warn(message);
  }

  static error(message: string): void {
    logger.error(message);
  }
}

