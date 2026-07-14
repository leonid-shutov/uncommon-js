'use strict';

const fsp = require('node:fs/promises');

const removeIndex = (key) => key.replace(/^\d+-/, '');

const ranker = (order) => (name) => {
  const index = order.indexOf(name);
  return index === -1 ? order.length : index;
};

const readdirSorted = async (dirPath, options) => {
  const entries = await fsp.readdir(dirPath, options);
  const nameOf = (entry) => (options?.withFileTypes ? entry.name : entry);
  entries.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  if (options?.order !== undefined) {
    const rank = ranker(options.order);
    entries.sort((a, b) => rank(nameOf(a)) - rank(nameOf(b)));
  }
  return entries;
};

const safeAssign = (target, source) => Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));

const isObjectLiteral = (src) => src.startsWith('({');

module.exports = { removeIndex, readdirSorted, safeAssign, isObjectLiteral };
