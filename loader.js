'use strict';

const loader = require('./lib/loader.js');
const errors = require('./lib/errors.js');

module.exports = { ...loader, ...errors };
