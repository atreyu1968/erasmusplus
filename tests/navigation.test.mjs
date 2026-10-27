import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/navigation.js', import.meta.url), 'utf8');

test('the right-side content scroll starts below the fixed header', () => {
  const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.topbar\{[^}]*position:sticky;top:0;[^}]*z-index:20/s);
  assert.match(styles, /\.shell\{[^}]*height:100vh;height:100dvh;[^}]*overflow:hidden\}/s);
  assert.match(styles, /\.workspace\{[^}]*grid-row:2;[^}]*overflow-y:auto/s);
  assert.match(styles, /\.public-shell\{[^}]*grid-template-rows:64px minmax\(0,1fr\)/);
  assert.match(styles, /@media\(max-width:750px\)\{\s*\.public-shell\{[^}]*grid-template-rows:58px minmax\(0,1fr\)/);
});

function mountSidebar(savedState = null, canHover = true) {
  const classes = new Set();
  const attributes = {};
  const listeners = {};
  const storage = new Map();
  if (savedState !== null) storage.set('mmg-sidebar-pinned', savedState);

  let activeElement = null;
  const shell = { classList: { toggle(name, active) {
    if (active) classes.add(name);
    else classes.delete(name);
  } } };
  const pin = {
    setAttribute(name, value) { attributes[name] = value; },
    addEventListener(name, callback) { listeners[`pin:${name}`] = callback; },
  };
  const sidebar = {
    addEventListener(name, callback) { listeners[`sidebar:${name}`] = callback; },
    contains(element) { return element === pin; },
  };
  const brand = { focus() { activeElement = brand; attributes.focused = 'true'; } };
  const document = {
    get activeElement() { return activeElement; },
    querySelector(selector) {
      return selector === '.shell' ? shell
        : selector === '.sidebar' ? sidebar
          : selector === '.sidebar-pin' ? pin
            : selector === '.brand' ? brand : null;
    },
    addEventListener(name, callback) { listeners[`document:${name}`] = callback; },
  };

  runInNewContext(source, {
    document,
    matchMedia: () => ({ matches: canHover }),
    setTimeout(callback) { callback(); },
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); },
    },
  });

  return { classes, attributes, listeners, storage };
}

test('sidebar opens on hover and the floating pin keeps it open', () => {
  const { classes, attributes, listeners, storage } = mountSidebar();

  assert.equal(attributes['aria-expanded'], 'false');
  listeners['sidebar:pointerenter']();
  assert.equal(classes.has('sidebar-expanded'), true);
  assert.equal(attributes['aria-expanded'], 'true');

  listeners['pin:click']();
  assert.equal(attributes['aria-pressed'], 'true');
  assert.equal(storage.get('mmg-sidebar-pinned'), 'true');
  listeners['sidebar:pointerleave']();
  assert.equal(classes.has('sidebar-expanded'), true);

  listeners['pin:click']();
  assert.equal(attributes['aria-pressed'], 'false');
  assert.equal(classes.has('sidebar-expanded'), false);
  assert.equal(storage.get('mmg-sidebar-pinned'), 'false');
});

test('keyboard focus opens the sidebar and Escape closes and unpins it', () => {
  const { classes, attributes, listeners, storage } = mountSidebar();

  listeners['sidebar:focusin']();
  assert.equal(classes.has('sidebar-expanded'), true);
  listeners['document:keydown']({ key: 'Escape' });

  assert.equal(classes.has('sidebar-expanded'), false);
  assert.equal(attributes['aria-expanded'], 'false');
  assert.equal(attributes['aria-pressed'], 'false');
  assert.equal(storage.get('mmg-sidebar-pinned'), 'false');
  assert.equal(attributes.focused, 'true');
});

test('a saved pin is restored and touch users can open it by tapping', () => {
  const restored = mountSidebar('true');
  assert.equal(restored.classes.has('sidebar-expanded'), true);
  assert.equal(restored.attributes['aria-pressed'], 'true');
  assert.equal(restored.attributes['aria-label'], 'Desfijar menú');

  const touch = mountSidebar(null, false);
  assert.equal(touch.listeners['sidebar:pointerenter'], undefined);
  touch.listeners['pin:click']();
  assert.equal(touch.classes.has('sidebar-expanded'), true);
  assert.equal(touch.attributes['aria-pressed'], 'true');
  touch.listeners['pin:click']();
  assert.equal(touch.classes.has('sidebar-expanded'), false);
});
