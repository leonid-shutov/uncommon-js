'use strict';

const loader = require('./lib/loader.js');
const application = require('./lib/application.js');
const errors = require('./lib/errors.js');

module.exports = { ...loader, ...application, ...errors };
