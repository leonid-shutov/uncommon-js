'use strict';

const init = require('eslint-config-metarhia');

module.exports = [...init, { rules: { 'no-extra-parens': 'off' } }];
