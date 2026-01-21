import twilio from 'twilio';
import { DatabaseService } from './DatabaseService';
import { logger } from '../utils/logger';

export class AlertService {
  private twilioClient: any = null;

  constructor() {
    // Initialize Twilio client if credentials are available
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
  }

  /**
   * Send an alert call to a supervisor phone number
   */
  async sendAlertCall(phoneNumber: string, message: string, metadata: any = {}) {
    if (!this.twilioClient) {
      throw new Error('Twilio not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.');
    }

    if (!phoneNumber) {
      throw new Error('Phone number is required for alert calls');
    }

    try {
      // Create a TwiML response that will speak the alert message
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" rate="medium" language="en-US">
    Alert from Servio Restaurant System. ${message}. Please check your restaurant dashboard immediately. This message will repeat once.
  </Say>
  <Pause length="2"/>
  <Say voice="alice" rate="slow" language="en-US">
    ${message}
  </Say>
</Response>`;

      // Create the alert call
      const call = await this.twilioClient.calls.create({
        twiml: twiml,
        to: phoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
        timeout: 30 // Ring for 30 seconds max
      });

      // Log the alert call
      const db = DatabaseService.getInstance().getDatabase();
      await db.run(`
        INSERT INTO alert_calls (
          id, restaurant_id, phone_number, message, call_sid, status, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        metadata.restaurantId || null,
        phoneNumber,
        message,
        call.sid,
        'initiated',
        JSON.stringify(metadata)
      ]);

      logger.info(`Alert call sent to ${phoneNumber}`, { 
        callSid: call.sid, 
        metadata,
        message: message.substring(0, 100) 
      });

      return {
        success: true,
        callSid: call.sid,
        status: call.status
      };
    } catch (error) {
      logger.error('Failed to send alert call', { error, phoneNumber, metadata });
      throw error;
    }
  }

  /**
   * Send alert call for order failures
   */
  async sendOrderFailureAlert(restaurantId: string, orderId: string, failureReason: string) {
    try {
      const db = DatabaseService.getInstance().getDatabase();
      
      // Get restaurant alert settings
      const restaurant = await db.get(
        'SELECT name, settings FROM restaurants WHERE id = ?',
        [restaurantId]
      );

      if (!restaurant) {
        logger.warn('Restaurant not found for alert call', { restaurantId });
        return;
      }

      const settings = JSON.parse(restaurant.settings || '{}');
      const alertSettings = settings.alerts;

      if (!alertSettings?.enabled || !alertSettings?.enabledForOrderFailures || !alertSettings?.supervisorPhone) {
        logger.info('Alert calls not enabled or configured for order failures', { restaurantId });
        return;
      }

      const message = `Order failure detected at ${restaurant.name}. Order ${orderId} could not be processed. Reason: ${failureReason}. Please check your system immediately.`;

      await this.sendAlertCall(
        alertSettings.supervisorPhone,
        message,
        {
          type: 'order_failure',
          restaurantId,
          orderId,
          failureReason
        }
      );

      logger.info('Order failure alert call sent', { restaurantId, orderId });
    } catch (error) {
      logger.error('Failed to send order failure alert', { error, restaurantId, orderId });
    }
  }

  /**
   * Send alert call for system down
   */
  async sendSystemDownAlert(restaurantId: string, downtime: string) {
    try {
      const db = DatabaseService.getInstance().getDatabase();
      
      // Get restaurant alert settings
      const restaurant = await db.get(
        'SELECT name, settings FROM restaurants WHERE id = ?',
        [restaurantId]
      );

      if (!restaurant) {
        logger.warn('Restaurant not found for system down alert', { restaurantId });
        return;
      }

      const settings = JSON.parse(restaurant.settings || '{}');
      const alertSettings = settings.alerts;

      if (!alertSettings?.enabled || !alertSettings?.enabledForSystemDown || !alertSettings?.supervisorPhone) {
        logger.info('Alert calls not enabled or configured for system down', { restaurantId });
        return;
      }

      const message = `System alert for ${restaurant.name}. Your restaurant system has been down for ${downtime}. Orders may not be processing normally. Please check immediately.`;

      await this.sendAlertCall(
        alertSettings.supervisorPhone,
        message,
        {
          type: 'system_down',
          restaurantId,
          downtime
        }
      );

      logger.info('System down alert call sent', { restaurantId, downtime });
    } catch (error) {
      logger.error('Failed to send system down alert', { error, restaurantId });
    }
  }
}