'use strict';

const fsp = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const { loadModules } = require('./deps.js');
const { loadDir } = require('./loader.js');

// A raw ENOENT names a path, not the options it came from
const checkTree = async (treePath) => {
  try {
    await fsp.access(treePath);
  } catch (cause) {
    throw new Error(`Cannot read the tree at ${treePath}: set rootDir, or treePath relative to it`, { cause });
  }
};

const loadTree = async (sandbox = {}, options) => {
  const __rootDir = path.resolve(options?.rootDir ?? process.cwd());
  const treePath = path.join(__rootDir, options?.treePath ?? 'src');
  const [modules] = await Promise.all([loadModules(__rootDir), checkTree(treePath)]);
  Object.assign(sandbox, modules, { __rootDir });
  const context = vm.createContext(sandbox);
  await loadDir(context, context, treePath, '(src)');
  return sandbox;
};

module.exports = { loadTree };
