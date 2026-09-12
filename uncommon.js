'use strict';

const loader = require('./lib/loader.js');
const application = require('./lib/application.js');

module.exports = { ...loader, ...application };
