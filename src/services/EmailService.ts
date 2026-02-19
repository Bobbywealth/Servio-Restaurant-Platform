import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { logger } from '../utils/logger';

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
};

export interface EmailConfigStatus {
  configured: boolean;
  host: string | null;
  port: number;
  secure: boolean;
  requireTls: boolean;
  hasUser: boolean;
  hasPass: boolean;
  from: string | null;
}

export class EmailService {
  private static instance: EmailService;
  private transporter: Transporter | null = null;

  private constructor() {}

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  public getConfigStatus(): EmailConfigStatus {
    const host = process.env.EMAIL_HOST || null;
    const port = Number(process.env.EMAIL_PORT || '587');
    const secure = parseBoolean(process.env.EMAIL_SECURE, port === 465);
    const requireTls = parseBoolean(process.env.EMAIL_REQUIRE_TLS, true);
    const hasUser = Boolean(process.env.EMAIL_USER);
    const hasPass = Boolean(process.env.EMAIL_PASS);
    const from = process.env.EMAIL_FROM || null;

    return {
      configured: Boolean(host && hasUser && hasPass && from),
      host,
      port,
      secure,
      requireTls,
      hasUser,
      hasPass,
      from
    };
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    const status = this.getConfigStatus();

    this.transporter = nodemailer.createTransport({
      host: status.host || 'smtp.office365.com',
      port: status.port,
      secure: status.secure,
      requireTLS: status.requireTls,
      auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || ''
      }
    });

    return this.transporter;
  }

  public async sendMail(options: SendMailOptions) {
    const status = this.getConfigStatus();
    if (!status.configured) {
      const message = 'Email service is not fully configured';
      logger.warn(message, {
        host: status.host,
        hasUser: status.hasUser,
        hasPass: status.hasPass,
        fromConfigured: Boolean(status.from)
      });
      throw new Error(message);
    }

    const transporter = this.getTransporter();
    const from = options.from || process.env.EMAIL_FROM || 'noreply@servio.com';

    return transporter.sendMail({
      ...options,
      from
    });
  }
}
