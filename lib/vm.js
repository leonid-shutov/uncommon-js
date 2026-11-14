'use strict';

const fsp = require('node:fs/promises');
const vm = require('node:vm');

const runInContext = async (filePath, context) => {
  const src = await fsp.readFile(filePath, 'utf8');
  const code = `'use strict';\n{\n${src}\n}`;
  const script = new vm.Script(code);
  return script.runInContext(vm.createContext(context));
};

module.exports = { runInContext };
