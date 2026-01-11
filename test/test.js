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

test('Service Entry', async (t) => {
  await t.test('Method', async () => {
    const logs = [];
    const console = { info: (x) => logs.push(x) };
    const context = vm.createContext({ console });
    await loadDir(context, context, PATH_TO_APPLICATION);
    const testModule = context.application.serviceEntry.module;
    const log = Symbol();
    testModule.log(log);
    assert.strictEqual(logs[0], 'Testing Service Entry');
    assert.strictEqual(logs[1], log);
  });

  await t.test('Expected Error', async () => {
    const context = vm.createContext({});
    await loadDir(context, context, PATH_TO_APPLICATION);
    const testModule = context.application.serviceEntry.module;
    try {
      testModule.handleExpectedError();
    } catch (error) {
      assert.strictEqual(error.message, 'Handled error');
      assert.strictEqual(error.cause.code, 404);
    }
  });

  await t.test('Unexpected Error', async () => {
    const context = vm.createContext({});
    await loadDir(context, context, PATH_TO_APPLICATION);
    const testModule = context.application.serviceEntry.module;
    try {
      testModule.handleUnexpectedError();
    } catch (error) {
      assert.strictEqual(error.message, 'Unexpected error');
      assert.strictEqual(error.cause.code, 'UNEXPECTED_CODE');
    }
  });
});

test('Getters', async (t) => {
  await t.test('Getter File', async () => {
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

  await t.test('Getter Method', async () => {
    const logs = [];
    const mockedConsole = { log: (x) => logs.push(x) };
    const context = vm.createContext({ console: mockedConsole });
    await loadDir(context, context, PATH_TO_APPLICATION);
    assert.strictEqual(logs.length, 0);
    const testModule = context.application.getterMethod;
    assert.strictEqual(testModule.testGetterMethod, 'getter-method');
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0], `This shouldn't be logged during loading`);
  });
});
