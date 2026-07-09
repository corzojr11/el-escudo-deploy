const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const { DefinePlugin } = require('webpack');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Fix: Replace import.meta with a safe object for web builds
  config.plugins.push(
    new DefinePlugin({
      'import.meta.url': JSON.stringify('http://localhost:8081'),
    })
  );

  // Ensure we are transpiling specific modules that use JSX/TSX
  if (config.module && config.module.rules) {
    config.module.rules.forEach(rule => {
      if (rule.oneOf) {
        rule.oneOf.forEach(oneOf => {
          if (oneOf.use && oneOf.use.loader && oneOf.use.loader.includes('babel-loader')) {
            if (oneOf.include) {
              if (!Array.isArray(oneOf.include)) {
                oneOf.include = [oneOf.include];
              }
              oneOf.include.push(/[\\/]node_modules[\\/](lucide-react-native|expo-linear-gradient|react-native-reanimated)[\\/]/);
            }
          }
        });
      }
    });
  }

  return config;
};
