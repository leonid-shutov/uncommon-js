'use strict';

const path = require('node:path');
const vm = require('node:vm');
const errors = require('./errors.js');
const { loadModules } = require('./deps.js');
const { loadDir, loadFile } = require('./loader.js');
const { readdirSorted } = require('./util.js');

const loader = (context) => (layer) => {
  if (layer.endsWith('.js')) return loadFile(context, context, layer);
  else return loadDir(context, context, layer);
};

const loadApplication = async (sandbox = {}, options) => {
  Object.assign(sandbox, errors);
  const rootDir = options?.rootDir ?? process.cwd();
  Object.assign(sandbox, { __rootDir: rootDir });
  const applicationPath = path.join(rootDir, 'application');
  const promises = [loadModules(options?.rootDir), readdirSorted(applicationPath)];
  const [modules, layers] = await Promise.all(promises);
  Object.assign(sandbox, modules);
  const context = vm.createContext(sandbox);
  const load = loader(context);
  for (const layer of layers) await load(path.join(applicationPath, layer));
  Object.assign(sandbox, { application: sandbox });
  return sandbox;
};

module.exports = { loadApplication };
