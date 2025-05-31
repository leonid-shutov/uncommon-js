'use strict';

const { loadApplication } = require('./loader');

const createHandler = (definition) => {
  const schema = { query: definition.query, body: definition.body };
  return async ({ path, query, body, ...rest }) => {
    validateRequest(schema, { query, body });
    const response = await definition.handler({ path, query, body, ...rest });
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

module.exports = { loadRestApplication };
