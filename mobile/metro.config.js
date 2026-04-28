const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Let Metro know to watch the root src directory for shared logic
config.watchFolders = [workspaceRoot];

// Ensure Metro can find node_modules in both current and root directory if needed
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Resolve path aliases to shared code in the root workspace
config.resolver.alias = {
  '@renderer': path.resolve(workspaceRoot, 'src/renderer/src'),
  '@common': path.resolve(workspaceRoot, 'src/common'),
};

module.exports = withNativeWind(config, { 
  input: './global.css',
  projectRoot: projectRoot 
});
