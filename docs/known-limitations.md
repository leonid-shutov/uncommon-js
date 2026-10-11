# Known limitations

Current behavior that is not design intent. Both items below concern the injected `node.*`
and `npm.*` globals, which are built by [`lib/deps.js`](../lib/deps.js). Don't build on
either — they're expected to change.

## ESM dependencies are loaded eagerly

`npm.*` is built during `loadTree` (`lib/deps.js`). A CommonJS package is a getter that
`require`s it on first read, so an unused one is never loaded and its import side effects fire
only on use. An ES module cannot be loaded that way: `require()` of ESM throws when the module
uses top-level await, and `import()` is asynchronous, so a getter cannot wait for it. ES modules
are therefore still imported before any app file runs, whether or not the app references them.

Consequences, for ESM dependencies only:

- startup pays for them, used or not;
- packages that connect, spawn, or register on import do so unconditionally;
- one that fails to resolve throws during `loadTree`, taking the process down at boot rather
  than at the point of use.

Packages are resolved from `rootDir`, so an `npm link`ed or workspace-symlinked checkout of
this library still sees the app's packages, with one exception: a package whose `exports`
offer only an `import` condition is invisible to `require.resolve`, and is imported by name
from this library's location instead. Under a linked checkout that fails:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'esm-only-pkg'
    imported from .../uncommon-js/lib/deps.js
```

A dependency missing from `node_modules` altogether fails the same way, naming this library.

### Planned

Make `loadTree` itself able to wait for a module on first use — for instance by letting an
app file's top-level value be awaited when it reads an ESM dependency — so ES modules can be
deferred too.

## `node.*` contains slash-named duplicates

`node.*` is built from `builtinModules` without filtering (`lib/deps.js`). Each entry is a
getter that requires the builtin on first read, so deprecated and experimental ones (`sys`,
`punycode`, `_tls_common`, `wasi`) only warn if an app touches them, and a builtin that fails to
load reads as `null`.

`builtinModules` lists both spellings, so each of these appears twice:

```js
node['fs/promises'] === node.fs.promises; // => true
```

Affects `assert/strict`, `dns/promises`, `fs/promises`, `inspector/promises`, `path/posix`,
`path/win32`, `readline/promises`, `stream/consumers`, `stream/promises`, `stream/web`,
`timers/promises`, and `util/types`. **Prefer the dotted form** (`node.fs.promises`) — the
slash spellings may be dropped. `_`-prefixed internal builtins are listed as well.

### Planned

Filter out `_`-prefixed and slash-named entries.
