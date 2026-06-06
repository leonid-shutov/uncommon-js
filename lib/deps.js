'use strict';

const { builtinModules } = require('node:module');
const path = require('node:path');

const safeRequire = async (name) => {
  try {
    return require(name);
  } catch {
    const mod = await import(name);
    return mod.default ?? mod;
  }
};

const loadNpm = async (rootDir) => {
  const packageJsonPath = path.join(rootDir ?? process.cwd(), 'package.json');
  const { dependencies } = require(packageJsonPath);
  if (dependencies === undefined) return {};
  const modules = Object.keys(dependencies);
  const promises = modules.map(async (name) => [name, await safeRequire(name)]);
  const entries = await Promise.all(promises);
  return Object.fromEntries(entries);
};

const loadInternals = () =>
  Object.fromEntries(
    builtinModules.map((name) => {
      try {
        return [name, require(`node:${name}`)];
      } catch {
        return [];
      }
    }),
  );

const loadModules = async (rootDir) => ({
  npm: await loadNpm(rootDir),
  node: loadInternals(),
});

module.exports = { loadModules };
