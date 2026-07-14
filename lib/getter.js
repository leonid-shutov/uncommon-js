const { runInContext } = require('./vm.js');

const defineGetter = (container, name, fun) =>
  void Object.defineProperty(container, name, {
    get() {
      return fun();
    },
    enumerable: true,
    configurable: true,
  });

const loadGetter = async (context, container, filePath, name) => {
  const { result } = await runInContext(filePath, context);
  if (result === undefined) return;
  defineGetter(container, name, result);
};

module.exports = { loadGetter };
