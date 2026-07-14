'use strict';

const fsp = require('node:fs/promises');
const vm = require('node:vm');

const runInContext = async (filePath, context) => {
  const src = await fsp.readFile(filePath, 'utf8');
  const code = `'use strict';\n${src}`;
  const script = new vm.Script(code);
  const result = await script.runInContext(vm.createContext(context));
  return { result, src };
};

module.exports = { runInContext };
