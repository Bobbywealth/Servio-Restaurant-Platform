import axios, { AxiosInstance } from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

export interface ClientOptions {
  timeout?: number;
  maxSockets?: number;
  maxFreeSockets?: number;
}

export class HttpClientService {
  private clients = new Map<string, AxiosInstance>();

  getClient(baseURL: string, options: ClientOptions = {}): AxiosInstance {
    const cacheKey = `${baseURL}:${JSON.stringify(options)}`;
    const existing = this.clients.get(cacheKey);
    if (existing) return existing;

    const maxSockets = options.maxSockets ?? 50;
    const maxFreeSockets = options.maxFreeSockets ?? 10;

    const client = axios.create({
      baseURL,
      timeout: options.timeout ?? 10000,
      httpAgent: new HttpAgent({
        keepAlive: true,
        keepAliveMsecs: 30000,
        maxSockets,
        maxFreeSockets,
        timeout: 60000,
        scheduling: 'fifo'
      }),
      httpsAgent: new HttpsAgent({
        keepAlive: true,
        keepAliveMsecs: 30000,
        maxSockets,
        maxFreeSockets,
        timeout: 60000,
        scheduling: 'fifo'
      })
    });

    this.clients.set(cacheKey, client);
    return client;
  }
}

