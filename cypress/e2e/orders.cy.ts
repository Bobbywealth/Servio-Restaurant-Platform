describe('Orders Dashboard', () => {
  beforeEach(() => {
    // Visit the login page first
    cy.visit('/login');
  });

  it('should display login page', () => {
    cy.url().should('include', '/login');
    cy.contains(/login|sign in/i).should('be.visible');
  });

  it('should show error for invalid credentials', () => {
    cy.get('input[type="email"]').type('invalid@test.com');
    cy.get('input[type="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();
    
    // Should show error message
    cy.contains(/invalid|error|incorrect/i).should('be.visible');
  });
});

describe('Orders Analytics', () => {
  // Skip these tests if no authenticated session
  it.skip('should toggle analytics panel', () => {
    cy.visit('/dashboard/orders');
    
    // Click analytics toggle button
    cy.contains('button', /analytics|stats/i).click();
    
    // Analytics panel should be visible
    cy.contains('Order Analytics').should('be.visible');
    
    // Should show key metrics
    cy.contains(/revenue/i).should('be.visible');
    cy.contains(/orders/i).should('be.visible');
  });

  it.skip('should switch between time periods', () => {
    cy.visit('/dashboard/orders');
    
    // Open analytics
    cy.contains('button', /analytics/i).click();
    
    // Click on different period buttons
    cy.contains('button', 'Today').click();
    cy.contains('button', 'Week').click();
    cy.contains('button', 'Month').click();
    
    // Revenue should update (you'd add assertions for actual values)
  });
});

describe('API Endpoints', () => {
  it('should return health status', () => {
    cy.request('/api/health').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('status', 'ok');
    });
  });

  it('should return 401 for protected endpoints without auth', () => {
    cy.request({
      url: '/api/orders',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.be.oneOf([401, 403]);
    });
  });
});
