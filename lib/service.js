'use strict';

const isService = (definition) => definition?.method !== undefined;

const loadService = (definition, context) => {
  const { description, method } = definition;
  const logger = context.logger ?? context.console ?? { info: () => {} };
  return (...args) => {
    const interpolatedDesc = typeof description === 'function' ? description(...args) : description;
    logger.info(interpolatedDesc);

    const handleError = (error) => {
      const { description, expectedErrors } = definition;
      let domainError = expectedErrors?.[error.code];
      if (domainError === context.PASS) throw error;
      if (domainError === undefined) {
        domainError =
          description !== undefined ? context.UnexpectedError.from(interpolatedDesc) : new context.UnexpectedError();
      }
      domainError.cause = error;
      throw domainError;
    };

    let result;

    try {
      result = method(...args);
    } catch (error) {
      handleError(error);
    }

    if (typeof result?.then === 'function') {
      return result.catch((error) => handleError(error));
    }

    return result;
  };
};

module.exports = { isService, loadService };
