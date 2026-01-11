({
  log: {
    description: 'Testing Service Entry',
    method: (x) => {
      console.info(x);
    },
  },

  handleExpectedError: {
    method: () => {
      throw { code: 404 };
    },
    expectedErrors: {
      404: new Error('Handled error'),
    },
  },

  handleUnexpectedError: {
    method: () => {
      throw { code: 'UNEXPECTED_CODE' };
    },
    expectedErrors: {
      404: new Error('Handled error'),
    },
  },
});
