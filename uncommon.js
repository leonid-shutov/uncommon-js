'use strict';

const { loadFile, loadDir } = require('./lib/loader.js');
const { loadTree } = require('./lib/tree.js');

module.exports = { loadTree, loadFile, loadDir };
