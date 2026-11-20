import { webFrame } from 'electron'

// ============================================================================
// Cloudflare Stealth & Anti-Bot Shims (Injected into Main World of Challenge Window)
// ============================================================================
try {
  webFrame
    .executeJavaScript(
      `
    try {
      const w = window;
      const n = navigator;

      // 1. Bypass TrustedTypes/TrustedHTML requirement
      if (w.trustedTypes && w.trustedTypes.createPolicy) {
        if (!w.trustedTypes.defaultPolicy) {
          w.trustedTypes.createPolicy('default', {
            createHTML: s => s,
            createScript: s => s,
            createScriptURL: s => s
          });
        }
      }

      // 2. Hide automation (Must be false, not undefined, to match retail browsers)
      Object.defineProperty(n, 'webdriver', { get: () => false });

      // 3. Mimic retail Chrome UserAgentData dynamically based on the actual engine version
      if (n.userAgentData) {
        const match = n.userAgent.match(/Chrome\\/([0-9]+)\\./);
        const version = match ? match[1] : '120';

        Object.defineProperty(n, 'userAgentData', {
          get: () => ({
            brands: [
              { brand: 'Google Chrome', version: version },
              { brand: 'Chromium', version: version },
              { brand: 'Not:A-Brand', version: '24' }
            ],
            mobile: false,
            platform: 'Windows'
          })
        });
      }

      // 4. Mimic languages, vendor, and platform
      Object.defineProperty(n, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(n, 'vendor', { get: () => 'Google Inc.' });
      Object.defineProperty(n, 'platform', { get: () => 'Win32' });

      // 5. Mimic hardware specs
      Object.defineProperty(n, 'deviceMemory', { get: () => 8 });
      Object.defineProperty(n, 'hardwareConcurrency', { get: () => 8 });

      // 6. Shim chrome object
      w.chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
        app: {}
      };

      // 7. Shim plugins
      const mockPlugins = [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' },
        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer' },
        { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer' },
        { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer' }
      ];
      Object.defineProperty(n, 'plugins', { get: () => mockPlugins });
      Object.defineProperty(n, 'mimeTypes', { get: () => ({ length: 0 }) });

      // 8. Ensure window dimensions look realistic
      if (w.outerWidth === 0) w.outerWidth = w.innerWidth || 1024;
      if (w.outerHeight === 0) w.outerHeight = w.innerHeight || 768;

      // 9. Shim Notification permissions
      if (n.permissions && n.permissions.query) {
        const originalQuery = n.permissions.query;
        n.permissions.query = function (parameters) {
          return parameters && parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery.call(this, parameters);
        };
      }

      // 10. Inject TrustedTypes policy into dynamically created iframes (about:srcdoc)
      const originalSetAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function(name, value) {
        if (this.tagName === 'IFRAME' && name === 'srcdoc') {
          const injection = '<script>if(window.trustedTypes && window.trustedTypes.createPolicy && !window.trustedTypes.defaultPolicy) { window.trustedTypes.createPolicy("default", { createHTML: s => s, createScript: s => s, createScriptURL: s => s }); }<\\/script>';
          value = injection + value;
        }
        return originalSetAttribute.call(this, name, value);
      };
    } catch (e) {
      console.error('[CF-Stealth] Injection failed:', e);
    }
  `
    )
    .catch((err) => {
      console.error('[CF-Stealth] executeJavaScript failed:', err)
    })
} catch (e) {
  console.error('[CF-Stealth] Preload failed:', e)
}
