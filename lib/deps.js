'use strict';

const { builtinModules } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Replaces itself with the loaded value on first read, so a module is required when the
// application first touches it rather than before the tree starts loading.
const defineLazy = (target, name, load) => {
  Object.defineProperty(target, name, {
    configurable: true,
    enumerable: true,
    get() {
      const value = load();
      Object.defineProperty(target, name, { value, configurable: true, enumerable: true, writable: true });
      return value;
    },
  });
};

// Resolved against the application, not this library, so a linked checkout still sees its packages.
// null when only an `import` condition exists, which `require.resolve` does not consult; such a
// package is then imported by name, which resolves from this library's location instead.
const resolve = (name, rootDir) => {
  try {
    return require.resolve(name, { paths: [rootDir] });
  } catch {
    return null;
  }
};

const packageType = (file) => {
  for (let dir = path.dirname(file); ; dir = path.dirname(dir)) {
    const manifest = path.join(dir, 'package.json');
    if (fs.existsSync(manifest)) return JSON.parse(fs.readFileSync(manifest, 'utf8')).type;
    if (path.dirname(dir) === dir) return null;
  }
};

// Only CommonJS can be loaded from a getter: require() of ESM throws on top-level await (and
// before Node 20.19, on any ESM), while import() is async.
const isCommonJs = (file) => {
  if (file.endsWith('.cjs')) return true;
  if (file.endsWith('.mjs')) return false;
  return packageType(file) !== 'module';
};

const importEager = async (name, file) => {
  if (file !== null) {
    try {
      return require(file);
    } catch {
      // ESM with top-level await: fall through to import()
    }
  }
  const mod = await import(file === null ? name : pathToFileURL(file).href);
  return mod.default ?? mod;
};

// CommonJS packages load on first use; ESM ones are imported up front, since a getter cannot wait.
const loadNpm = async (rootDir) => {
  const { dependencies } = require(path.join(rootDir, 'package.json'));
  const npm = {};
  if (dependencies === undefined) return npm;
  const eager = [];
  for (const name of Object.keys(dependencies)) {
    const file = resolve(name, rootDir);
    if (file !== null && isCommonJs(file)) defineLazy(npm, name, () => require(file));
    else eager.push(importEager(name, file).then((mod) => void (npm[name] = mod)));
  }
  await Promise.all(eager);
  return npm;
};

// Lazy, so deprecated and experimental builtins (`sys`, `_tls_common`, `wasi`) warn only if used.
const loadInternals = () => {
  const node = {};
  for (const name of builtinModules) {
    defineLazy(node, name, () => {
      try {
        return require(`node:${name}`);
      } catch {
        return null;
      }
    });
  }
  return node;
};

const loadModules = async (rootDir = process.cwd()) => ({
  npm: await loadNpm(path.resolve(rootDir)),
  node: loadInternals(),
});

module.exports = { loadModules };
