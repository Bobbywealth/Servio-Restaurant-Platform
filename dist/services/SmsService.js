"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsService = void 0;
const twilio_1 = __importDefault(require("twilio"));
const logger_1 = require("../utils/logger");
class SmsService {
    constructor() {
        this.client = null;
        this.fromNumber = null;
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        this.fromNumber = process.env.TWILIO_PHONE_NUMBER || null;
        if (sid && token) {
            this.client = (0, twilio_1.default)(sid, token);
            logger_1.logger.info('Twilio SMS service initialized');
        }
        else {
            logger_1.logger.warn('Twilio SMS service not initialized - missing credentials');
        }
    }
    static getInstance() {
        if (!SmsService.instance) {
            SmsService.instance = new SmsService();
        }
        return SmsService.instance;
    }
    async sendSms(to, message) {
        if (!this.client || !this.fromNumber) {
            logger_1.logger.warn(`SMS simulation to ${to}: ${message}`);
            return { success: true, simulated: true };
        }
        try {
            const result = await this.client.messages.create({
                body: message,
                from: this.fromNumber,
                to: to
            });
            logger_1.logger.info(`SMS sent to ${to}, SID: ${result.sid}`);
            return { success: true, sid: result.sid };
        }
        catch (error) {
            logger_1.logger.error(`Failed to send SMS to ${to}:`, error);
            return { success: false, error };
        }
    }
}
exports.SmsService = SmsService;
//# sourceMappingURL=SmsService.js.map