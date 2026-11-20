const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

process.env.EXPO_PROJECT_ROOT = projectRoot;
process.env.EXPO_ROUTER_APP_ROOT = './app';

const config = getDefaultConfig(projectRoot);

// Let Metro know to watch the root src directory for shared logic
config.watchFolders = [workspaceRoot];

// Ensure Metro can find node_modules in both current and root directory if needed
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Configure extraNodeModules to correctly map @autakimi/sdk and @common to packages/sdk/src
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@autakimi/sdk': path.resolve(workspaceRoot, 'packages/sdk/src'),
  '@common': path.resolve(workspaceRoot, 'packages/sdk/src'),
  '@renderer': path.resolve(workspaceRoot, 'apps/desktop/src/renderer/src'),
};

// Redirect all cheerio imports to the browser-compatible entry
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'cheerio') {
    return {
      filePath: path.resolve(workspaceRoot, 'node_modules/cheerio/dist/browser/index.js'),
      type: 'sourceFile',
    };
  }
  if (moduleName === '@autakimi/sdk' || moduleName === '@common') {
    return {
      filePath: path.resolve(workspaceRoot, 'packages/sdk/src/index.ts'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { 
  input: './global.css',
  projectRoot: projectRoot 
});
