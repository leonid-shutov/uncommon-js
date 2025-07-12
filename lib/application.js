'use strict';

const fsp = require('node:fs').promises;
const path = require('node:path');
const vm = require('node:vm');
const errors = require('./errors.js');
const { loadModules } = require('./deps.js');
const { loadDir } = require('./loader.js');

const getDefaultApplicationPath = () => path.join(process.cwd(), 'application');

const readLayers = (applicationPath) =>
  fsp
    .readFile(path.join(applicationPath, '.layers'), 'utf8')
    .then((data) => data.split(/[\r\n\s]+/).filter((s) => s.length !== 0));

const loadApplication = async (sandbox = {}, options) => {
  Object.assign(sandbox, errors);
  const applicationPath = options?.path ?? getDefaultApplicationPath();
  const promises = [loadModules(), readLayers(applicationPath)];
  const [modules, layers] = await Promise.all(promises);
  Object.assign(sandbox, modules);
  const context = vm.createContext(sandbox);
  const load = loadDir.bind(undefined, context, context);
  for (const layer of layers) await load(path.join(applicationPath, layer));
  return sandbox;
};

module.exports = { loadApplication };
