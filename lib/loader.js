'use strict';

const path = require('node:path');
const fsp = require('node:fs/promises');
const vm = require('node:vm');
const { isService, loadService } = require('./service.js');

const chronology = ['before.js', 'after.js'];
const isChronological = (filePath) =>
  chronology.some((file) => filePath.endsWith(file));
const orderFiles = (files) => {
  const before = files.find(({ name }) => name === 'before.js');
  const after = files.find(({ name }) => name === 'after.js');
  const ordered = files.filter(({ name }) => !chronology.includes(name));
  ordered.sort();
  if (before !== undefined) ordered.unshift(before);
  if (after !== undefined) ordered.push(after);
  return ordered;
};

const removeIndex = (key) => key.replace(/^\d+-/, '');

const loadFile = async (context, container, filePath, key) => {
  const src = await fsp.readFile(filePath, 'utf8');
  const code = `'use strict';\n${src}`;
  const script = new vm.Script(code);
  const sandbox = { ...context };
  const result = await script.runInContext(vm.createContext(sandbox));
  if (isChronological(filePath)) return void (await result());
  for (const [method, definition] of Object.entries(result)) {
    if (isService(definition, context)) {
      result[method] = loadService(definition, context);
    }
  }
  sandbox.self = result;
  if (container[key] === undefined) container[key] = result;
  else Object.assign(container[key], result);
};

const loadDir = async (context, container, dirPath, key) => {
  key ??= dirPath.split('/').at(-1);
  const nextContainer = container[key] ?? {};
  container[key] = nextContainer;
  const files = [];
  const directories = [];
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) files.push(entry);
    else directories.push(entry);
  }

  const orderedFiles = orderFiles(files);
  for (const { name } of orderedFiles) {
    if (!name.endsWith('.js')) continue;
    const location = path.join(dirPath, name);
    let basename = path.basename(name, '.js');
    basename = removeIndex(basename);
    if (basename === key) await loadFile(context, container, location, key);
    else await loadFile(context, nextContainer, location, basename);
  }

  for (const { name } of directories) {
    const location = path.join(dirPath, name);
    if (name === '>') await loadDir(context, container, location, key);
    else await loadDir(context, nextContainer, location, name);
  }
};

module.exports = { loadFile, loadDir };
