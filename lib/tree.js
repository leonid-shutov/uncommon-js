'use strict';

const path = require('node:path');
const vm = require('node:vm');
const { loadModules } = require('./deps.js');
const { loadDir } = require('./loader.js');

const loadTree = async (sandbox = {}, options) => {
  const __rootDir = path.resolve(options?.rootDir ?? process.cwd());
  const treePath = path.resolve(__rootDir, options?.treePath ?? 'src');
  const modules = await loadModules(__rootDir);
  Object.assign(sandbox, modules, { __rootDir });
  const context = vm.createContext(sandbox);
  await loadDir(context, context, treePath, '(src)');
  return sandbox;
};

module.exports = { loadTree };
