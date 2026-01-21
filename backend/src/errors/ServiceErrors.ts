import { BadRequestError, NotFoundError } from '../middleware/errorHandler';

export class OrderNotFoundError extends NotFoundError {
  constructor(message: string = 'Order not found') {
    super(message);
    this.name = 'OrderNotFoundError';
  }
}

export class InvalidOrderStatusError extends BadRequestError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOrderStatusError';
  }
}

export class OrderValidationError extends BadRequestError {
  constructor(message: string) {
    super(message);
    this.name = 'OrderValidationError';
  }
}

export class InventoryItemNotFoundError extends NotFoundError {
  constructor(message: string = 'Inventory item not found') {
    super(message);
    this.name = 'InventoryItemNotFoundError';
  }
}

export class InventoryValidationError extends BadRequestError {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryValidationError';
  }
}

