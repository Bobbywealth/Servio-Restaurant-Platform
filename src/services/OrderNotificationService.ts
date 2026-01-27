import { DatabaseService } from './DatabaseService';
import { SmsService } from './SmsService';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface OrderNotificationSettings {
  smsEnabled: boolean;
  emailEnabled: boolean;
  smsTemplate: string;
  emailTemplate: string;
  emailSubject: string;
}

export class OrderNotificationService {
  private static instance: OrderNotificationService;
  private smsService: SmsService;
  private emailTransporter: any;

  private constructor() {
    this.smsService = SmsService.getInstance();
    // Dynamically require nodemailer to avoid type issues
    const nodemailer = require('nodemailer');
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || ''
      }
    });
  }

  public static getInstance(): OrderNotificationService {
    if (!OrderNotificationService.instance) {
      OrderNotificationService.instance = new OrderNotificationService();
    }
    return OrderNotificationService.instance;
  }

  /**
   * Send order confirmation to customer
   */
  public async sendOrderConfirmation(orderId: string, restaurantId: string) {
    try {
      const db = DatabaseService.getInstance().getDatabase();

      // Get order details
      const order = await db.get(`
        SELECT * FROM orders WHERE id = ?
      `, [orderId]);

      if (!order) {
        logger.warn(`Order not found for notification: ${orderId}`);
        return;
      }

      // Get or create customer record
      let customer = null;
      if (order.customer_phone || order.customer_email) {
        customer = await this.getOrCreateCustomer(
          restaurantId,
          order.customer_name,
          order.customer_email,
          order.customer_phone,
          order.total_amount
        );
      }

      // Get notification settings (or use defaults)
      const settings = await this.getNotificationSettings(restaurantId);

      // Send SMS if enabled and customer has phone and opted in
      if (settings.smsEnabled && customer && customer.phone && customer.opt_in_sms) {
        await this.sendOrderSms(customer, order, settings);
      }

      // Send Email if enabled and customer has email and opted in
      if (settings.emailEnabled && customer && customer.email && customer.opt_in_email) {
        await this.sendOrderEmail(customer, order, settings);
      }

    } catch (error) {
      logger.error('Error sending order confirmation:', error);
    }
  }

  /**
   * Send order status update to customer
   */
  public async sendOrderStatusUpdate(
    orderId: string,
    restaurantId: string,
    newStatus: string
  ) {
    try {
      const db = DatabaseService.getInstance().getDatabase();

      const order = await db.get(`
        SELECT * FROM orders WHERE id = ?
      `, [orderId]);

      if (!order) return;

      // Get customer if they exist
      let customer = null;
      if (order.customer_email) {
        customer = await db.get(`
          SELECT * FROM customers
          WHERE restaurant_id = ? AND email = ?
        `, [restaurantId, order.customer_email]);
      } else if (order.customer_phone) {
        customer = await db.get(`
          SELECT * FROM customers
          WHERE restaurant_id = ? AND phone = ?
        `, [restaurantId, order.customer_phone]);
      }

      if (!customer) return;

      const statusMessage = this.getStatusMessage(newStatus, order);

      // Send SMS if opted in
      if (customer.phone && customer.opt_in_sms) {
        await this.smsService.sendSms(customer.phone, statusMessage);
        await this.logMarketingSend(
          customer.id,
          'sms',
          customer.phone,
          statusMessage,
          'sent'
        );
      }

      // Send Email if opted in
      if (customer.email && customer.opt_in_email) {
        await this.emailTransporter.sendMail({
          from: process.env.EMAIL_FROM || 'noreply@servio.com',
          to: customer.email,
          subject: `Order ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)} - Order #${orderId.substring(0, 8)}`,
          text: statusMessage,
          html: `<p>${statusMessage}</p>`
        });
        await this.logMarketingSend(
          customer.id,
          'email',
          customer.email,
          statusMessage,
          'sent'
        );
      }
    } catch (error) {
      logger.error('Error sending order status update:', error);
    }
  }

  /**
   * Send a message to staff member
   */
  public async sendStaffMessage(
    staffId: string,
    message: string,
    method: 'sms' | 'email' | 'both' = 'both'
  ) {
    try {
      const db = DatabaseService.getInstance().getDatabase();

      const staff = await db.get(`
        SELECT * FROM staff WHERE id = ?
      `, [staffId]);

      if (!staff) {
        throw new Error('Staff member not found');
      }

      const results: { sms: any; email: any } = { sms: null, email: null };

      // Send SMS
      if ((method === 'sms' || method === 'both') && staff.phone) {
        const smsResult = await this.smsService.sendSms(staff.phone, message);
        results.sms = smsResult;
      }

      // Send Email
      if ((method === 'email' || method === 'both') && staff.email) {
        const emailResult = await this.emailTransporter.sendMail({
          from: process.env.EMAIL_FROM || 'noreply@servio.com',
          to: staff.email,
          subject: 'Message from Restaurant',
          text: message,
          html: `<p>${message}</p>`
        });
        results.email = emailResult;
      }

      return results;
    } catch (error) {
      logger.error('Error sending staff message:', error);
      throw error;
    }
  }

  /**
   * Broadcast message to all staff
   */
  public async broadcastToStaff(
    restaurantId: string,
    message: string,
    method: 'sms' | 'email' | 'both' = 'both'
  ) {
    try {
      const db = DatabaseService.getInstance().getDatabase();

      const staffMembers = await db.all(`
        SELECT * FROM staff WHERE restaurant_id = ?
      `, [restaurantId]);

      const results = [];
      for (const staff of staffMembers) {
        try {
          const result = await this.sendStaffMessage(staff.id, message, method);
          results.push({ staffId: staff.id, success: true, result });
        } catch (error) {
          results.push({
            staffId: staff.id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error broadcasting to staff:', error);
      throw error;
    }
  }

  // Private helper methods

  private async getOrCreateCustomer(
    restaurantId: string,
    name: string | null,
    email: string | null,
    phone: string | null,
    totalSpent: number
  ) {
    const db = DatabaseService.getInstance().getDatabase();

    // Try to find existing customer
    let customer = null;
    if (email) {
      customer = await db.get(`
        SELECT * FROM customers WHERE restaurant_id = ? AND email = ?
      `, [restaurantId, email]);
    } else if (phone) {
      customer = await db.get(`
        SELECT * FROM customers WHERE restaurant_id = ? AND phone = ?
      `, [restaurantId, phone]);
    }

    if (customer) {
      // Update customer stats
      await db.run(`
        UPDATE customers
        SET
          total_orders = total_orders + 1,
          total_spent = total_spent + ?,
          last_order_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [totalSpent, customer.id]);

      return await db.get('SELECT * FROM customers WHERE id = ?', [customer.id]);
    } else {
      // Create new customer with auto opt-in for order confirmations
      const customerId = uuidv4();
      await db.run(`
        INSERT INTO customers (
          id, restaurant_id, name, email, phone,
          opt_in_sms, opt_in_email, total_orders, total_spent,
          tags, preferences
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, '[]', '{}')
      `, [
        customerId,
        restaurantId,
        name || 'Customer',
        email,
        phone,
        phone ? 1 : 0,  // Auto opt-in to SMS if phone provided
        email ? 1 : 0,  // Auto opt-in to email if email provided
        totalSpent
      ]);

      return await db.get('SELECT * FROM customers WHERE id = ?', [customerId]);
    }
  }

  private async getNotificationSettings(_restaurantId: string): Promise<OrderNotificationSettings> {
    // For now, return defaults. In the future, these could be stored in DB
    return {
      smsEnabled: true,
      emailEnabled: true,
      smsTemplate: 'Thank you for your order! Order #{orderId} received. Total: ${total}. We\'ll notify you when it\'s ready!',
      emailTemplate: 'Thank you for your order!\n\nOrder #{orderId}\nTotal: ${total}\n\nWe\'ll notify you when your order is ready for pickup!',
      emailSubject: 'Order Confirmation - Order #{orderId}'
    };
  }

  private async sendOrderSms(customer: any, order: any, settings: OrderNotificationSettings) {
    const message = this.formatTemplate(settings.smsTemplate, order);
    const result = await this.smsService.sendSms(customer.phone, message);

    await this.logMarketingSend(
      customer.id,
      'sms',
      customer.phone,
      message,
      result.success ? 'sent' : 'failed',
      result.error ? String(result.error) : null
    );
  }

  private async sendOrderEmail(customer: any, order: any, settings: OrderNotificationSettings) {
    const subject = this.formatTemplate(settings.emailSubject, order);
    const message = this.formatTemplate(settings.emailTemplate, order);

    try {
      await this.emailTransporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@servio.com',
        to: customer.email,
        subject: subject,
        text: message,
        html: message.replace(/\n/g, '<br>')
      });

      await this.logMarketingSend(
        customer.id,
        'email',
        customer.email,
        message,
        'sent'
      );
    } catch (error) {
      await this.logMarketingSend(
        customer.id,
        'email',
        customer.email,
        message,
        'failed',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  private formatTemplate(template: string, order: any): string {
    return template
      .replace(/{orderId}/g, order.id.substring(0, 8))
      .replace(/\${total}/g, `$${order.total_amount.toFixed(2)}`)
      .replace(/{customerName}/g, order.customer_name || 'Customer')
      .replace(/{status}/g, order.status);
  }

  private getStatusMessage(status: string, order: any): string {
    const orderId = order.id.substring(0, 8);
    switch (status) {
      case 'preparing':
        return `Your order #${orderId} is now being prepared!`;
      case 'ready':
        return `Your order #${orderId} is ready for pickup!`;
      case 'completed':
        return `Your order #${orderId} is complete. Thank you for your business!`;
      case 'cancelled':
        return `Your order #${orderId} has been cancelled. Please contact us if you have questions.`;
      default:
        return `Order #${orderId} status updated to ${status}`;
    }
  }

  private async logMarketingSend(
    customerId: string,
    type: 'sms' | 'email',
    recipient: string,
    message: string,
    status: string,
    errorMessage?: string | null
  ) {
    const db = DatabaseService.getInstance().getDatabase();
    await db.run(`
      INSERT INTO marketing_sends (
        id, customer_id, type, recipient, message, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      customerId,
      type,
      recipient,
      message,
      status,
      errorMessage || null
    ]);
  }
}
