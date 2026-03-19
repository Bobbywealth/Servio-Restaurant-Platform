/**
 * Timeclock E2E Tests
 * Tests all timeclock functionality including clock in/out, breaks, and history
 */

describe('Timeclock', () => {
  const validCredentials = {
    email: 'demo@servio.com',
    password: 'demo123'
  };

  const validPin = '1234';

  beforeEach(() => {
    cy.login(validCredentials.email, validCredentials.password);
    cy.visit('/dashboard/timeclock');
    cy.url().should('include', '/dashboard/timeclock');
  });

  describe('Timeclock Page Load', () => {
    it('should display timeclock page with all elements', () => {
      cy.get('h1, h2').contains(/timeclock|clock/i).should('be.visible');
    });

    it('should display current shift status', () => {
      cy.get('[data-testid="current-shift"], .current-shift, [class*="shift"]').should('exist');
    });

    it('should display clock in/out buttons', () => {
      cy.get('button').contains(/clock in|clock out|start|end/i).should('exist');
    });

    it('should display staff time entries list', () => {
      cy.get('[data-testid="time-entries"], .time-entries, [class*="entries"]').should('exist');
    });
  });

  describe('Clock In', () => {
    beforeEach(() => {
      cy.visit('/dashboard/timeclock');
    });

    it('should display PIN entry modal when clock in clicked', () => {
      cy.get('button').contains(/clock in|start shift/i).click();
      cy.get('[data-testid="pin-modal"], [role="dialog"]').should('be.visible');
      cy.get('input[type="password"], input[name="pin"]').should('exist');
    });

    it('should successfully clock in with valid PIN', () => {
      cy.get('button').contains(/clock in|start shift/i).click();
      cy.get('input[name="pin"]').clear().type(validPin);
      cy.get('button').contains(/submit|confirm|clock in/i).click();
      
      // Verify clocked in status
      cy.contains(/clocked in|on the clock|working/i).should('be.visible');
    });

    it('should show error for invalid PIN', () => {
      cy.get('button').contains(/clock in/i).click();
      cy.get('input[name="pin"]').clear().type('0000');
      cy.get('button').contains(/submit/i).click();
      cy.contains(/invalid|incorrect|wrong/i).should('be.visible');
    });

    it('should show error for empty PIN', () => {
      cy.get('button').contains(/clock in/i).click();
      cy.get('button').contains(/submit/i).click();
      cy.contains(/required|enter pin|pin/i).should('be.visible');
    });

    it('should display current time after clock in', () => {
      cy.get('button').contains(/clock in/i).click();
      cy.get('input[name="pin"]').clear().type(validPin);
      cy.get('button').contains(/submit/i).click();
      cy.get('[data-testid="current-time"], .current-time, [class*="time"]').should('exist');
    });

    it('should display elapsed time after clock in', () => {
      cy.get('button').contains(/clock in/i).click();
      cy.get('input[name="pin"]').clear().type(validPin);
      cy.get('button').contains(/submit/i).click();
      cy.contains(/\d+:\d{2}|duration|elapsed/i).should('exist');
    });

    it('should select position/role when clocking in', () => {
      cy.get('button').contains(/clock in/i).click();
      cy.get('select[name="position"], select[name="role"]').should('exist');
    });
  });

  describe('Clock Out', () => {
    beforeEach(() => {
      // First clock in
      cy.visit('/dashboard/timeclock');
      cy.get('button').contains(/clock in/i).click();
      cy.get('input[name="pin"]').clear().type(validPin);
      cy.get('button').contains(/submit/i).click();
      cy.wait(1000);
    });

    it('should display clock out button when clocked in', () => {
      cy.get('button').contains(/clock out|end shift/i).should('be.visible');
    });

    it('should clock out successfully', () => {
      cy.get('button').contains(/clock out|end shift/i).click();
      cy.get('input[name="pin"]').clear().type(validPin);
      cy.get('button').contains(/confirm|clock out/i).click();
      
      // Verify clocked out status
      cy.contains(/clocked out|not working|off/i).should('be.visible');
    });

    it('should add optional notes when clocking out', () => {
      cy.get('button').contains(/clock out/i).click();
      cy.get('textarea[name="notes"], input[name="notes"]').type('End of shift');
      cy.get('input[name="pin"]').clear().type(validPin);
      cy.get('button').contains(/confirm/i).click();
    });
  });

  describe('Breaks', () => {
    beforeEach(() => {
      // First clock in
      cy.visit('/dashboard/timeclock');
      cy.get('button').contains(/clock in/i).click();
      cy.get('input[name="pin"]').clear().type(validPin);
      cy.get('button').contains(/submit/i).click();
      cy.wait(1000);
    });

    it('should display start break button when clocked in', () => {
      cy.get('button').contains(/start break|break/i).should('exist');
    });

    it('should start a break', () => {
      cy.get('button').contains(/start break|take break/i).click();
      cy.get('button').contains(/confirm/i).click();
      
      // Verify break started
      cy.contains(/on break|break started/i).should('be.visible');
    });

    it('should display break timer', () => {
      cy.get('button').contains(/start break/i).click();
      cy.get('button').contains(/confirm/i).click();
      cy.contains(/break|\d+:\d{2}/i).should('exist');
    });

    it('should end a break', () => {
      cy.get('button').contains(/start break/i).click();
      cy.get('button').contains(/confirm/i).click();
      cy.wait(500);
      cy.get('button').contains(/end break|back to work/i).click();
      
      // Verify break ended
      cy.contains(/break ended|back to work/i).should('be.visible');
    });

    it('should not allow clock out while on break', () => {
      cy.get('button').contains(/start break/i).click();
      cy.get('button').contains(/confirm/i).click();
      cy.get('button').contains(/clock out/i).should('be.disabled');
    });
  });

  describe('Timeclock History', () => {
    it('should display time entries history', () => {
      cy.get('[data-testid="time-entries"], .time-entries').should('exist');
    });

    it('should display list of past shifts', () => {
      cy.get('[data-testid="entry"], .entry, [class*="entry"]').should('exist');
    });

    it('should display entry details (clock in/out times)', () => {
      cy.get('[data-testid="entry"]').first().within(() => {
        cy.contains(/\d{1,2}:\d{2}|AM|PM/i).should('exist');
      });
    });

    it('should display entry duration', () => {
      cy.get('[data-testid="entry"]').first().within(() => {
        cy.contains(/\d+h \d+m|\d+:\d{2}|hours/i).should('exist');
      });
    });

    it('should display break time', () => {
      cy.get('[data-testid="entry"]').first().within(() => {
        cy.contains(/break/i).should('exist');
      });
    });

    it('should filter entries by date', () => {
      cy.get('input[type="date"], input[name="date"]').should('exist');
    });

    it('should filter entries by staff member', () => {
      cy.get('select[name="userId"], select[name="staff"]').should('exist');
    });

    it('should handle empty history', () => {
      cy.visit('/dashboard/timeclock?user=none');
      cy.contains(/no entries|no shifts|no history/i).should('exist');
    });
  });

  describe('Timeclock Stats', () => {
    it('should display today\'s hours', () => {
      cy.get('[data-testid="stats"], .stats, [class*="stats"]').within(() => {
        cy.contains(/today|hours|total/i).should('exist');
      });
    });

    it('should display weekly hours', () => {
      cy.get('[data-testid="stats"]').within(() => {
        cy.contains(/week/i).should('exist');
      });
    });

    it('should display overtime hours', () => {
      cy.get('[data-testid="stats"]').within(() => {
        cy.contains(/overtime/i).should('exist');
      });
    });
  });

  describe('Manager Override', () => {
    it('should have manager override option', () => {
      cy.get('button').contains(/manager|override/i).should('exist');
    });

    it('should allow manager to clock in another staff', () => {
      cy.get('button').contains(/manager|override/i).click();
      cy.get('select[name="staffId"]').should('exist');
      cy.get('input[name="pin"]').should('exist');
    });

    it('should allow manager to clock out another staff', () => {
      cy.get('button').contains(/manager/i).click();
      cy.get('button').contains(/clock out/i).should('exist');
    });

    it('should require manager authentication', () => {
      cy.get('button').contains(/manager/i).click();
      cy.get('input[name="managerPin"]').should('exist');
    });
  });

  describe('Real-time Updates', () => {
    it('should update clock display in real-time', () => {
      cy.get('[data-testid="current-time"]').should('exist');
      // Time should update every minute
    });

    it('should reflect changes across devices', () => {
      // This would require multi-device testing
    });
  });
});

