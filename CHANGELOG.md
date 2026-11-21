# Changelog

## [Unreleased]

### Added

- `.json` files load as data, keyed like `.js` files: `book/tags.json` becomes `app.book.tags`.
  Each is parsed in the realm of its module, so its objects are that module's own.

### Changed

- **Breaking:** Node 22.13 or later is required. Node 20 reached its end of life on
  2026-04-30.
- **Breaking:** the top of the tree loads like any directory below it. A numeric prefix on a
  file there is stripped from its key, so `src/1-start.js` becomes `start` instead of
  `1-start`, and its files load after its directories instead of in alphabetical order
  among them.
- **Breaking:** numbers in names compare as numbers, so `2-store/` loads before `10-ui/`
  instead of after it, and the order no longer depends on the system locale.
- **Breaking:** `node.*` leaves out Node's `_`-prefixed internals, such as `_http_agent` and
  `_tls_wrap`. Slash-named builtins stay, so `node['fs/promises']` and `node['stream/web']`
  are no longer slated for removal.
- A tree directory that cannot be read fails with Node's own error, such as `ENOENT` naming
  its absolute path, instead of one naming `rootDir` and `treePath`.

### Fixed

- A file at the top of the tree that isn't `.js`, such as a `README.md` in `src/`, is skipped
  as it is anywhere deeper, instead of failing the load with `ENOTDIR`.
- Builtins that exist only with the `node:` prefix, such as `node:sqlite` and `node:test`, are
  reachable as `node.sqlite` and `node.test`. They used to be listed as `node['node:sqlite']`,
  which always read as `null`.

## [2.0.0] - 2026-11-15

### Changed

- **Breaking:** the files of a module share one `node:vm` context instead of getting one each.
  A context carries a whole set of builtins, so this is most of the loader's memory: booting
  [tuigram](https://github.com/leonid-shutov/tuigram), 486 files, went from 482 contexts to 60,
  from 79 MB of heap to 21 MB, and from about 650 ms to 375 ms. Each file is still evaluated in
  a block of its own, so its top-level `const`, `let`, `function` and `class` stay private to
  it, but a top-level `var` or `globalThis.x = …` is now shared with the rest of the module.
  Values pass between the files of a module without crossing realms, so `instanceof Error`
  holds between them.
- **Breaking:** `self` is the module in every file. In a file exporting an object literal it
  used to be a copy of that object layered over the module, and only when the file began with
  `({` exactly: a leading comment switched it off.
- **Breaking:** an ES module dependency reads as its default export in `npm.*`, with or without
  top-level await. One without top-level await used to read as its module namespace.
- **Breaking:** `__rootDir` is an absolute path. A relative `rootDir` used to reach files as it
  was passed.
- A tree with no `package.json` at `rootDir` loads with no npm dependencies, instead of failing.

### Fixed

- Errors from application files name the file and its line, instead of
  `evalmachine.<anonymous>` and a line one off.
- `(common)`, `(getters)` and the other parenthesized directories no longer leave an empty
  `'(common)'`-style key on the module they load into. A subdirectory of `(getters)` loads into
  the module, as one in any grouping directory does, instead of under that key.
- A dependency that fails to load names the application's `package.json`, and keeps the
  original error as its cause, instead of naming this library's `lib/deps.js`.
- A tree directory that cannot be read names `rootDir` and `treePath`, the options that place
  it, instead of surfacing as a bare `ENOENT`.
- The README called getters lazy, evaluated on first read. They are computed: every read runs
  the getter again.

### Upgrading from 1.x

- Drop `.default` where you read an ES module dependency through it:
  `npm['string-width'].default(text)` becomes `npm['string-width'](text)`.
- In a file exporting an object literal, reach the object's own entries through the module:
  `self.ownValue` in `obj.js` becomes `self.obj.ownValue`.
- Declare file-private values with `const` or `let`; a top-level `var` is now seen by the
  whole module.
- If you compared `__rootDir` with a relative `rootDir`, compare it with
  `path.resolve(rootDir)`.

[Unreleased]: https://github.com/leonid-shutov/uncommon-js/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/leonid-shutov/uncommon-js/compare/v1.0.2...v2.0.0
