'use strict';

const path = require('node:path');
const fsp = require('node:fs/promises');
const { isServiceEntry, loadServiceEntry } = require('./service.js');
const { runInContext } = require('./vm.js');
const { loadGetterFile, loadGetterEntry, isGetterEntry } = require('./getter.js');

const COMMON = 'common';
const GETTERS = 'getters';
const METHODS = 'methods';

const removeIndex = (key) => key.replace(/^\d+-/, '');

const loadEntry = (context, container, entry) => {
  const [key, definition] = entry;
  if (isServiceEntry(definition)) loadServiceEntry(context, container, entry);
  else if (isGetterEntry(key)) loadGetterEntry(container, entry);
};

const loadFile = async (context, container, filePath, key) => {
  key ??= path.basename(filePath, '.js');

  const sandbox = { ...context, $: container };
  const result = await runInContext(filePath, sandbox);

  if (result === undefined) return;

  for (const entry of Object.entries(result)) loadEntry(context, result, entry);

  if (container[key] === undefined) container[key] = result;
  else Object.defineProperties(container[key], Object.getOwnPropertyDescriptors(result));
  sandbox.self = container[key];
};

const loadDir = async (context, container, dirPath, key) => {
  key ??= removeIndex(dirPath.split('/').at(-1));
  const nextContainer = container[key] ?? {};
  container[key] = nextContainer;
  let commonDir = null;
  const files = [];
  const directories = [];
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) files.push(entry);
    else if (entry.name === COMMON) commonDir = entry;
    else directories.push(entry);
  }

  const getLocation = (name) => path.join(dirPath, name);

  if (commonDir !== null) {
    context = { ...context };
    await loadDir(context, nextContainer, getLocation(COMMON), COMMON);
  }

  for (const { name } of files) {
    if (!name.endsWith('.js')) continue;
    const location = getLocation(name);
    let basename = path.basename(name, '.js');
    basename = removeIndex(basename);
    if (key === COMMON) await loadFile(context, context, location, basename);
    else if (key === GETTERS) await loadGetterFile(context, container, location, basename);
    else if (basename === key) await loadFile(context, container, location, key);
    else await loadFile(context, nextContainer, location, basename);
  }

  for (let { name } of directories) {
    const location = getLocation(name);
    name = removeIndex(name);
    if (key === COMMON) await loadDir(context, context, location, name);
    else if (name === METHODS) await loadDir(context, container, location, key);
    else await loadDir(context, nextContainer, location, name);
  }
};

module.exports = { loadFile, loadDir };