describe('Staff Clock PWA', () => {
  const validCredentials = {
    email: 'demo@servio.com',
    password: 'demo123'
  };

  it('should display staff clock PWA page', () => {
    cy.visit('/staff/clock');
    cy.get('h1').contains(/clock|time/i).should('be.visible');
  });

  it('should display PIN entry for staff', () => {
    cy.visit('/staff/clock');
    cy.get('input[name="pin"], input[type="password"]').should('exist');
  });

  it('should display large touch-friendly buttons', () => {
    cy.visit('/staff/clock');
    cy.get('button').should('have.css', 'min-height').and('not.eq', '0px');
  });

  it('should display current shift status', () => {
    cy.visit('/staff/clock');
    cy.get('[class*="status"]').should('exist');
  });

  it('should display current time prominently', () => {
    cy.visit('/staff/clock');
    cy.get('[class*="time"]').should('exist');
  });
});

describe('Timeclock Mobile', () => {
  it('should be responsive on mobile', () => {
    cy.viewport(375, 667);
    cy.visit('/dashboard/timeclock');
    cy.get('button').should('be.visible');
  });

  it('should have mobile-friendly PIN pad', () => {
    cy.viewport(375, 667);
    cy.visit('/staff/clock');
    cy.get('[data-testid="pin-pad"], .pin-pad').should('exist');
  });
});
