/**
 * Admin Dashboard E2E Tests
 * Tests all admin-related functionality including platform management, restaurants, and billing
 */

describe('Admin Dashboard', () => {
  const adminCredentials = {
    email: 'admin@servio.com',
    password: 'admin123'
  };

  beforeEach(() => {
    cy.login(adminCredentials.email, adminCredentials.password);
    cy.visit('/admin');
  });

  describe('Admin Page Load', () => {
    it('should display admin dashboard page', () => {
      cy.get('h1').contains(/admin|dashboard/i).should('be.visible');
    });

    it('should display platform stats', () => {
      cy.get('[data-testid="stats"], .stats').should('exist');
    });

    it('should display restaurant list', () => {
      cy.get('[data-testid="restaurants"], .restaurants').should('exist');
    });

    it('should display recent activity', () => {
      cy.get('[data-testid="activity"], .activity').should('exist');
    });
  });

  describe('Platform Stats', () => {
    it('should display total restaurants count', () => {
      cy.get('[data-testid="stats"]').contains(/restaurants|total/i).should('exist');
    });

    it('should display active orders count', () => {
      cy.get('[data-testid="stats"]').contains(/orders|active/i).should('exist');
    });

    it('should display total users count', () => {
      cy.get('[data-testid="stats"]').contains(/users|total/i).should('exist');
    });

    it('should handle stats loading errors gracefully', () => {
      // Test with API failure
    });
  });

  describe('Admin Restaurants', () => {
    beforeEach(() => {
      cy.visit('/admin/restaurants');
    });

    it('should display restaurant list', () => {
      cy.get('[data-testid="restaurant-card"], .restaurant-card').should('exist');
    });

    it('should display restaurant details', () => {
      cy.get('[data-testid="restaurant-card"]').first().within(() => {
        cy.contains(/[a-zA-Z]/).should('exist');
        cy.contains(/active|inactive/i).should('exist');
      });
    });

    it('should create new restaurant', () => {
      cy.get('button').contains(/add restaurant|new/i).click();
      cy.get('input[name="name"]').clear().type('Test Restaurant');
      cy.get('input[name="slug"]').clear().type('test-restaurant');
      cy.get('input[name="email"]').clear().type('test@restaurant.com');
      cy.get('button').contains(/save|create/i).click();
      cy.contains(/success|created/i).should('be.visible');
    });

    it('should edit restaurant', () => {
      cy.get('[data-testid="restaurant-card"]').first().click();
      cy.get('button').contains(/edit|settings/i).click();
      cy.get('input[name="name"]').clear().type('Updated Name');
      cy.get('button').contains(/save|update/i).click();
    });

    it('should toggle restaurant active status', () => {
      cy.get('[data-testid="restaurant-card"]').first().within(() => {
        cy.get('button').contains(/deactivate|toggle|switch/i).click();
      });
      cy.contains(/confirm/i).should('be.visible');
    });

    it('should view restaurant details', () => {
      cy.get('[data-testid="restaurant-card"]').first().click();
      cy.get('[data-testid="restaurant-details"]').should('exist');
    });
  });

  describe('Admin Orders', () => {
    beforeEach(() => {
      cy.visit('/admin/orders');
    });

    it('should display multi-restaurant order view', () => {
      cy.get('[data-testid="orders-list"]').should('exist');
    });

    it('should filter by restaurant', () => {
      cy.get('select[name="restaurantId"]').select(0);
      cy.wait(500);
    });

    it('should update order status', () => {
      cy.get('[data-testid="order-card"]').first().click();
      cy.get('button').contains(/update|status/i).click();
    });
  });

  describe('Admin Users', () => {
    beforeEach(() => {
      cy.visit('/admin/users');
    });

    it('should display user list', () => {
      cy.get('[data-testid="user-card"], table').should('exist');
    });

    it('should invite new user', () => {
      cy.get('button').contains(/invite|add user/i).click();
      cy.get('input[name="email"]').clear().type('newuser@test.com');
      cy.get('select[name="role"]').select('manager');
      cy.get('button').contains(/send|invite/i).click();
      cy.contains(/invitation|sent/i).should('be.visible');
    });
  });

  describe('Billing', () => {
    beforeEach(() => {
      cy.visit('/admin/billing');
    });

    it('should display billing overview', () => {
      cy.get('[data-testid="billing"]').should('exist');
    });

    it('should display subscription info', () => {
      cy.contains(/subscription|plan|features/i).should('exist');
    });
  });

  describe('Campaign Moderation', () => {
    beforeEach(() => {
      cy.visit('/admin/campaigns');
    });

    it('should display pending campaigns', () => {
      cy.get('[data-testid="campaign-card"]').should('exist');
    });

    it('should approve campaign', () => {
      cy.get('[data-testid="campaign-card"]').first().within(() => {
        cy.get('button').contains(/approve|accept/i).click();
      });
      cy.contains(/approved|success/i).should('be.visible');
    });

    it('should disapprove campaign', () => {
      cy.get('[data-testid="campaign-card"]').first().within(() => {
        cy.get('button').contains(/disapprove|reject/i).click();
      });
      cy.contains(/confirm/i).should('be.visible');
    });
  });

  describe('Audit Logs', () => {
    beforeEach(() => {
      cy.visit('/admin/audit');
    });

    it('should display audit logs', () => {
      cy.get('[data-testid="audit-log"], table').should('exist');
    });

    it('should filter by action type', () => {
      cy.get('select[name="action"]').select('login');
      cy.wait(500);
    });

    it('should filter by date range', () => {
      cy.get('input[type="date"]').should('exist');
    });
  });

  describe('System Health', () => {
    beforeEach(() => {
      cy.visit('/admin/system-health');
    });

    it('should display system status', () => {
      cy.get('[data-testid="health"], [class*="health"]').should('exist');
    });

    it('should display service status indicators', () => {
      cy.contains(/database|api|server|healthy|healthy/i).should('exist');
    });
  });

  describe('Error Tracking', () => {
    beforeEach(() => {
      cy.visit('/admin/diagnostics');
    });

    it('should display recent errors', () => {
      cy.get('[data-testid="errors"]').should('exist');
    });

    it('should filter errors by severity', () => {
      cy.get('select[name="severity"]').select('error');
    });
  });
});

