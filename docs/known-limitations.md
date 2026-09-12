# Known limitations

Current behavior that is not design intent. Both items below concern the injected `node.*`
and `npm.*` globals, which are built by [`lib/deps.js`](../lib/deps.js). Don't build on
either — they're expected to change.

## `npm.*` is loaded eagerly

Every entry in the app's `package.json` `dependencies` is `require`d during
`loadApplication`, before any app file runs, whether or not the app ever references it
(`lib/deps.js:16-23`).

A package whose import has a side effect demonstrates it — the app below never mentions
`heavy-pkg`:

```js
// node_modules/heavy-pkg/index.js
console.log('>>> heavy-pkg side effect ran (opened a DB pool, started a timer, ...)');
```

```
before loadApplication
>>> heavy-pkg side effect ran (opened a DB pool, started a timer, ...)
after loadApplication
```

Consequences:

- startup pays for every dependency, used or not;
- packages that connect, spawn, or register on import do so unconditionally;
- a dependency that fails to resolve throws during `loadApplication`, taking the process
  down at boot rather than at the point of use. `safeRequire` (`lib/deps.js:6`) catches the
  `require` failure and retries with a dynamic `import()`, but nothing catches that, so it
  escapes as an unhandled `ERR_MODULE_NOT_FOUND`.

Resolution is also relative to the library's own location rather than `rootDir`. A normal
`npm install` works, because the library sits inside the app's `node_modules`, but an
`npm link`ed or workspace-symlinked checkout resolves to the real path and cannot see the
app's packages:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'heavy-pkg'
    imported from .../uncommon-js/lib/deps.js
```

### Planned

Make `npm` lazy — a `Proxy` (or getters) that resolves a package on first property access —
and resolve via `require.resolve(name, { paths: [rootDir] })`. Then unused packages are
never loaded, import side effects fire only on use, and a missing package throws where it
is used, with a message naming it.

## `node.*` contains stray keys

The builtin table is built from `builtinModules` without filtering (`lib/deps.js:25-34`),
so it carries three kinds of noise.

**A literal `undefined` key.** Failed lookups `return []` — an empty array where a
`[key, value]` pair is expected — and `Object.fromEntries` reads `[][0]` as the key:

```js
const { node } = await loadModules(rootDir);
node.undefined; // => undefined, but the key is really there
Object.keys(node).includes('undefined'); // => true
```

**Slash-named duplicates.** `builtinModules` lists both spellings, so each appears twice:

```js
node['fs/promises'] === node.fs.promises; // => true
```

Affects `assert/strict`, `dns/promises`, `fs/promises`, `inspector/promises`, `path/posix`,
`path/win32`, `readline/promises`, `stream/consumers`, `stream/promises`, `stream/web`,
`timers/promises`, and `util/types`. **Prefer the dotted form** (`node.fs.promises`) — the
slash spellings may be dropped.

**Deprecated and internal builtins.** They are required unconditionally, which is why every
app prints this at startup:

```
[DEP0192] The _tls_common module is deprecated. Use `node:tls` instead.
[DEP0192] The _tls_wrap module is deprecated. Use `node:tls` instead.
[DEP0040] The `punycode` module is deprecated...
[DEP0025] sys is deprecated. Use `node:util` instead.
ExperimentalWarning: WASI is an experimental feature and might change at any time
```

### Planned

Filter out `_`-prefixed and slash-named entries, and drop failed lookups properly rather
than emitting an empty pair. Making `node.*` lazy in the same way as `npm.*` would also
silence the deprecation warnings, since nothing would touch `punycode` or `sys` unless an
app asked for them.
