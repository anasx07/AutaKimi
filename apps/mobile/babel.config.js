process.env.EXPO_PROJECT_ROOT = process.env.EXPO_PROJECT_ROOT || __dirname;
process.env.EXPO_ROUTER_APP_ROOT = process.env.EXPO_ROUTER_APP_ROOT || './app';

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind', routerRoot: './app' }],
      'nativewind/babel',
    ],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};
