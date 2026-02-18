import React, { useState, useMemo } from 'react';
import { Link as LinkIcon, Share2, Copy, ExternalLink, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface RestaurantIntegrationProps {
  slug: string;
  themeColors?: {
    primaryColor: string;
  };
}

export function RestaurantIntegration({ slug, themeColors }: RestaurantIntegrationProps) {
  const [embedConfig, setEmbedConfig] = useState({
    buttonText: 'Order Online',
    buttonColor: themeColors?.primaryColor || '#ff6b35',
    buttonTextColor: '#ffffff',
    buttonSize: 'medium' as 'small' | 'medium' | 'large',
    buttonRadius: '8',
    position: 'bottom-right' as 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  });

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://servio.solutions';
  const restaurantSlug = slug || 'your-restaurant';

  const getEmbedCode = useMemo(() => {
    return `<script src="${baseUrl}/embed.js" 
        data-restaurant="${restaurantSlug}"
        data-button-text="${embedConfig.buttonText}"
        data-button-color="${embedConfig.buttonColor}"
        data-button-text-color="${embedConfig.buttonTextColor}"
        data-button-size="${embedConfig.buttonSize}"
        data-button-radius="${embedConfig.buttonRadius}"
        data-position="${embedConfig.position}">
</script>
<div id="servio-order-button"></div>`;
  }, [baseUrl, restaurantSlug, embedConfig]);

  const copyToClipboard = async (text: string, message: string = 'Copied!') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const sizePadding = {
    small: '8px 16px',
    medium: '12px 24px',
    large: '16px 32px'
  };

  const sizeFontSize = {
    small: '14px',
    medium: '16px',
    large: '18px'
  };

  return (
    <div className="space-y-6">
      {/* Direct Link Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <LinkIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Direct Link
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Share this link with customers or add it to your website
            </p>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Your Restaurant URL
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              readOnly
              value={`${baseUrl}/r/${restaurantSlug}`}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
            />
            <button
              onClick={() => copyToClipboard(`${baseUrl}/r/${restaurantSlug}`, 'Link copied!')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span>Copy</span>
            </button>
            <a
              href={`${baseUrl}/r/${restaurantSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open</span>
            </a>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
            How to use this link
          </h4>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li>• Add it as a button on your website header or footer</li>
            <li>• Share it on social media bios (Instagram, Facebook, etc.)</li>
            <li>• Include it in email newsletters to your customers</li>
            <li>• Print it on receipts or menus</li>
          </ul>
        </div>
      </div>

      {/* Embed Button Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Share2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Embedded Button
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Add an "Order Online" button directly to your website
            </p>
          </div>
        </div>

        {/* Customization Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Button Text
            </label>
            <input
              type="text"
              value={embedConfig.buttonText}
              onChange={(e) => setEmbedConfig({ ...embedConfig, buttonText: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Order Online"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Button Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={embedConfig.buttonColor}
                onChange={(e) => setEmbedConfig({ ...embedConfig, buttonColor: e.target.value })}
                className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <input
                type="text"
                value={embedConfig.buttonColor}
                onChange={(e) => setEmbedConfig({ ...embedConfig, buttonColor: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Text Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={embedConfig.buttonTextColor}
                onChange={(e) => setEmbedConfig({ ...embedConfig, buttonTextColor: e.target.value })}
                className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <input
                type="text"
                value={embedConfig.buttonTextColor}
                onChange={(e) => setEmbedConfig({ ...embedConfig, buttonTextColor: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Button Size
            </label>
            <select
              value={embedConfig.buttonSize}
              onChange={(e) => setEmbedConfig({ ...embedConfig, buttonSize: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Border Radius (px)
            </label>
            <input
              type="number"
              value={embedConfig.buttonRadius}
              onChange={(e) => setEmbedConfig({ ...embedConfig, buttonRadius: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              min="0"
              max="50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Position
            </label>
            <select
              value={embedConfig.position}
              onChange={(e) => setEmbedConfig({ ...embedConfig, position: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="top-right">Top Right</option>
              <option value="top-left">Top Left</option>
            </select>
          </div>
        </div>

        {/* Preview */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Button Preview
          </h3>
          <div className="p-8 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
            <button
              className="mx-auto"
              style={{
                backgroundColor: embedConfig.buttonColor,
                color: embedConfig.buttonTextColor,
                padding: sizePadding[embedConfig.buttonSize],
                borderRadius: `${embedConfig.buttonRadius}px`,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: sizeFontSize[embedConfig.buttonSize]
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              {embedConfig.buttonText}
            </button>
          </div>
        </div>

        {/* Embed Code */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Embed Code
            </h3>
            <button
              onClick={() => copyToClipboard(getEmbedCode, 'Code copied!')}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              Copy Code
            </button>
          </div>
          <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-gray-100 font-mono whitespace-pre-wrap break-all">
              {getEmbedCode}
            </pre>
          </div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Paste this code anywhere in your website's HTML (preferably before the closing {'</body>'} tag).
          </p>
        </div>

        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
            Benefits of embedded button
          </h4>
          <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
            <li>• Customers stay on your website while ordering</li>
            <li>• Button appears consistently across all pages</li>
            <li>• Customizable to match your website's design</li>
            <li>• Works with any website platform (WordPress, Wix, Squarespace, etc.)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default RestaurantIntegration;
