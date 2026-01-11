'use strict';

const isServiceEntry = (definition) => definition?.method !== undefined;

const generateUnexpectedError = (context, description) => {
  if (context.UnexpectedError === undefined) {
    const errorMessage =
      description === undefined ? 'Unexpected error' : `Unexpected error while ${description.toLowerCase()}`;
    return new Error(errorMessage);
  } else {
    if (description === undefined) return new context.UnexpectedError();
    return context.UnexpectedError.from(description);
  }
};

const loadServiceEntry = (context, container, entry) => {
  const [key, definition] = entry;
  const { description, method } = definition;
  const logger = context.logger ?? context.console ?? { info: () => {} };
  container[key] = (...args) => {
    const interpolatedDesc = typeof description === 'function' ? description(...args) : description;
    logger.info(interpolatedDesc);

    const handleError = (error) => {
      const { expectedErrors } = definition;
      let domainError = expectedErrors?.[error.code];
      if (context.PASS !== undefined && domainError === context.PASS) throw error;
      if (domainError === undefined) domainError = generateUnexpectedError(context, interpolatedDesc);

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

module.exports = { isServiceEntry, loadServiceEntry };
