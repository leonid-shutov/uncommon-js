'use strict';

const init = require('eslint-config-metarhia');

module.exports = [
  ...init,
  {
    files: ['lib/**/*.js', 'test/**/*.js'],
    rules: {
      strict: 'off',
      'max-len': ['error', { code: 120, ignoreUrls: true }],
      'no-nested-ternary': 'off',
      camelcase: 'off',
      curly: 'off',
    },
    languageOptions: {
      globals: {
        self: true,
        $: true,
      },
    },
  },
];
