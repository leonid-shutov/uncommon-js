'use strict';

const loader = require('./lib/loader.js');
const rest = require('./lib/rest.js');
const errors = require('./lib/errors.js');

module.exports = { ...loader, ...rest, ...errors };
