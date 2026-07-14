'use strict';

const path = require('node:path');
const { isServiceEntry, loadServiceEntry } = require('./service.js');
const { runInContext } = require('./vm.js');
const { loadGetter } = require('./getter.js');
const { readdirSorted, safeAssign, removeIndex, isObjectLiteral } = require('./util.js');

const COMMON = 'common';
const GETTERS = 'getters';
const METHODS = 'methods';
const PUBLIC = 'public';
const PRIVATE = 'private';

// The common/ directory must be loaded first, because everything else may depend on it
// The order of the remaining directories doesn't matter as they only contain functions
const order = [COMMON];

const loadEntry = (context, container, entry) => {
  if (isServiceEntry(entry)) loadServiceEntry(context, container, entry);
};

const loadFile = async (context, container, filePath, key) => {
  key ??= path.basename(filePath, '.js');

  // clone sanbox to clone self later
  const sandbox = Object.create(context);

  const { result, src } = await runInContext(filePath, sandbox);
  if (result === undefined) return;

  for (const entry of Object.entries(result)) loadEntry(sandbox, result, entry);

  if (container[key] === undefined) container[key] = result;
  else safeAssign(container[key], result);

  // objects should have their own entries in self; functions should use module's self
  if (isObjectLiteral(src)) {
    sandbox.self = Object.create(context.self ?? {});
    safeAssign(sandbox.self, container[key]);
  }
};

const loadDir = async (parentContext, parentContainer, dirPath, key) => {
  key ??= removeIndex(dirPath.split('/').at(-1));

  const container = parentContainer[key] ?? {};
  parentContainer[key] = container;

  const context = Object.create(parentContext);
  context.self = Object.create(container);

  const files = [];
  const directories = [];
  const entries = await readdirSorted(dirPath, { withFileTypes: true, order });
  for (const entry of entries) {
    if (entry.isFile()) files.push(entry);
    else directories.push(entry);
  }

  const getLocation = (name) => path.join(dirPath, name);

  for (let { name } of directories) {
    const location = getLocation(name);
    name = removeIndex(name);

    // Subdirectories of common/ are shared, load them into the module's context
    if (key === COMMON) await loadDir(parentContext, parentContext, location, name);
    // Any other directory becomes a nested property of the module
    else await loadDir(context, container, location, name);
  }

  for (const { name } of files) {
    if (!name.endsWith('.js')) continue;
    const location = getLocation(name);
    const basename = removeIndex(path.basename(name, '.js'));

    // Files in common/ are shared, load them into the module's context
    if (key === COMMON) await loadFile(parentContext, parentContext, location, basename);
    // Files in getters/ define public getters on the module, load them into the module itself
    else if (key === GETTERS) await loadGetter(parentContext, parentContainer, location, basename);
    // Files in methods/ and public/ expose the module's public API, load them into the module itself
    else if (key === METHODS || key === PUBLIC) await loadFile(parentContext, parentContainer, location, basename);
    // The private/ directory is only visible inside the module, load files into module's `self`
    else if (key === PRIVATE) await loadFile(parentContext, parentContext.self, location, basename);
    // A file named after its own module represents the module itself, merge its entries into the module
    else if (basename === key) await loadFile(context, parentContainer, location, key);
    // Any other file becomes a nested property of the module
    else await loadFile(context, container, location, basename);
  }
};

module.exports = { loadFile, loadDir };
