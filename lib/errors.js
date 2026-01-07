'use strict';

const PASS = Symbol('pass');

class DomainError extends Error {
  constructor(message, options) {
    const { code, ...restOptions } = options;
    super(message, restOptions);
    this.code = code;
    this.name = this.constructor.name;
  }
}

const createDomainError = (className, factoryOptions) =>
  class extends (factoryOptions.parent ?? DomainError) {
    constructor(message, options) {
      message ??= factoryOptions.message;
      const code = options?.code ?? factoryOptions.code;
      super(message, { ...options, code });
      this.name = className;
    }
  };

const UnexpectedError = createDomainError('UnexpectedError', {
  message: 'Unexpected Error',
  code: 'UNEXPECTED_ERROR',
});
UnexpectedError.from = (description) => new UnexpectedError(`Unexpected error while ${description.toLowerCase()}`);

const NotFoundError = createDomainError('NotFoundError', {
  message: 'Not Found',
  code: 'NOT_FOUND',
});

NotFoundError.from = (entity, options) =>
  new NotFoundError(`${entity} not found`, {
    ...options,
    code: options?.code ?? `${entity.toUpperCase()}_NOT_FOUND`,
  });

const AlreadyExistsError = createDomainError('AlreadyExistsError', {
  message: 'Already Exists',
  code: 'ALREADY_EXISTS',
});

AlreadyExistsError.from = (entity, options) =>
  new AlreadyExistsError(`${entity} already exists`, {
    ...options,
    code: options?.code ?? `${entity.toUpperCase()}_ALREADY_EXISTS`,
  });

const ConstraintViolationError = createDomainError('ConstraintViolationError', {
  message: 'Constraint violation',
  code: 'CONSTRAINT_VIOLATION',
});

const AuthorizationError = createDomainError('AuthorizationError', {
  message: 'Authorization Error',
  code: 'AUTHORIZATION_ERROR',
});

module.exports = {
  PASS,
  DomainError,
  createDomainError,
  UnexpectedError,
  NotFoundError,
  AlreadyExistsError,
  ConstraintViolationError,
  AuthorizationError,
};
