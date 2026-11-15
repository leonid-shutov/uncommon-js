'use strict';

const path = require('node:path');
const vm = require('node:vm');
const { loadModules } = require('./deps.js');
const { loadDir, loadFile } = require('./loader.js');
const { readdirSorted } = require('./util.js');

const loader = (context, treePath) => async (entry) => {
  const layer = path.join(treePath, entry.name);
  if (!entry.isFile()) await loadDir(context, context, layer);
  else if (entry.name.endsWith('.js')) await loadFile(context, context, layer);
};

// A raw ENOENT names a path, not the options it came from
const readTree = async (treePath) => {
  try {
    return await readdirSorted(treePath, { withFileTypes: true });
  } catch (cause) {
    throw new Error(`Cannot read the tree at ${treePath}: set rootDir, or treePath relative to it`, { cause });
  }
};

const loadTree = async (sandbox = {}, options) => {
  const __rootDir = path.resolve(options?.rootDir ?? process.cwd());
  const treePath = path.join(__rootDir, options?.treePath ?? 'src');
  const promises = [loadModules(__rootDir), readTree(treePath)];
  const [modules, layers] = await Promise.all(promises);
  Object.assign(sandbox, modules, { __rootDir });
  const context = vm.createContext(sandbox);
  const load = loader(context, treePath);
  for (const entry of layers) await load(entry);
  return sandbox;
};

module.exports = { loadTree };
