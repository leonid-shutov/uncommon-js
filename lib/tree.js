'use strict';

const path = require('node:path');
const vm = require('node:vm');
const { loadModules } = require('./deps.js');
const { loadDir, loadFile } = require('./loader.js');
const { readdirSorted } = require('./util.js');

const loader = (context) => (layer) => {
  if (layer.endsWith('.js')) return loadFile(context, context, layer);
  else return loadDir(context, context, layer);
};

const loadTree = async (sandbox = {}, options) => {
  const __rootDir = options?.rootDir ?? process.cwd();
  const treePath = path.join(__rootDir, options?.treePath ?? 'src');
  const promises = [loadModules(__rootDir), readdirSorted(treePath)];
  const [modules, layers] = await Promise.all(promises);
  Object.assign(sandbox, modules, { __rootDir });
  const context = vm.createContext(sandbox);
  const load = loader(context);
  for (const layer of layers) await load(path.join(treePath, layer));
  return sandbox;
};

module.exports = { loadTree };
