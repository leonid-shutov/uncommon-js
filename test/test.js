'use strict';

const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const path = require('node:path');
const { loadDir } = require('../lib/loader');

const PATH_TO_APPLICATION = path.join(__dirname, 'application');

test('Methods', async () => {
  const context = vm.createContext({});
  await loadDir(context, context, PATH_TO_APPLICATION);
  const chestnut = context.application.chestnut;
  assert.strictEqual(chestnut.isRipe(), false);
  chestnut.grow();
  assert.strictEqual(chestnut.isRipe(), true);
});

test('Getters', async () => {
  const logs = [];
  const mockedConsole = { log: (x) => logs.push(x) };
  const context = vm.createContext({ console: mockedConsole });
  await loadDir(context, context, PATH_TO_APPLICATION);
  assert.strictEqual(logs.length, 0);
  const chestnut = context.application.chestnut;
  assert.strictEqual(chestnut.isEdible, true);
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0], `This shouldn't be logged during loading`);
});

test('Service', async () => {
  const context = vm.createContext({});
  await loadDir(context, context, PATH_TO_APPLICATION);
  const chestnut = context.application.chestnut;
  assert.strictEqual(chestnut.isRotten, false);
  chestnut.rot();
  assert.strictEqual(chestnut.isRotten, true);
});
