'use strict';

const isService = (definition, context) =>
  definition?.method !== undefined && context.PASS !== undefined;

const loadService = (definition, context) => {
  const { description, method, expectedErrors } = definition;
  const logger = context.logger ?? context.console ?? { info: () => {} };
  return async (...args) => {
    const interpolatedDesc =
      typeof description === 'function' ? description(...args) : description;
    try {
      logger.info(interpolatedDesc);
      return await method(...args);
    } catch (error) {
      let domainError = expectedErrors?.[error.code];
      if (domainError === context.PASS) throw error;
      if (domainError === undefined) {
        domainError =
          description !== undefined
            ? context.UnexpectedError.from(interpolatedDesc)
            : new context.UnexpectedError();
      }
      domainError.cause = error;
      throw domainError;
    }
  };
};

module.exports = { isService, loadService };
