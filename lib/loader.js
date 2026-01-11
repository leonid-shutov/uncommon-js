'use strict';

const path = require('node:path');
const fsp = require('node:fs/promises');
const { isServiceEntry, loadServiceEntry } = require('./service.js');
const { runInContext } = require('./vm.js');
const { loadGetterFile, loadGetterEntry, isGetterEntry } = require('./getter.js');

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
  const files = [];
  const directories = [];
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) files.push(entry);
    else directories.push(entry);
  }

  for (const { name } of files) {
    if (!name.endsWith('.js')) continue;
    const location = path.join(dirPath, name);
    let basename = path.basename(name, '.js');
    basename = removeIndex(basename);
    if (key === 'getters') await loadGetterFile(context, container, location, basename);
    else if (basename === key) await loadFile(context, container, location, key);
    else await loadFile(context, nextContainer, location, basename);
  }

  for (let { name } of directories) {
    const location = path.join(dirPath, name);
    name = removeIndex(name);
    if (name === 'methods') await loadDir(context, container, location, key);
    else await loadDir(context, nextContainer, location, name);
  }
};

module.exports = { loadFile, loadDir };
