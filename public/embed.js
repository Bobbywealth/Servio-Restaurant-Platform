/**
 * Servio Restaurant Ordering Embed Script
 * 
 * Usage:
 * <script src="https://servio.solutions/embed.js" 
 *         data-restaurant="your-restaurant-slug"
 *         data-button-text="Order Online"
 *         data-button-color="#ff6b35"
 *         data-button-text-color="#ffffff"
 *         data-button-size="medium"
 *         data-position="bottom-right"
 *         data-radius="8"></script>
 * <div id="servio-order-button"></div>
 */
(function() {
  'use strict';

  // Configuration defaults
  const DEFAULTS = {
    buttonText: 'Order Online',
    buttonColor: '#ff6b35',
    buttonTextColor: '#ffffff',
    buttonSize: 'medium',
    buttonRadius: '8',
    position: 'bottom-right',
    zIndex: '9999'
  };

  // Parse attributes from script tag
  function parseConfig() {
    const script = document.currentScript;
    const config = { ...DEFAULTS };
    
    const attrs = ['restaurant', 'button-text', 'button-color', 'button-text-color', 'button-size', 'position', 'button-radius'];
    
    attrs.forEach(attr => {
      const value = script?.getAttribute(`data-${attr}`);
      if (value) {
        const key = attr.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        config[key] = value;
      }
    });
    
    // Also support camelCase attributes
    const camelAttrs = ['restaurant', 'buttonText', 'buttonColor', 'buttonTextColor', 'buttonSize', 'position', 'buttonRadius'];
    camelAttrs.forEach(attr => {
      const value = script?.getAttribute(`data-${attr}`);
      if (value) {
        config[attr] = value;
      }
    });
    
    return config;
  }

  // Get restaurant slug
  function getRestaurantSlug(config) {
    // First check data-restaurant attribute
    if (config.restaurant) {
      return config.restaurant;
    }
    
    // Fallback: look for the script in a specific location pattern
    const scripts = document.querySelectorAll('script[src*="embed.js"]');
    for (const script of scripts) {
      const src = script.src;
      // Try to extract slug from src if embedded differently
      if (src.includes('embed/')) {
        const match = src.match(/embed\/([^/]+)/);
        if (match) return match[1];
      }
    }
    
    return null;
  }

  // Create button styles
  function createStyles(config) {
    const sizeMap = {
      small: { padding: '8px 16px', fontSize: '14px' },
      medium: { padding: '12px 24px', fontSize: '16px' },
      large: { padding: '16px 32px', fontSize: '18px' }
    };
    
    const size = sizeMap[config.buttonSize] || sizeMap.medium;
    const position = config.position || 'bottom-right';
    
    return `
      #servio-embed-container {
        position: fixed;
        ${position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
        ${position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
        z-index: ${config.zIndex};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      }
      
      #servio-order-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background-color: ${config.buttonColor};
        color: ${config.buttonTextColor};
        border: none;
        border-radius: ${config.buttonRadius}px;
        cursor: pointer;
        font-weight: 600;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
        transition: transform 0.2s, box-shadow 0.2s;
        text-decoration: none;
        ${Object.entries(size).map(([prop, val]) => `${prop}: ${val};`).join(' ')}
      }
      
      #servio-order-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
      }
      
      #servio-order-btn:active {
        transform: translateY(0);
      }
      
      #servio-order-btn svg {
        width: 20px;
        height: 20px;
      }
    `;
  }

  // Initialize the embed
  function init() {
    const config = parseConfig();
    const restaurantSlug = getRestaurantSlug(config);
    
    if (!restaurantSlug) {
      console.error('Servio Embed: Restaurant slug not found. Please add data-restaurant="your-slug" to the script tag.');
      return;
    }
    
    // Create container
    const container = document.createElement('div');
    container.id = 'servio-embed-container';
    
    // Create button
    const button = document.createElement('a');
    button.id = 'servio-order-btn';
    button.href = `https://servio.solutions/r/${restaurantSlug}`;
    button.target = '_blank';
    button.rel = 'noopener noreferrer';
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
      <span>${config.buttonText}</span>
    `;
    
    // Create and inject styles
    const styles = document.createElement('style');
    styles.textContent = createStyles(config);
    document.head.appendChild(styles);
    
    // Append button to container
    container.appendChild(button);
    
    // Either use existing div or append container
    const existingDiv = document.getElementById('servio-order-button');
    if (existingDiv) {
      existingDiv.appendChild(container);
    } else {
      document.body.appendChild(container);
    }
    
    // Track clicks
    button.addEventListener('click', async () => {
      try {
        await fetch(`https://servio.solutions/api/embed/click/${restaurantSlug}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        // Silently fail - tracking is not critical
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
