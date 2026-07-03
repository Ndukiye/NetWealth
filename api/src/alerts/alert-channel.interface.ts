export const ALERT_CHANNEL = Symbol('ALERT_CHANNEL');

/**
 * Sends a spending alert to a user's phone. MockAlertChannel just logs and
 * records it so the UI can show alert history without needing real
 * WhatsApp Business / Telegram Bot credentials. Swap in a real
 * implementation of this interface (Telegram Bot API is free and the
 * simplest to wire up first) behind the same interface.
 */
export interface AlertChannel {
  readonly name: string;
  send(destination: string, message: string): Promise<void>;
}
