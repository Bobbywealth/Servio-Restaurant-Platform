/**
 * Staff Management E2E Tests
 * Tests all staff-related functionality including CRUD, roles, and PIN management
 */

describe('Staff Management', () => {
  const validCredentials = {
    email: 'demo@servio.com',
    password: 'demo123'
  };

  beforeEach(() => {
    cy.login(validCredentials.email, validCredentials.password);
    cy.visit('/dashboard/staff');
    cy.url().should('include', '/dashboard/staff');
  });

  describe('Staff Page Load', () => {
    it('should display staff management page', () => {
      cy.get('h1, h2').contains(/staff|team/i).should('be.visible');
    });

    it('should display staff list', () => {
      cy.get('[data-testid="staff-list"], .staff-list').should('exist');
    });

    it('should display add staff button', () => {
      cy.get('button').contains(/add staff|add member|new/i).should('exist');
    });

    it('should display search input', () => {
      cy.get('input[type="search"], input[placeholder*="search"]').should('exist');
    });
  });

  describe('Staff List', () => {
    it('should display list of staff members', () => {
      cy.get('[data-testid="staff-card"], .staff-card, [class*="staff"]').should('exist');
    });

    it('should display staff information', () => {
      cy.get('[data-testid="staff-card"]').first().within(() => {
        cy.contains(/[a-zA-Z]/).should('exist');
        cy.contains(/@|email|role/i).should('exist');
      });
    });

    it('should display staff roles', () => {
      cy.get('[data-testid="staff-card"]').first().within(() => {
        cy.contains(/manager|cook|server|cashier|admin/i).should('exist');
      });
    });

    it('should display staff status (active/inactive)', () => {
      cy.get('[data-testid="staff-card"]').first().within(() => {
        cy.contains(/active|inactive|status/i).should('exist');
      });
    });

    it('should handle empty staff list', () => {
      cy.visit('/dashboard/staff?role=none');
      cy.contains(/no staff|no members|add your first/i).should('exist');
    });
  });

  describe('Add Staff', () => {
    it('should open add staff form', () => {
      cy.get('button').contains(/add staff|add member/i).click();
      cy.get('[data-testid="staff-form"], [role="dialog"]').should('be.visible');
    });

    it('should display all required fields', () => {
      cy.get('button').contains(/add staff/i).click();
      cy.get('input[name="firstName"], input[name="name"]').should('exist');
      cy.get('input[name="email"]').should('exist');
      cy.get('select[name="role"], input[name="role"]').should('exist');
    });

    it('should validate email format', () => {
      cy.get('button').contains(/add staff/i).click();
      cy.get('input[name="email"]').clear().type('invalid-email');
      cy.get('button').contains(/save|create/i).click();
      cy.contains(/invalid email|valid email/i).should('be.visible');
    });

    it('should successfully add new staff', () => {
      const timestamp = Date.now();
      cy.get('button').contains(/add staff/i).click();
      cy.get('input[name="firstName"]').clear().type('Test');
      cy.get('input[name="lastName"]').clear().type('Staff');
      cy.get('input[name="email"]').clear().type(`staff${timestamp}@test.com`);
      cy.get('select[name="role"]').select('server');
      cy.get('button').contains(/save|create/i).click();
      cy.contains(/success|created|added/i).should('be.visible');
    });

    it('should show error for duplicate email', () => {
      cy.get('button').contains(/add staff/i).click();
      cy.get('input[name="email"]').clear().type(validCredentials.email);
      cy.get('button').contains(/save/i).click();
      cy.contains(/already exists|duplicate|already in use/i).should('be.visible');
    });
  });

  describe('Edit Staff', () => {
    beforeEach(() => {
      cy.get('[data-testid="staff-card"]').first().click();
    });

    it('should open edit staff form', () => {
      cy.get('button').contains(/edit|modify|update/i).click();
      cy.get('[data-testid="staff-form"]').should('be.visible');
    });

    it('should update staff name', () => {
      cy.get('button').contains(/edit/i).click();
      cy.get('input[name="firstName"]').clear().type('Updated');
      cy.get('button').contains(/save|update/i).click();
      cy.contains(/success|updated/i).should('be.visible');
    });

    it('should update staff role', () => {
      cy.get('button').contains(/edit/i).click();
      cy.get('select[name="role"]').select('manager');
      cy.get('button').contains(/save/i).click();
      cy.contains(/success/i).should('be.visible');
    });

    it('should update staff position', () => {
      cy.get('button').contains(/edit/i).click();
      cy.get('input[name="position"]').clear().type('Head Chef');
      cy.get('button').contains(/save/i).click();
    });
  });

  describe('PIN Management', () => {
    it('should have set/reset PIN option', () => {
      cy.get('[data-testid="staff-card"]').first().within(() => {
        cy.get('button').contains(/pin|set pin|reset/i).should('exist');
      });
    });

    it('should set new PIN', () => {
      cy.get('[data-testid="staff-card"]').first().within(() => {
        cy.get('button').contains(/pin/i).click();
      });
      cy.get('input[name="pin"]').clear().type('5678');
      cy.get('input[name="confirmPin"]').clear().type('5678');
      cy.get('button').contains(/save|set/i).click();
      cy.contains(/success|pin set/i).should('be.visible');
    });

    it('should require matching PIN confirmation', () => {
      cy.get('[data-testid="staff-card"]').first().within(() => {
        cy.get('button').contains(/pin/i).click();
      });
      cy.get('input[name="pin"]').clear().type('1234');
      cy.get('input[name="confirmPin"]').clear().type('5678');
      cy.get('button').contains(/save/i).click();
      cy.contains(/match|do not match/i).should('be.visible');
    });

    it('should require 4-digit PIN', () => {
      cy.get('[data-testid="staff-card"]').first().within(() => {
        cy.get('button').contains(/pin/i).click();
      });
      cy.get('input[name="pin"]').clear().type('12');
      cy.get('button').contains(/save/i).click();
      cy.contains(/4 digits|4-digit/i).should('be.visible');
    });
  });

  describe('Deactivate/Activate Staff', () => {
    it('should deactivate staff member', () => {
      cy.get('[data-testid="staff-card"]').first().within(() => {
        cy.get('button').contains(/deactivate|disable/i).click();
      });
      cy.contains(/confirm|are you sure/i).should('be.visible');
      cy.get('button').contains(/confirm|deactivate/i).click();
      cy.contains(/deactivated|disabled/i).should('be.visible');
    });

    it('should reactivate staff member', () => {
      cy.get('[data-testid="staff-card"]').contains(/inactive|disabled/i).within(() => {
        cy.get('button').contains(/activate|enable/i).click();
      });
      cy.contains(/activated|enabled/i).should('be.visible');
    });
  });

  describe('Staff Search', () => {
    it('should search by name', () => {
      cy.get('input[type="search"]').type('John');
      cy.wait(500);
      cy.get('[data-testid="staff-card"]').contains(/john/i).should('exist');
    });

    it('should search by email', () => {
      cy.get('input[type="search"]').type('demo@servio');
      cy.wait(500);
      cy.get('[data-testid="staff-card"]').should('exist');
    });

    it('should show no results for invalid search', () => {
      cy.get('input[type="search"]').type('xyznonexistent');
      cy.wait(500);
      cy.contains(/no results|no staff found/i).should('exist');
    });
  });

  describe('Role Filtering', () => {
    it('should filter by role', () => {
      cy.get('select[name="role"], [data-testid="role-filter"]').select('manager');
      cy.wait(500);
      cy.get('[data-testid="staff-card"]').within(() => {
        cy.contains(/manager/i).should('exist');
      });
    });

    it('should filter by status', () => {
      cy.get('select[name="status"]').select('active');
      cy.wait(500);
      cy.get('[data-testid="staff-card"]').should('exist');
    });
  });

  describe('Bulk Actions', () => {
    it('should select multiple staff members', () => {
      cy.get('[type="checkbox"]').first().check();
      cy.get('[type="checkbox"]').eq(1).check();
      cy.get('[data-testid="bulk-actions"], .bulk-actions').should('exist');
    });

    it('should bulk deactivate', () => {
      cy.get('[type="checkbox"]').first().check();
      cy.get('button').contains(/deactivate|bulk/i).click();
      cy.contains(/confirm/i).should('be.visible');
    });

    it('should bulk activate', () => {
      cy.get('[type="checkbox"]').first().check();
      cy.get('button').contains(/activate/i).click();
    });
  });
});

