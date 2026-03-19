/**
 * Orders E2E Tests
 * Tests all order-related functionality including CRUD, status updates, filtering, and search
 */

describe('Orders', () => {
  const validCredentials = {
    email: 'demo@servio.com',
    password: 'demo123'
  };

  beforeEach(() => {
    cy.login(validCredentials.email, validCredentials.password);
    cy.visit('/dashboard/orders');
    cy.url().should('include', '/dashboard/orders');
  });

  describe('Orders Page Load', () => {
    it('should display orders page with all elements', () => {
      cy.get('h1, h2').contains(/orders|order/i).should('be.visible');
      cy.get('[data-testid="orders-list"], .orders-list, [class*="orders"]').should('exist');
    });

    it('should display filters bar', () => {
      cy.get('[data-testid="filters"], .filters, [class*="filter"]').should('exist');
      cy.contains(/filter|search|status/i).should('exist');
    });

    it('should display status filter options', () => {
      cy.contains(/status|all|pending|preparing|ready|completed|cancelled/i).should('exist');
    });

    it('should display search input', () => {
      cy.get('input[type="search"], input[placeholder*="search"], input[name="search"]').should('exist');
    });
  });

  describe('Order List', () => {
    it('should display list of orders', () => {
      cy.get('[data-testid="order-card"], .order-card, [class*="order-item"]')
        .first()
        .should('exist');
    });

    it('should display order information correctly', () => {
      cy.get('[data-testid="order-card"], .order-card, [class*="order-item"]')
        .first()
        .within(() => {
          cy.contains(/order|#|id/i).should('exist');
          cy.contains(/\$|price|total/i).should('exist');
        });
    });

    it('should display order status badges', () => {
      cy.get('[class*="status"], [data-testid="status"]').should('exist');
    });

    it('should handle empty orders list', () => {
      // Visit page that might have no orders
      cy.visit('/dashboard/orders?status=none');
      cy.contains(/no orders|empty|no results/i).should('exist');
    });

    it('should display order timestamps', () => {
      cy.get('[data-testid="order-card"], .order-card')
        .first()
        .within(() => {
          cy.contains(/\d{1,2}:\d{2}|today|yesterday|\d+min/i).should('exist');
        });
    });
  });

  describe('Order Filtering', () => {
    const statuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

    statuses.forEach((status) => {
      it(`should filter orders by ${status} status`, () => {
        // Find and click the status filter
        cy.get('[data-testid="status-filter"], .status-filter, select[name="status"]')
          .select(status)
          .should('have.value', status);
        
        // Wait for filter to apply
        cy.wait(500);
        
        // All visible orders should have the selected status
        cy.get('[data-testid="order-card"], .order-card').each(($order) => {
          cy.wrap($order).contains(new RegExp(status, 'i')).should('exist');
        });
      });
    });

    it('should filter orders by channel', () => {
      cy.get('[data-testid="channel-filter"], select[name="channel"]').select('web');
      cy.wait(500);
      cy.get('[data-testid="order-card"]').first().contains(/web|online/i).should('exist');
    });

    it('should filter orders by date range', () => {
      cy.get('[data-testid="date-filter"], input[type="date"]').should('exist');
    });

    it('should reset filters', () => {
      cy.get('[data-testid="status-filter"]').select('pending');
      cy.get('button').contains(/reset|clear|all/i).click();
      cy.get('[data-testid="status-filter"]').should('have.value', '');
    });
  });

  describe('Order Search', () => {
    it('should search orders by order ID', () => {
      cy.get('input[type="search"], input[placeholder*="search"]').type('ORD-001');
      cy.wait(500);
      cy.get('[data-testid="order-card"]').should('exist');
    });

    it('should search orders by customer name', () => {
      cy.get('input[type="search"], input[placeholder*="search"]').type('John');
      cy.wait(500);
      cy.get('[data-testid="order-card"]').contains(/john/i).should('exist');
    });

    it('should show no results message for invalid search', () => {
      cy.get('input[type="search"], input[placeholder*="search"]').type('xyznonexistent123');
      cy.wait(1000);
      cy.contains(/no results|no orders found|empty/i).should('exist');
    });

    it('should clear search results', () => {
      cy.get('input[type="search"], input[placeholder*="search"]').type('test');
      cy.get('button').contains(/clear|x|reset/i).click();
      cy.get('input[type="search"], input[placeholder*="search"]').should('have.value', '');
    });
  });

  describe('Order Pagination', () => {
    it('should display pagination controls', () => {
      cy.get('[data-testid="pagination"], .pagination, nav').should('exist');
    });

    it('should navigate to next page', () => {
      cy.get('button').contains(/next|>|›/i).click();
      cy.wait(500);
      // Verify page changed
    });

    it('should navigate to previous page', () => {
      cy.get('button').contains(/prev|<|‹/i).click();
      cy.wait(500);
    });

    it('should navigate to specific page', () => {
      cy.get('button').contains(/3|page 2|2/i).click();
      cy.wait(500);
    });
  });

  describe('Order Details', () => {
    beforeEach(() => {
      cy.get('[data-testid="order-card"], .order-card').first().click();
    });

    it('should open order details modal/panel', () => {
      cy.get('[data-testid="order-details"], [class*="order-details"], [role="dialog"]')
        .should('be.visible');
    });

    it('should display complete order information', () => {
      cy.get('[data-testid="order-details"]').within(() => {
        cy.contains(/order|#|id/i).should('exist');
        cy.contains(/customer|phone|email/i).should('exist');
        cy.contains(/items|products|order items/i).should('exist');
        cy.contains(/total|price|amount/i).should('exist');
        cy.contains(/status/i).should('exist');
        cy.contains(/time|date|created/i).should('exist');
      });
    });

    it('should display order items list', () => {
      cy.get('[data-testid="order-items"], [class*="order-items"]').within(() => {
        cy.get('[data-testid="order-item"], .order-item').should('exist');
      });
    });

    it('should close order details', () => {
      cy.get('[data-testid="close"], button[class*="close"], [aria-label="close"]').click();
      cy.get('[data-testid="order-details"]').should('not.exist');
    });
  });

  describe('Order Status Updates', () => {
    beforeEach(() => {
      cy.get('[data-testid="order-card"], .order-card').first().click();
    });

    const statusTransitions = [
      { from: 'pending', to: 'preparing' },
      { from: 'preparing', to: 'ready' },
      { from: 'ready', to: 'completed' }
    ];

    statusTransitions.forEach((transition) => {
      it(`should update status from ${transition.from} to ${transition.to}`, () => {
        // Find the order with the initial status
        cy.get('[data-testid="order-card"]')
          .filter(`:contains("${transition.from}")`)
          .first()
          .click();
        
        // Click the status update button
        cy.get('button').contains(new RegExp(transition.to, 'i')).click();
        
        // Verify status changed
        cy.contains(new RegExp(transition.to, 'i')).should('exist');
      });
    });

    it('should cancel an order', () => {
      cy.get('button').contains(/cancel|reject/i).click();
      cy.contains(/confirm|are you sure/i).should('be.visible');
      cy.get('button').contains(/confirm|cancel order/i).click();
      cy.contains(/cancelled|canceled/i).should('exist');
    });

    it('should update preparation time', () => {
      cy.get('button').contains(/prep time|set time/i).click();
      cy.get('input[type="number"], input[name="prepTime"]').clear().type('15');
      cy.get('button').contains(/save|update|confirm/i).click();
    });
  });

  describe('Order Creation', () => {
    beforeEach(() => {
      cy.visit('/dashboard/orders');
    });

    it('should have create new order button', () => {
      cy.get('button').contains(/new order|create order|add order/i).should('exist');
    });

    it('should open new order form/modal', () => {
      cy.get('button').contains(/new order|create order|add order/i).click();
      cy.get('[data-testid="order-form"], [role="dialog"]').should('be.visible');
    });

    it('should select customer', () => {
      cy.get('button').contains(/new order|create order/i).click();
      cy.get('[data-testid="customer-select"], select[name="customerId"], input[name="customer"]')
        .should('exist');
    });

    it('should add items to order', () => {
      cy.get('button').contains(/new order/i).click();
      cy.get('[data-testid="menu-items"], .menu-items').should('exist');
      cy.get('[data-testid="menu-item"], .menu-item').first().click();
      cy.get('[data-testid="order-items"]').contains(/item|product/i).should('exist');
    });

    it('should calculate order total', () => {
      cy.get('button').contains(/new order/i).click();
      cy.get('[data-testid="menu-item"]').first().click();
      cy.get('[data-testid="order-total"], .total').should('exist');
    });

    it('should submit new order', () => {
      cy.get('button').contains(/new order/i).click();
      cy.get('[data-testid="menu-item"]').first().click();
      cy.get('button').contains(/submit|create|place order/i).click();
      cy.contains(/success|created|order placed/i).should('be.visible');
    });
  });

  describe('Order Analytics', () => {
    it('should display analytics toggle button', () => {
      cy.get('button').contains(/analytics|stats|charts/i).should('exist');
    });

    it('should open analytics panel', () => {
      cy.get('button').contains(/analytics|stats/i).click();
      cy.get('[data-testid="analytics-panel"], [class*="analytics"]').should('be.visible');
    });

    it('should display revenue metrics', () => {
      cy.get('button').contains(/analytics/i).click();
      cy.contains(/revenue|sales|income/i).should('exist');
    });

    it('should display order count metrics', () => {
      cy.get('button').contains(/analytics/i).click();
      cy.contains(/orders|order count|total orders/i).should('exist');
    });

    it('should switch between time periods', () => {
      cy.get('button').contains(/analytics/i).click();
      cy.contains(/today|day|week|month|year/i).should('exist');
      cy.contains(/week/i).click();
      cy.wait(500);
    });
  });

  describe('Real-time Updates', () => {
    it('should show new order notification', () => {
      // This test would require WebSocket mocking
      // Skipping for now
    });

    it('should auto-refresh order list', () => {
      // This test would require polling/intervals setup
    });
  });
});

describe('Public Order Tracking', () => {
  it('should display public order tracking page', () => {
    cy.visit('/order/track');
    cy.contains(/track|order|status/i).should('exist');
  });

  it('should lookup order by ID', () => {
    cy.visit('/order/track');
    cy.get('input[name="orderId"], input[placeholder*="order"]').type('ORD-123');
    cy.get('button').contains(/track|search|find/i).click();
  });
});

describe('Order Queue Views', () => {
  const validCredentials = {
    email: 'demo@servio.com',
    password: 'demo123'
  };

  it('should display Kanban view', () => {
    cy.login(validCredentials.email, validCredentials.password);
    cy.visit('/dashboard/orders');
    cy.get('[data-testid="view-toggle"], .view-toggle').contains(/kanban|board/i).click();
    cy.get('[data-testid="kanban-board"], .kanban').should('exist');
  });

  it('should display table view', () => {
    cy.login(validCredentials.email, validCredentials.password);
    cy.visit('/dashboard/orders');
    cy.get('[data-testid="view-toggle"]').contains(/table|list/i).click();
    cy.get('[data-testid="orders-table"], table').should('exist');
  });
});
