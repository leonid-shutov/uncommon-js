'use strict';

const path = require('node:path');
const { runInContext } = require('./vm.js');
const { loadGetter } = require('./getter.js');
const { readdirSorted, safeAssign, removeIndex } = require('./util.js');

const ReservedDirs = {
  Common: '(common)',
  Getters: '(getters)',
};

const DirTypes = {
  Common: 'common',
  Getters: 'getters',
  Module: 'module',
  Group: 'group',
};

// The common/ directory must be loaded first, because everything else may depend on it
// The order of the remaining directories doesn't matter as they only contain functions
const order = [ReservedDirs.Common];

const loadFile = async (context, container, filePath, key) => {
  key ??= path.basename(filePath, '.js');

  const result = await runInContext(filePath, context);
  if (result === undefined) return;

  if (container[key] === undefined) container[key] = result;
  else safeAssign(container[key], result);
};

const classifyDir = (name) => {
  if (name === ReservedDirs.Common) return DirTypes.Common;
  else if (name === ReservedDirs.Getters) return DirTypes.Getters;
  else if (name.startsWith('(') && name.endsWith(')')) return DirTypes.Group;
  else return DirTypes.Module;
};

const createModule = (parentContext, parentContainer, key) => {
  const container = parentContainer[key] ?? {};
  parentContainer[key] = container;

  const context = Object.create(parentContext);
  // `self` is the module itself, writes through `self` land on the module
  context.self = container;
  return { context, container };
};

// Where a directory's entries load: the context its files run in and the container their
// exports land on. Only a module has its own; (common)/ loads into the scope it is in, and any
// other (x)/ into its parent, as if it weren't there
const targetOf = (dirType, key, parentContext, parentContainer) => {
  if (dirType === DirTypes.Module) return createModule(parentContext, parentContainer, key);
  if (dirType === DirTypes.Common) return { context: parentContext, container: parentContext };
  return { context: parentContext, container: parentContainer };
};

const loadDir = async (parentContext, parentContainer, dirPath, key) => {
  key ??= removeIndex(path.basename(dirPath));
  const dirType = classifyDir(key);
  const { context, container } = targetOf(dirType, key, parentContext, parentContainer);

  const files = [];
  const directories = [];
  const entries = await readdirSorted(dirPath, { withFileTypes: true, order });
  for (const entry of entries) {
    if (entry.isFile()) files.push(entry);
    else directories.push(entry);
  }

  const getLocation = (name) => path.join(dirPath, name);

  for (const { name } of directories) {
    await loadDir(context, container, getLocation(name), removeIndex(name));
  }

  for (const { name } of files) {
    if (!name.endsWith('.js')) continue;
    const location = getLocation(name);
    const basename = removeIndex(path.basename(name, '.js'));

    // Files in getters/ define public getters on the module
    if (dirType === DirTypes.Getters) await loadGetter(context, container, location, basename);
    // A file named after its own module represents the module itself, merge its entries into the module
    else if (basename === key) await loadFile(context, parentContainer, location, key);
    else await loadFile(context, container, location, basename);
  }
};

module.exports = { loadFile, loadDir };
