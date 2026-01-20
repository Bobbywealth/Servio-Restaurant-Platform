import twilio from 'twilio';
import { logger } from '../utils/logger';

export class SmsService {
  private static instance: SmsService;
  private client: twilio.Twilio | null = null;
  private fromNumber: string | null = null;

  private constructor() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || null;

    if (sid && token) {
      this.client = twilio(sid, token);
      logger.info('Twilio SMS service initialized');
    } else {
      logger.warn('Twilio SMS service not initialized - missing credentials');
    }
  }

  public static getInstance(): SmsService {
    if (!SmsService.instance) {
      SmsService.instance = new SmsService();
    }
    return SmsService.instance;
  }

  public async sendSms(to: string, message: string) {
    if (!this.client || !this.fromNumber) {
      logger.warn(`SMS simulation to ${to}: ${message}`);
      return { success: true, simulated: true };
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to
      });
      logger.info(`SMS sent to ${to}, SID: ${result.sid}`);
      return { success: true, sid: result.sid };
    } catch (error) {
      logger.error(`Failed to send SMS to ${to}:`, error);
      return { success: false, error };
    }
  }
}
