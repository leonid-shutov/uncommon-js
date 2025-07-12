'use strict';

const { Schema } = require('metaschema');

const {
  NotFoundError,
  AlreadyExistsError,
  ConstraintViolationError,
} = require('./errors.js');
const { loadApplication } = require('./application.js');

class ValidationError extends AggregateError {}

const validateRequest = (schema = {}, { query, body }) => {
  const validationErrors = [];
  if (schema.query !== undefined) {
    const { errors } = Schema.from(schema.query).check(query);
    validationErrors.push(...errors);
  }
  if (schema.body !== undefined) {
    const { errors } = Schema.from(schema.body).check(body);
    validationErrors.push(...errors);
  }
  if (validationErrors.length > 0) throw new ValidationError(validationErrors);
};

const getStatus = (error) => {
  if (error instanceof ValidationError) return 400;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof AlreadyExistsError) return 409;
  if (error instanceof ConstraintViolationError) return 422;
  return 500;
};

const bodyFromDefinition = (response, definition) => {
  if (typeof definition.response === 'function') {
    return definition.response(response);
  }
  if (definition.response === undefined) return response;
  return definition.response ?? null;
};

const createHandler = (definition) => {
  const schema = { query: definition.query, body: definition.body };
  return async ({ path, query, body, ...rest }) => {
    try {
      validateRequest(schema, { query, body });
      const response = await definition.handler({ path, query, body, ...rest });
      return {
        status: definition.status ?? 200,
        body: bodyFromDefinition(response, definition),
      };
    } catch (error) {
      console.error(error);
      return {
        status: getStatus(error),
        body: error instanceof ValidationError ? error.errors : error.message,
      };
    }
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
