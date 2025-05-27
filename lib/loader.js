'use strict';

const path = require('node:path');
const fsp = require('node:fs/promises');
const vm = require('node:vm');
const errors = require('./errors.js');

const isServiceLoadable = (definition, context) => definition.method !== undefined && context.PASS !== undefined;

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
  if (filePath.endsWith('init.js')) return void (await result());
  for (const [method, definition] of Object.entries(result)) {
    if (isServiceLoadable(definition, context)) result[method] = loadService(definition, context);
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

const readLayers = (applicationPath) =>
  fsp
    .readFile(path.join(applicationPath, '.layers'), 'utf8')
    .then((data) => data.split(/[\r\n\s]+/).filter((s) => s.length !== 0));

const loadApplication = async (sandbox = {}, options) => {
  const applicationPath = options?.path ?? path.join(__dirname, 'application');
  Object.assign(sandbox, errors);
  const context = vm.createContext(sandbox);
  const load = loadDir.bind(undefined, context, context);
  const layers = await readLayers(applicationPath);
  for (const layer of layers) await load(path.join(applicationPath, layer));
  return sandbox;
};

const createHandler = (definition) => {
  const schema = { query: definition.query, body: definition.body };
  return async ({ query, body, ...rest }) => {
    validateRequest(schema, { query, body });
    const response = await definition.handler({ query, body, ...rest });
    if (typeof definition.response === 'function') return definition.response(response);
    if (definition.response === undefined) return response;
    return definition.response;
  };
};

const createRouter = (apis) => {
  const router = {};
  for (const api of apis) {
    for (const [path, methods] of Object.entries(api)) {
      router[path] ??= {};
      for (const [method, definition] of Object.entries(methods)) {
        const handler = createHandler(definition);
        router[path][method] = handler;
      }
    }
  }
  return router;
};

const loadRestApplication = async (sandbox = {}, options) => {
  await loadApplication(sandbox, options);
  const apis = Object.values(sandbox.api);
  const router = createRouter(apis);
  return router;
};

module.exports = { loadFile, loadDir, loadApplication, loadRestApplication };
