'use strict';

const fsp = require('node:fs').promises;
const { builtinModules } = require('node:module');

const loadNpm = async () => {
  const { dependencies } = await fsp.readFile('package.json', 'utf-8').then(JSON.parse);
  if (dependencies === undefined) return {};
  const modules = Object.keys(dependencies);
  return Object.fromEntries(modules.map((module) => [module, require(module)]));
};

const loadModules = async () => {
  const npm = await loadNpm();
  return {
    npm,
    builtinModules,
  };
};

module.exports = { loadModules };
