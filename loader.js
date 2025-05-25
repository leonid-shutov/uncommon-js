'use strict';

const path = require('node:path');
const fsp = require('node:fs/promises');
const vm = require('node:vm');

const loadService = (definition, context) => {
  const { description, method, expectedErrors } = definition;
  return async (...args) => {
    try {
      return await method(...args);
    } catch (error) {
      let domainError = expectedErrors?.[error.code];
      if (domainError === context.PASS) throw error;
      if (domainError === undefined) {
        domainError =
          description !== undefined ? context.UnexpectedError.from(description) : new context.UnexpectedError();
      }
      domainError.cause = error;
      throw domainError;
    }
  };
};

const loadFile = async (context, container, filePath, key) => {
  const src = await fsp.readFile(filePath, 'utf8');
  const code = `'use strict';\n${src}`;
  const script = new vm.Script(code);
  const result = script.runInContext(context);
  if (filePath.endsWith('init.js')) {
    await result();
    return;
  }
  for (const [method, definition] of Object.entries(result)) {
    if (definition.method !== undefined) result[method] = loadService(definition, context);
  }
  container[key] = result;
};

const loadDir = async (context, container, dirPath, key) => {
  key ??= dirPath.split('/').at(-1);
  let nextContainer = { ...container[key] };
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
    const basename = path.basename(name, '.js');
    await loadFile(context, nextContainer, location, basename);
  }

  for (const { name } of directories) {
    const location = path.join(dirPath, name);
    if (name === '>') await loadDir(context, container, location, key);
    else await loadDir(context, nextContainer, location, name);
  }
};

module.exports = { loadFile, loadDir };