/**
 * Tablet Orders E2E Tests
 * Tests all tablet/kitchen display functionality
 */

describe('Tablet Orders', () => {
  const validCredentials = {
    email: 'demo@servio.com',
    password: 'demo123'
  };

  beforeEach(() => {
    cy.login(validCredentials.email, validCredentials.password);
    cy.visit('/tablet/orders');
  });

  describe('Tablet Page Load', () => {
    it('should display tablet orders page', () => {
      cy.get('h1').contains(/orders|queue/i).should('be.visible');
    });

    it('should display order queue', () => {
      cy.get('[data-testid="order-queue"], .order-queue').should('exist');
    });

    it('should have large touch-friendly elements', () => {
      cy.get('button').should('have.css', 'min-height').and('not.eq', '0px');
    });
  });

  describe('Order Queue', () => {
    it('should display incoming orders', () => {
      cy.get('[data-testid="order-card"], .order-card').should('exist');
    });

    it('should display order details', () => {
      cy.get('[data-testid="order-card"]').first().within(() => {
        cy.contains(/order|#|\d+/i).should('exist');
        cy.contains(/items|products/i).should('exist');
      });
    });

    it('should display order timer', () => {
      cy.get('[data-testid="order-card"]').first().within(() => {
        cy.contains(/\d+:\d+|min/i).should('exist');
      });
    });

    it('should highlight overdue orders', () => {
      cy.get('[data-testid="order-card"][data-overdue="true"], .order-card.overdue').should('exist');
    });
  });

  describe('Order Status Updates', () => {
    it('should have large status update buttons', () => {
      cy.get('button').contains(/start|prepare|ready|complete/i).should('exist');
    });

    it('should update order to preparing', () => {
      cy.get('[data-testid="order-card"]').first().within(() => {
        cy.get('button').contains(/start|prepare/i).click();
      });
      cy.contains(/preparing|in progress/i).should('be.visible');
    });

    it('should update order to ready', () => {
      cy.get('[data-testid="order-card"]').first().within(() => {
        cy.get('button').contains(/ready/i).click();
      });
      cy.contains(/ready/i).should('be.visible');
    });

    it('should update order to completed', () => {
      cy.get('[data-testid="order-card"]').first().within(() => {
        cy.get('button').contains(/complete|done/i).click();
      });
      cy.contains(/completed|done/i).should('be.visible');
    });
  });

  describe('Order Details', () => {
    it('should display full order details on tap', () => {
      cy.get('[data-testid="order-card"]').first().click();
      cy.get('[data-testid="order-details"]').should('be.visible');
    });

    it('should display order items', () => {
      cy.get('[data-testid="order-card"]').first().click();
      cy.get('[data-testid="items-list"]').should('exist');
    });

    it('should display special instructions', () => {
      cy.get('[data-testid="order-card"]').first().click();
      cy.get('[data-testid="instructions"], .instructions').should('exist');
    });

    it('should close order details', () => {
      cy.get('[data-testid="order-card"]').first().click();
      cy.get('[data-testid="close"]').click();
      cy.get('[data-testid="order-details"]').should('not.exist');
    });
  });

  describe('Notifications', () => {
    it('should play sound for new orders', () => {
      // Would require audio detection
    });

    it('should show visual notification for new orders', () => {
      cy.contains(/new order|alert/i).should('exist');
    });
  });

  describe('Filters', () => {
    it('should filter by status', () => {
      cy.get('button').contains(/all|pending|preparing/i).click();
    });

    it('should show order count per status', () => {
      cy.get('[data-testid="status-count"]').should('exist');
    });
  });
});

describe('Kitchen Display', () => {
  const validCredentials = {
    email: 'demo@servio.com',
    password: 'demo123'
  };

  beforeEach(() => {
    cy.login(validCredentials.email, validCredentials.password);
    cy.visit('/tablet/kitchen');
  });

  describe('Kitchen Display Load', () => {
    it('should display kitchen display page', () => {
      cy.get('h1').contains(/kitchen|display/i).should('be.visible');
    });

    it('should display order queue', () => {
      cy.get('[data-testid="kitchen-queue"]').should('exist');
    });

    it('should have large touch targets', () => {
      cy.get('button').should('have.css', 'min-height').and('not.eq', '0px');
    });
  });

  describe('Timers', () => {
    it('should display timers for each order', () => {
      cy.get('[data-testid="timer"]').should('exist');
    });

    it('should show elapsed time', () => {
      cy.get('[data-testid="timer"]').first().contains(/\d+:\d+/).should('exist');
    });

    it('should highlight overdue timers', () => {
      cy.get('[data-testid="timer"].overdue, .timer.overdue').should('exist');
    });
  });

  describe('Order Items', () => {
    it('should display item names clearly', () => {
      cy.get('[data-testid="order-item"]').first().contains(/[a-zA-Z]/).should('exist');
    });

    it('should display modifiers', () => {
      cy.get('[data-testid="order-item"]').first().contains(/no |extra |add /i).should('exist');
    });

    it('should mark completed items', () => {
      cy.get('[data-testid="order-item"].completed').should('exist');
    });
  });

  describe('Status Buttons', () => {
    it('should have binned status buttons', () => {
      cy.get('button').contains(/bump|complete|done/i).should('exist');
    });

    it('should mark order as complete', () => {
      cy.get('button').contains(/bump|complete/i).first().click();
    });
  });
});
