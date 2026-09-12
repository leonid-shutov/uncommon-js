'use strict';

const loader = require('./lib/loader.js');
const tree = require('./lib/tree.js');

module.exports = { ...loader, ...tree };
