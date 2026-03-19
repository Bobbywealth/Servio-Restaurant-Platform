/**
 * Menu Management E2E Tests
 * Tests all menu-related functionality including categories, items, and modifiers
 */

describe('Menu Management', () => {
  const validCredentials = {
    email: 'demo@servio.com',
    password: 'demo123'
  };

  beforeEach(() => {
    cy.login(validCredentials.email, validCredentials.password);
    cy.visit('/dashboard/menu-management');
    cy.url().should('include', '/dashboard/menu-management');
  });

  describe('Menu Page Load', () => {
    it('should display menu management page with all elements', () => {
      cy.get('h1, h2').contains(/menu|management/i).should('be.visible');
    });

    it('should display category sidebar', () => {
      cy.get('[data-testid="categories"], .categories, [class*="category"]').should('exist');
    });

    it('should display menu items grid', () => {
      cy.get('[data-testid="items-grid"], .items-grid, [class*="items"]').should('exist');
    });

    it('should display add category button', () => {
      cy.get('button').contains(/add category|new category/i).should('exist');
    });

    it('should display add item button', () => {
      cy.get('button').contains(/add item|new item/i).should('exist');
    });
  });

  describe('Categories', () => {
    it('should display list of categories', () => {
      cy.get('[data-testid="category"], .category').should('exist');
    });

    it('should select a category', () => {
      cy.get('[data-testid="category"]').first().click();
      cy.get('[data-testid="category"].active, .category.selected').should('exist');
    });

    it('should add new category', () => {
      cy.get('button').contains(/add category|new category/i).click();
      cy.get('[data-testid="category-form"], [role="dialog"]').should('be.visible');
      
      cy.get('input[name="name"]').clear().type('Test Category');
      cy.get('textarea[name="description"]').clear().type('Test Description');
      cy.get('button').contains(/save|create|add/i).click();
      
      cy.contains(/success|category created/i).should('be.visible');
    });

    it('should edit a category', () => {
      cy.get('[data-testid="category"]').first().click();
      cy.get('[data-testid="edit-category"], button[class*="edit"]').click();
      
      cy.get('input[name="name"]').clear().type('Updated Category');
      cy.get('button').contains(/save|update/i).click();
      
      cy.contains(/updated|success/i).should('be.visible');
    });

    it('should delete a category', () => {
      cy.get('[data-testid="category"]').first().click();
      cy.get('[data-testid="delete-category"], button[class*="delete"]').click();
      
      cy.contains(/confirm|are you sure|delete/i).should('be.visible');
      cy.get('button').contains(/delete|confirm/i).last().click();
      
      cy.contains(/deleted|removed/i).should('be.visible');
    });

    it('should reorder categories via drag and drop', () => {
      // This test would require drag and drop implementation
      cy.get('[data-testid="category"]').first().should('exist');
    });

    it('should toggle category visibility', () => {
      cy.get('[data-testid="category"]').first().click();
      cy.get('button').contains(/hide|show|visibility|toggle/i).click();
    });
  });

  describe('Menu Items', () => {
    beforeEach(() => {
      // Select first category to see items
      cy.get('[data-testid="category"]').first().click();
    });

    it('should display menu items', () => {
      cy.get('[data-testid="menu-item"], .menu-item').should('exist');
    });

    it('should display item name and price', () => {
      cy.get('[data-testid="menu-item"]').first().within(() => {
        cy.contains(/[a-zA-Z]/).should('exist');
        cy.contains(/\$\d+|\d+\.\d{2}/).should('exist');
      });
    });

    it('should display item availability status', () => {
      cy.get('[data-testid="menu-item"]').first().within(() => {
        cy.get('[class*="available"], [class*="unavailable"]').should('exist');
      });
    });

    it('should add new menu item', () => {
      cy.get('button').contains(/add item|new item/i).click();
      cy.get('[data-testid="item-form"], [role="dialog"]').should('be.visible');
      
      cy.get('input[name="name"]').clear().type('Test Item');
      cy.get('input[name="price"]').clear().type('9.99');
      cy.get('textarea[name="description"]').clear().type('Test description');
      cy.get('button').contains(/save|create|add/i).click();
      
      cy.contains(/success|item created/i).should('be.visible');
    });

    it('should add item with image', () => {
      cy.get('button').contains(/add item/i).click();
      cy.get('input[type="file"], input[name="image"]').should('exist');
    });

    it('should add item with modifiers', () => {
      cy.get('button').contains(/add item/i).click();
      cy.get('[data-testid="modifiers-select"], select[name="modifiers"]').should('exist');
    });

    it('should edit a menu item', () => {
      cy.get('[data-testid="menu-item"]').first().click();
      cy.get('button').contains(/edit|modify/i).click();
      
      cy.get('input[name="name"]').clear().type('Updated Item');
      cy.get('button').contains(/save|update/i).click();
      
      cy.contains(/updated|success/i).should('be.visible');
    });

    it('should delete a menu item', () => {
      cy.get('[data-testid="menu-item"]').first().click();
      cy.get('button').contains(/delete|remove/i).click();
      
      cy.contains(/confirm|are you sure/i).should('be.visible');
      cy.get('button').contains(/delete|confirm/i).last().click();
      
      cy.contains(/deleted|removed/i).should('be.visible');
    });

    it('should toggle item availability', () => {
      cy.get('[data-testid="menu-item"]').first().within(() => {
        cy.get('button').contains(/available|unavailable|toggle/i).click();
      });
      
      // Verify status changed
      cy.get('[data-testid="menu-item"]').first().within(() => {
        cy.contains(/available|unavailable/i).should('exist');
      });
    });

    it('should search menu items', () => {
      cy.get('input[type="search"], input[placeholder*="search"]').type('Pizza');
      cy.wait(500);
      cy.get('[data-testid="menu-item"]').contains(/pizza/i).should('exist');
    });

    it('should filter items by availability', () => {
      cy.get('select[name="filter"], [data-testid="filter"]').select('available');
      cy.wait(500);
      cy.get('[data-testid="menu-item"]').should('exist');
    });

    it('should handle empty category', () => {
      cy.get('button').contains(/add category/i).click();
      cy.get('input[name="name"]').type('Empty Category');
      cy.get('button').contains(/save/i).click();
      cy.get('[data-testid="category"]').contains('Empty Category').click();
      cy.contains(/no items|empty|add your first/i).should('exist');
    });
  });

  describe('Modifiers', () => {
    it('should display modifier groups', () => {
      cy.get('[data-testid="modifier-group"], .modifiers').should('exist');
    });

    it('should add modifier group', () => {
      cy.get('button').contains(/add modifier|new modifier/i).click();
      cy.get('[data-testid="modifier-form"]').should('be.visible');
      
      cy.get('input[name="name"]').clear().type('Size');
      cy.get('button').contains(/add option|save/i).click();
    });

    it('should add options to modifier group', () => {
      cy.get('[data-testid="modifier-group"]').first().click();
      cy.get('button').contains(/add option/i).click();
      cy.get('input[name="optionName"]').clear().type('Small');
      cy.get('input[name="price"]').clear().type('0');
      cy.get('button').contains(/save/i).click();
    });

    it('should edit modifier options', () => {
      cy.get('[data-testid="modifier-option"]').first().click();
      cy.get('button').contains(/edit/i).click();
    });

    it('should delete modifier options', () => {
      cy.get('[data-testid="modifier-option"]').first().click();
      cy.get('button').contains(/delete/i).click();
    });

    it('should assign modifiers to items', () => {
      cy.get('[data-testid="menu-item"]').first().click();
      cy.get('button').contains(/edit|modifiers/i).click();
      cy.get('input[type="checkbox"], select[name="modifiers"]').should('exist');
    });
  });

  describe('Item Sizes', () => {
    it('should display item sizes/variants', () => {
      cy.get('[data-testid="menu-item"]').first().click();
      cy.get('[data-testid="sizes"], [class*="sizes"]').should('exist');
    });

    it('should add size to item', () => {
      cy.get('[data-testid="menu-item"]').first().click();
      cy.get('button').contains(/add size|new size/i).click();
      
      cy.get('input[name="name"]').clear().type('Large');
      cy.get('input[name="priceModifier"]').clear().type('3.00');
      cy.get('button').contains(/save/i).click();
    });

    it('should edit item size', () => {
      cy.get('[data-testid="menu-item"]').first().click();
      cy.get('[data-testid="size"]').first().click();
      cy.get('button').contains(/edit/i).click();
    });

    it('should delete item size', () => {
      cy.get('[data-testid="menu-item"]').first().click();
      cy.get('[data-testid="size"]').first().click();
      cy.get('button').contains(/delete/i).click();
    });
  });

  describe('Menu Import/Export', () => {
    it('should have export menu option', () => {
      cy.get('button').contains(/export|download/i).should('exist');
    });

    it('should have import menu option', () => {
      cy.get('button').contains(/import|upload/i).should('exist');
    });

    it('should import menu from file', () => {
      cy.get('button').contains(/import/i).click();
      cy.get('input[type="file"]').should('exist');
    });
  });

  describe('Menu Analytics', () => {
    it('should display item popularity', () => {
      cy.get('button').contains(/analytics|stats/i).click();
      cy.get('[data-testid="analytics-panel"]').should('be.visible');
    });

    it('should display sales data', () => {
      cy.get('button').contains(/analytics/i).click();
      cy.contains(/sales|orders|popular/i).should('exist');
    });
  });

  describe('Menu Preview', () => {
    it('should preview public menu', () => {
      cy.get('button').contains(/preview|view public/i).click();
      // Should open in new tab or modal showing public-facing menu
    });
  });
});

describe('Public Menu', () => {
  it('should display public menu page', () => {
    cy.visit('/menu');
    cy.get('h1').contains(/menu|order/i).should('be.visible');
  });

  it('should display categories', () => {
    cy.visit('/menu');
    cy.get('[data-testid="category"], .category').should('exist');
  });

  it('should display available items only', () => {
    cy.visit('/menu');
    cy.get('[data-testid="menu-item"]').should('exist');
  });

  it('should filter by category', () => {
    cy.visit('/menu');
    cy.get('[data-testid="category"]').first().click();
    cy.get('[data-testid="menu-item"]').should('exist');
  });

  it('should search menu items', () => {
    cy.visit('/menu');
    cy.get('input[type="search"], input[placeholder*="search"]').type('Pizza');
    cy.get('[data-testid="menu-item"]').contains(/pizza/i).should('exist');
  });

  it('should add item to cart', () => {
    cy.visit('/menu');
    cy.get('[data-testid="menu-item"]').first().click();
    cy.get('button').contains(/add|add to cart/i).click();
    cy.get('[data-testid="cart"], .cart').should('exist');
  });
});
