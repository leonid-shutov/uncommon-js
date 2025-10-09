'use strict';

const path = require('node:path');
const fsp = require('node:fs/promises');
const vm = require('node:vm');
const { isService, loadService } = require('./service.js');

const removeIndex = (key) => key.replace(/^\d+-/, '');

const loadFile = async (context, container, filePath, key) => {
  key ??= path.basename(filePath, '.js');
  const src = await fsp.readFile(filePath, 'utf8');
  const code = `'use strict';\n${src}`;
  const script = new vm.Script(code);
  const sandbox = { ...context, module: container };
  const result = await script.runInContext(vm.createContext(sandbox));
  if (result === undefined) return;
  for (const [method, definition] of Object.entries(result)) {
    if (isService(definition, context)) {
      result[method] = loadService(definition, context);
    }
  }
  if (container[key] === undefined) container[key] = result;
  else Object.assign(container[key], result);
  sandbox.self = container[key];
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

  for (const { name } of files) {
    if (!name.endsWith('.js')) continue;
    const location = path.join(dirPath, name);
    let basename = path.basename(name, '.js');
    basename = removeIndex(basename);
    if (basename === key) await loadFile(context, container, location, key);
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