describe('Staff Schedule', () => {
  const validCredentials = {
    email: 'demo@servio.com',
    password: 'demo123'
  };

  beforeEach(() => {
    cy.login(validCredentials.email, validCredentials.password);
    cy.visit('/dashboard/schedule');
  });

  describe('Schedule Page Load', () => {
    it('should display schedule page', () => {
      cy.get('h1, h2').contains(/schedule|scheduling/i).should('be.visible');
    });

    it('should display calendar view', () => {
      cy.get('[data-testid="calendar"], .calendar').should('exist');
    });

    it('should display week view', () => {
      cy.get('button').contains(/week/i).click();
      cy.get('[data-testid="week-view"]').should('be.visible');
    });

    it('should display day view', () => {
      cy.get('button').contains(/day/i).click();
      cy.get('[data-testid="day-view"]').should('be.visible');
    });

    it('should display list view', () => {
      cy.get('button').contains(/list/i).click();
      cy.get('[data-testid="list-view"]').should('be.visible');
    });
  });

  describe('Shifts', () => {
    it('should create new shift', () => {
      cy.get('button').contains(/add shift|new shift/i).click();
      cy.get('[data-testid="shift-form"]').should('be.visible');
      
      cy.get('select[name="staffId"]').should('exist');
      cy.get('input[name="startTime"]').should('exist');
      cy.get('input[name="endTime"]').should('exist');
      
      cy.get('button').contains(/save|create/i).click();
      cy.contains(/success|created/i).should('be.visible');
    });

    it('should edit existing shift', () => {
      cy.get('[data-testid="shift"]').first().click();
      cy.get('button').contains(/edit/i).click();
      cy.get('input[name="startTime"]').clear().type('10:00');
      cy.get('button').contains(/save/i).click();
    });

    it('should delete shift', () => {
      cy.get('[data-testid="shift"]').first().click();
      cy.get('button').contains(/delete|remove/i).click();
      cy.contains(/confirm/i).should('be.visible');
    });

    it('should drag and drop shift', () => {
      // Drag and drop test would require special setup
    });
  });

  describe('Publishing', () => {
    it('should publish schedule', () => {
      cy.get('button').contains(/publish/i).click();
      cy.contains(/confirm|are you sure/i).should('be.visible');
      cy.get('button').contains(/publish|confirm/i).click();
      cy.contains(/published/i).should('be.visible');
    });

    it('should show unpublished changes indicator', () => {
      cy.contains(/unpublished|draft/i).should('exist');
    });
  });

  describe('Templates', () => {
    it('should display shift templates', () => {
      cy.get('button').contains(/templates/i).click();
      cy.get('[data-testid="templates"]').should('exist');
    });

    it('should create shift template', () => {
      cy.get('button').contains(/templates/i).click();
      cy.get('button').contains(/new template|add template/i).click();
      cy.get('input[name="name"]').clear().type('Morning Shift');
      cy.get('input[name="startTime"]').clear().type('06:00');
      cy.get('input[name="endTime"]').clear().type('14:00');
      cy.get('button').contains(/save/i).click();
    });
  });

  describe('Conflict Detection', () => {
    it('should show conflict warning for overlapping shifts', () => {
      cy.get('button').contains(/add shift/i).click();
      // Add shift that overlaps with existing
      cy.contains(/conflict|overlap|warning/i).should('exist');
    });
  });
});
