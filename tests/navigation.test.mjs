import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/navigation.js', import.meta.url), 'utf8');

function mountSidebar(savedState = null) {
  const classes = new Set();
  const attributes = {};
  const listeners = {};
  const storage = new Map();
  if (savedState !== null) storage.set('mmg-sidebar-expanded', savedState);

  const shell = { classList: { toggle(name, active) {
    if (active) classes.add(name);
    else classes.delete(name);
  } } };
  const toggle = {
    setAttribute(name, value) { attributes[name] = value; },
    addEventListener(name, callback) { listeners[name] = callback; },
    focus() { attributes.focused = 'true'; },
  };
  const document = {
    querySelector(selector) {
      return selector === '.shell' ? shell : selector === '.sidebar-toggle' ? toggle : null;
    },
    addEventListener(name, callback) { listeners[`document:${name}`] = callback; },
  };

  runInNewContext(source, {
    document,
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); },
    },
  });

  return { classes, attributes, listeners, storage };
}

test('sidebar toggle expands, persists, and closes with Escape', () => {
  const { classes, attributes, listeners, storage } = mountSidebar();

  assert.equal(attributes['aria-expanded'], 'false');
  listeners.click();
  assert.equal(classes.has('sidebar-expanded'), true);
  assert.equal(attributes['aria-expanded'], 'true');
  assert.equal(attributes['aria-label'], 'Contraer menú');
  assert.equal(storage.get('mmg-sidebar-expanded'), 'true');

  listeners['document:keydown']({ key: 'Escape' });
  assert.equal(classes.has('sidebar-expanded'), false);
  assert.equal(attributes['aria-expanded'], 'false');
  assert.equal(storage.get('mmg-sidebar-expanded'), 'false');
  assert.equal(attributes.focused, 'true');
});

test('sidebar restores its saved expanded state', () => {
  const { classes, attributes } = mountSidebar('true');
  assert.equal(classes.has('sidebar-expanded'), true);
  assert.equal(attributes['aria-expanded'], 'true');
  assert.equal(attributes['aria-label'], 'Contraer menú');
});
