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
