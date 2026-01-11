const { runInContext } = require('./vm.js');

const isGetterEntry = (key) => key.startsWith('$');

const defineGetter = (container, name, fun) =>
  void Object.defineProperty(container, name, {
    get() {
      return fun();
    },
    enumerable: true,
    configurable: true,
  });

const loadGetterEntry = (container, entry) => {
  const [key, fun] = entry;
  const name = key.slice(1);
  defineGetter(container, name, fun);
};

const loadGetterFile = async (context, container, filePath, name) => {
  const sandbox = { ...context, $: container };
  const fun = await runInContext(filePath, sandbox);
  if (fun === undefined) return;
  defineGetter(container, name, fun);
};

module.exports = { isGetterEntry, loadGetterEntry, loadGetterFile };
