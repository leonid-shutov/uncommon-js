'use strict';

const fsp = require('node:fs').promises;
const path = require('node:path');
const vm = require('node:vm');
const errors = require('./errors.js');
const { loadModules } = require('./deps.js');
const { loadDir, loadFile } = require('./loader.js');

const getDefaultApplicationPath = () => path.join(process.cwd(), 'application');

const readLayers = (applicationPath) =>
  fsp
    .readFile(path.join(applicationPath, '.layers'), 'utf8')
    .then((data) => data.split(/[\r\n\s]+/).filter((s) => s.length !== 0));

const loader = (context) => (layer) => {
  if (layer.endsWith('.js')) return loadFile(context, context, layer);
  else return loadDir(context, context, layer);
};

const loadApplication = async (sandbox = {}, options) => {
  Object.assign(sandbox, errors);
  const applicationPath = options?.path ?? getDefaultApplicationPath();
  const promises = [loadModules(), readLayers(applicationPath)];
  const [modules, layers] = await Promise.all(promises);
  Object.assign(sandbox, modules);
  const context = vm.createContext(sandbox);
  const load = loader(context);
  for (const layer of layers) await load(path.join(applicationPath, layer));
  Object.assign(sandbox, { application: sandbox });
  return sandbox;
};

module.exports = { loadApplication };
