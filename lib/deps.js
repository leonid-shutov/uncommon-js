'use strict';

const { builtinModules } = require('node:module');
const path = require('node:path');

const loadNpm = (rootDir) => {
  const packageJsonPath = path.join(rootDir ?? process.cwd(), 'package.json');
  const { dependencies } = require(packageJsonPath);
  if (dependencies === undefined) return {};
  const modules = Object.keys(dependencies);
  return Object.fromEntries(modules.map((module) => [module, require(module)]));
};

const loadInternals = () => Object.fromEntries(builtinModules.map((name) => [name, require(`node:${name}`)]));

const loadModules = (rootDir) => ({
  npm: loadNpm(rootDir),
  node: loadInternals(),
});

module.exports = { loadModules };
