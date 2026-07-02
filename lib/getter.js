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
  const fun = await runInContext(filePath, context);
  if (fun === undefined) return;
  defineGetter(container, name, fun);
};

module.exports = { loadGetter };
