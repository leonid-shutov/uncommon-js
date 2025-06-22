'use strict';

const { builtinModules } = require('node:module');

const loadNpm = async () => {
  const { dependencies } = require(process.cwd() + '/package.json');
  if (dependencies === undefined) return {};
  const modules = Object.keys(dependencies);
  return Object.fromEntries(modules.map((module) => [module, require(module)]));
};

const loadModules = async () => {
  const npm = await loadNpm();
  return {
    npm,
    node: builtinModules,
  };
};

module.exports = { loadModules };
