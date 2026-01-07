'use strict';

const { builtinModules } = require('node:module');

const loadNpm = () => {
  const { dependencies } = require(process.cwd() + '/package.json');
  if (dependencies === undefined) return {};
  const modules = Object.keys(dependencies);
  return Object.fromEntries(modules.map((module) => [module, require(module)]));
};

const loadInternals = () => Object.fromEntries(builtinModules.map((name) => [name, require(`node:${name}`)]));

const loadModules = () => ({
  npm: loadNpm(),
  node: loadInternals(),
});

module.exports = { loadModules };
