const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const projectRoot = __dirname;
const workspaceRoot = projectRoot;

const config = getDefaultConfig(projectRoot);

// Let Metro know to watch the entire workspace
config.watchFolders = [workspaceRoot];

// Ensure Metro resolves packages correctly in the monorepo structure
module.exports = withNativeWind(config, { 
  input: './global.css',
  projectRoot: workspaceRoot 
});
