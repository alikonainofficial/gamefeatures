const path = require('path');

module.exports = function (options) {
  return {
    ...options,
    resolve: {
      ...options.resolve,
      alias: {
        '@game-review/shared': path.resolve(__dirname, '../../libs/shared/src'),
        '@game-review/database': path.resolve(__dirname, '../../libs/database/src'),
        '@game-review/redis': path.resolve(__dirname, '../../libs/redis/src'),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
          },
          exclude: /node_modules/,
        },
      ],
    },
  };
};
