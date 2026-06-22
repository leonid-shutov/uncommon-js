const fsp = require('node:fs/promises');

const readdirSorted = async (dirPath, options) => {
  const entries = await fsp.readdir(dirPath, options);
  if (options?.withFileTypes) return entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries.sort((a, b) => a.localeCompare(b));
};

const safeAssign = (target, source) => Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));

module.exports = { readdirSorted, safeAssign };
