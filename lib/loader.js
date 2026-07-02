'use strict';

const path = require('node:path');
const { isServiceEntry, loadServiceEntry } = require('./service.js');
const { runInContext } = require('./vm.js');
const { loadGetter } = require('./getter.js');
const { readdirSorted, safeAssign, removeIndex } = require('./util.js');

const COMMON = 'common';
const GETTERS = 'getters';
const METHODS = 'methods';
const PUBLIC = 'public';
const PRIVATE = 'private';

// common/ must load first. The order of the rest of the dirs doesn't matter as they contain functions
const order = [COMMON];

const loadEntry = (context, container, entry) => {
  if (isServiceEntry(entry)) loadServiceEntry(context, container, entry);
};

const loadFile = async (context, container, filePath, key) => {
  key ??= path.basename(filePath, '.js');

  const result = await runInContext(filePath, context);
  if (result === undefined) return;

  for (const entry of Object.entries(result)) loadEntry(context, result, entry);

  if (container[key] === undefined) container[key] = result;
  else safeAssign(container[key], result);

  safeAssign(context.self, container[key]);
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

    if (key === COMMON) await loadDir(context, parentContext, location, name);
    else if (name === PRIVATE) await loadDir(context, context, location, 'self');
    else await loadDir(context, container, location, name);
  }

  for (const { name } of files) {
    if (!name.endsWith('.js')) continue;
    const location = getLocation(name);
    const basename = removeIndex(path.basename(name, '.js'));

    if (key === COMMON) await loadFile(parentContext, parentContext, location, basename);
    else if (key === GETTERS) await loadGetter(parentContext, parentContainer, location, basename);
    else if (key === METHODS || key === PUBLIC) await loadFile(parentContext, parentContainer, location, basename);
    else if (basename === key) await loadFile(context, parentContainer, location, key);
    else await loadFile(context, container, location, basename);
  }
};

module.exports = { loadFile, loadDir };
