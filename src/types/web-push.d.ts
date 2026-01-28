declare module 'web-push' {
  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void;

  export function sendNotification(
    subscription: PushSubscription,
    payload: string | Buffer,
    options?: {
      headers?: Record<string, string>;
      contentEncoding?: string;
      gcmAPIKey?: string;
    }
  ): Promise<void>;

  export function generateRequestDetails(
    subscription: PushSubscription,
    payload?: string | Buffer,
    options?: {
      headers?: Record<string, string>;
      contentEncoding?: string;
    }
  ): {
    method: string;
    headers: Record<string, string>;
    endpoint: string;
    body?: string | Buffer;
  };

  export interface PushSubscription {
    endpoint: string;
    keys?: {
      p256dh: string;
      auth: string;
    };
  }
}
