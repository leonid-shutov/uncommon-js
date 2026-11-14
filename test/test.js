'use strict';

const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const path = require('node:path');
const { loadDir } = require('../lib/loader.js');

const PATH_TO_APPLICATION = path.join(__dirname, 'application');

test('Methods Directory', async () => {
  const logs = [];
  const console = { log: (x) => logs.push(x) };
  const context = vm.createContext({ console });
  await loadDir(context, context, PATH_TO_APPLICATION);
  const testModule = context.application.methodsDir;
  assert.strictEqual(logs.length, 0);
  testModule.method('baz');
  assert.strictEqual(logs[0], 'foo');
  assert.strictEqual(logs[1], 'bar');
  assert.strictEqual(logs[2], 'baz');
});

test('Getter', async () => {
  const logs = [];
  const mockedConsole = { log: (x) => logs.push(x) };
  const context = vm.createContext({ console: mockedConsole });
  await loadDir(context, context, PATH_TO_APPLICATION);
  assert.strictEqual(logs.length, 0);
  const testModule = context.application.gettersFile;
  assert.strictEqual(testModule.getter, 'getters-file');
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0], `This shouldn't be logged during loading`);
});

test('Common', async () => {
  const logs = [];
  const mockedConsole = { log: (x) => logs.push(x) };
  const context = vm.createContext({ console: mockedConsole });
  await loadDir(context, context, PATH_TO_APPLICATION);
  const testModule = context.application.commonDir.module;
  assert.strictEqual(testModule.method(), 'common');
  const anotherModule = context.application.commonDir.anotherModule;
  anotherModule.method();
  // common directories should spawn separate context branches
  assert.strictEqual(logs[0], 'foo is not defined');
  assert.strictEqual(logs[1], 'bar');
  assert.strictEqual(logs[2], 'common');
});

test('Group Directory', async () => {
  const context = vm.createContext({});
  await loadDir(context, context, PATH_TO_APPLICATION);
  const testModule = context.application.groupDir;
  // group inside (common): subdir members are hoisted to shared globals
  assert.strictEqual(testModule.module.callGrouped(), 'grouped-global');
  // group inside a normal module: subdir is flattened onto the module
  assert.strictEqual(testModule.profile.get(), 'profile-get');
});

test('Self Reference', async () => {
  const logs = [];
  const mockedConsole = { log: (x) => logs.push(x) };
  const context = vm.createContext({ console: mockedConsole });
  await loadDir(context, context, PATH_TO_APPLICATION);
  const testModule = context.application.selfReference;
  // in an object-literal file too, self is the module; its own entries are reached through it
  testModule.obj.ownFun();
  assert.strictEqual(logs[0], 'parent-value');
  assert.strictEqual(logs[1], 'own-value');
  // module's self doesn't include object entries
  assert.strictEqual(testModule.ownSelf(), undefined);

  assert.strictEqual(testModule.value, 'initial-value');
  testModule.setValue();
  assert.strictEqual(testModule.value, 'updated-value');
});

test('Module Realm', async () => {
  const context = vm.createContext({});
  await loadDir(context, context, PATH_TO_APPLICATION);
  const testModule = context.application.moduleRealm;
  // files of one module share its realm, builtins included
  assert.strictEqual(testModule.isError(testModule.makeError('boom')), true);
  // top-level declarations stay private to their file
  assert.strictEqual(testModule.first(), 'first');
  assert.strictEqual(testModule.second(), 'second');
});

test('Error Location', async () => {
  const context = vm.createContext({});
  await loadDir(context, context, PATH_TO_APPLICATION);
  const location = `${path.join(PATH_TO_APPLICATION, 'errorSource', 'throws.js')}:3:`;
  // errors name the application file and its own line, not the loader's wrapper
  assert.throws(
    () => context.application.errorSource.throws(),
    (error) => error.stack.includes(location),
  );
});

test('Dependencies', async () => {
  const { loadModules } = require('../lib/deps.js');
  delete globalThis.cjsPkgLoads;
  const { npm, node } = await loadModules(path.join(__dirname, 'deps'));
  // CommonJS loads on first read, and only once
  assert.strictEqual(globalThis.cjsPkgLoads, undefined);
  assert.strictEqual(npm['cjs-pkg'].name, 'cjs-pkg');
  assert.strictEqual(npm['cjs-pkg'].name, 'cjs-pkg');
  assert.strictEqual(globalThis.cjsPkgLoads, 1);
  // ESM with top-level await is imported up front, resolved from rootDir
  assert.strictEqual(npm['esm-tla-pkg'].name, 'esm-tla-pkg');
  // builtins are lazy too, with no stray `undefined` key
  assert.strictEqual(typeof Object.getOwnPropertyDescriptor(node, 'fs').get, 'function');
  assert.strictEqual(node.fs, require('node:fs'));
  assert.strictEqual(Object.keys(node).includes('undefined'), false);
});
