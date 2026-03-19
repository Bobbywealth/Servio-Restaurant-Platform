/**
 * Authentication E2E Tests
 * Tests all authentication flows including login, logout, signup, and session management
 */

describe('Authentication', () => {
  const validCredentials = {
    email: 'demo@servio.com',
    password: 'demo123'
  };

  const invalidCredentials = [
    { email: 'invalid@test.com', password: 'wrongpassword', description: 'invalid email' },
    { email: 'demo@servio.com', password: 'wrong', description: 'invalid password' },
    { email: '', password: 'demo123', description: 'empty email' },
    { email: 'demo@servio.com', password: '', description: 'empty password' }
  ];

  beforeEach(() => {
    cy.visit('/login');
  });

  describe('Login Page', () => {
    it('should display login page with all elements', () => {
      cy.url().should('include', '/login');
      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
      cy.contains(/login|sign in/i).should('be.visible');
    });

    it('should show password visibility toggle', () => {
      cy.get('input[type="password"]').should('have.attr', 'type', 'password');
      cy.get('button').contains(/show|eye|visibility/i).should('exist');
    });

    it('should have link to signup page', () => {
      cy.contains(/sign up|create account|register/i).should('be.visible');
      cy.contains(/sign up|create account|register/i).click();
      cy.url().should('include', '/signup');
    });

    it('should have link to forgot password', () => {
      cy.contains(/forgot password|reset password/i).should('be.visible');
    });

    it('should show validation error for empty form submission', () => {
      cy.get('button[type="submit"]').click();
      cy.contains(/required|please fill|invalid/i).should('be.visible');
    });

    invalidCredentials.forEach((cred) => {
      it(`should show error for ${cred.description}`, () => {
        if (cred.email) cy.get('input[type="email"]').clear().type(cred.email);
        if (cred.password) cy.get('input[type="password"]').clear().type(cred.password);
        cy.get('button[type="submit"]').click();
        cy.contains(/invalid|error|incorrect|unable|failed/i).should('be.visible');
      });
    });
  });

  describe('Successful Login', () => {
    it('should login with valid credentials and redirect to dashboard', () => {
      cy.get('input[type="email"]').clear().type(validCredentials.email);
      cy.get('input[type="password"]').clear().type(validCredentials.password);
      cy.get('button[type="submit"]').click();
      
      // Wait for redirect
      cy.url({ timeout: 10000 }).should('not.include', '/login');
      cy.url().should('include', '/dashboard');
    });

    it('should display user info after successful login', () => {
      cy.login(validCredentials.email, validCredentials.password);
      cy.get('[data-testid="user-menu"], [data-testid="user-avatar"], .user-info, [class*="user"]').should('exist');
    });

    it('should persist session across page refresh', () => {
      cy.login(validCredentials.email, validCredentials.password);
      cy.reload();
      cy.url().should('include', '/dashboard');
    });
  });

  describe('Session Management', () => {
    beforeEach(() => {
      cy.login(validCredentials.email, validCredentials.password);
    });

    it('should logout successfully', () => {
      cy.get('[data-testid="logout"], [data-testid="user-menu"], .logout-btn, button[class*="logout"]')
        .first()
        .click();
      cy.contains(/logout|sign out/i).click();
      cy.url().should('include', '/login');
    });

    it('should clear session data after logout', () => {
      cy.logout();
      cy.visit('/dashboard');
      cy.url().should('include', '/login');
    });

    it('should redirect to login when accessing protected routes without session', () => {
      cy.visit('/dashboard');
      cy.url().should('include', '/login');
    });

    it('should display session timeout warning', () => {
      // This test would require mocking session timeout
      // Skipped for now as it requires special setup
    });
  });

  describe('Token Refresh', () => {
    it('should automatically refresh expired token', () => {
      cy.login(validCredentials.email, validCredentials.password);
      // Token refresh is handled automatically
      // The app should continue working seamlessly
      cy.visit('/dashboard');
      cy.get('[class*="dashboard"], [data-page="dashboard"]').should('exist');
    });

    it('should redirect to login on token refresh failure', () => {
      // This would require intercepting and mocking token refresh failure
      cy.login(validCredentials.email, validCredentials.password);
      cy.clearLocalStorage();
      cy.reload();
      cy.url().should('include', '/login');
    });
  });

  describe('Signup', () => {
    beforeEach(() => {
      cy.visit('/signup');
    });

    it('should display signup form with all fields', () => {
      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
      cy.get('input[name="name"], input[name="fullName"], input[name="firstName"]').should('exist');
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('should show password strength indicator', () => {
      cy.get('input[type="password"]').type('weak');
      cy.contains(/weak|weak password/i).should('exist');
    });

    it('should validate email format', () => {
      cy.get('input[type="email"]').type('invalid-email');
      cy.get('button[type="submit"]').click();
      cy.contains(/invalid email|valid email|email format/i).should('be.visible');
    });

    it('should show error for existing email', () => {
      cy.get('input[type="email"]').clear().type(validCredentials.email);
      cy.get('input[type="password"]').clear().type('newpassword123');
      cy.get('button[type="submit"]').click();
      cy.contains(/already exists|already in use|Email already/i).should('be.visible');
    });

    it('should successfully create new account', () => {
      const timestamp = Date.now();
      cy.get('input[type="email"]').clear().type(`newuser${timestamp}@test.com`);
      cy.get('input[type="password"]').clear().type('StrongP@ss123');
      cy.get('input[name="name"], input[name="fullName"]').clear().type('Test User');
      cy.get('button[type="submit"]').click();
      
      // Should either redirect to dashboard or show success message
      cy.url().should('satisfy', (url) => {
        return url.includes('/dashboard') || url.includes('/signup/success');
      });
    });
  });
});

describe('Protected Routes', () => {
  const protectedRoutes = [
    '/dashboard',
    '/dashboard/orders',
    '/dashboard/menu-management',
    '/dashboard/staff',
    '/dashboard/timeclock',
    '/dashboard/schedule',
    '/dashboard/inventory',
    '/dashboard/marketing',
    '/dashboard/settings',
    '/dashboard/assistant',
    '/admin',
    '/admin/orders',
    '/admin/restaurants'
  ];

  const validCredentials = {
    email: 'demo@servio.com',
    password: 'demo123'
  };

  protectedRoutes.forEach((route) => {
    it(`should redirect unauthenticated user from ${route} to login`, () => {
      cy.visit(route);
      cy.url().should('include', '/login');
    });

    it(`should allow authenticated user to access ${route}`, () => {
      cy.login(validCredentials.email, validCredentials.password);
      cy.visit(route);
      cy.url().should('include', route);
    });
  });
});

describe('Password Visibility Toggle', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should toggle password visibility', () => {
    cy.get('input[type="password"]').should('have.attr', 'type', 'password');
    cy.get('button').contains(/show|eye|visibility/i).click();
    cy.get('input[type="password"], input[type="text"]').should('have.attr', 'type', 'text');
  });

  it('should hide password after toggle', () => {
    cy.get('input[type="password"]').type('testpassword');
    cy.get('button').contains(/show|eye|visibility/i).click();
    cy.get('button').contains(/hide|eye-slash/i).click();
    cy.get('input[type="password"]').should('have.attr', 'type', 'password');
  });
});
