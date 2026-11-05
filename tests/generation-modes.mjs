import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const elements = new Map();
function element(selector) {
  if (!elements.has(selector)) {
    const listeners = new Map();
    const node = {
      value: '', disabled: false, hidden: false, textContent: '', innerHTML: '',
      style: {}, dataset: {}, children: [], listeners,
      classList: { toggle() {}, add() {}, remove() {} },
      addEventListener(type, handler) { listeners.set(type, handler); },
      replaceChildren() { this.children = []; this.value = ''; },
      appendChild(child) { this.children.push(child); if (!this.value) this.value = child.value; },
      setAttribute(name, value) { this[name] = value; },
      get selectedOptions() { return [{ textContent: this.value }]; },
    };
    elements.set(selector, node);
  }
  return elements.get(selector);
}
const values = { '#bpm': 124, '#swing': 6, '#quantize': 50, '#variation': 24, '#guide-style': 'house', '#genre-provider': 'template' };
for (const [key, value] of Object.entries(values)) element(key).value = value;

const recipe = Array.from({ length: 6 }, () => Array(16).fill(null));
recipe[0][0] = { velocity: 110, probability: 1, micro: 0, duration: .25 };
recipe[1][4] = { velocity: 100, probability: 1, micro: 0, duration: .25 };
const context = {
  document: {
    querySelector: element,
    querySelectorAll: () => [],
    createElement: () => ({ value: '', textContent: '' }),
  },
  window: { BeatForgeLivePilot: {
    async fetchRecipes() { return { patterns: [{ key: 'recipe-demo', label: 'Recipes · Demo', grid: recipe, bpm: 90, swing: 0, document: 'MIDI Recipes' }] }; },
    async fetchGenreConcepts() { return { genres: [
      { id: 'house', name: 'House', tempoMin: 120, tempoMax: 126, idioms: [], fallback: true },
      { id: 'trap', name: 'Trap', tempoMin: 130, tempoMax: 160, idioms: [], fallback: true },
      { id: 'drone', name: 'Drone', tempoMin: 0, tempoMax: 0, idioms: [], fallback: true },
    ], fetchedLive: 0 }; },
  } },
  setTimeout: () => 1,
  setInterval: () => 1,
  clearInterval() {},
  Math, Number, Array, String, Object, Promise,
};
vm.runInNewContext(readFileSync(new URL('../dist/genre-rules.js', import.meta.url), 'utf8'), context);
vm.runInNewContext(readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8'), context);
const click = selector => element(selector).listeners.get('click')();
function activeSteps(lane) {
  return [...element('#grid').innerHTML.matchAll(/<button class="step-cell ([^"]*)" data-track="(\d+)" data-step="(\d+)"/g)]
    .filter(hit => Number(hit[2]) === lane && hit[1].split(' ').includes('active'))
    .map(hit => Number(hit[3]));
}

await click('#fetch-livepilot');
click('#mode-recipe');
assert.equal(element('#recipe-mode').hidden, false);
assert.equal(element('#genre-mode').hidden, true);
click('#generate-recipe');
assert.equal(element('#pattern-source-badge').textContent, 'LIVEPILOT RECIPE');
assert.equal(Number(element('#hit-count').textContent), 2, 'Recipe must not add genre-template notes');

click('#mode-genre');
assert.equal(element('#recipe-mode').hidden, true);
assert.equal(element('#genre-mode').hidden, false);
element('#guide-style').value = 'trap';
click('#generate-genre');
assert.equal(element('#pattern-source-badge').textContent, 'GENRE');
assert.ok(Number(element('#hit-count').textContent) > 2, 'Genre generator should create its own groove');
assert.deepEqual(activeSteps(1), [8], 'BeatForge Trap template has one source-aligned snare on beat 3');

element('#genre-provider').value = 'concept';
element('#genre-provider').listeners.get('change')();
click('#generate-genre');
assert.equal(element('#pattern-source-badge').textContent, 'GENRE');
assert.equal(element('#pattern-heading').textContent, 'House');
assert.deepEqual(activeSteps(1), [4, 12], 'LivePilot House uses two claps');

element('#livepilot-genre').value = 'trap';
click('#generate-genre');
assert.deepEqual(activeSteps(1), [8], 'LivePilot Trap uses one snare on beat 3');

element('#livepilot-genre').value = 'drone';
click('#generate-genre');
assert.equal(Number(element('#hit-count').textContent), 0, 'No beat must remain silent, even after generation variation');

click('#mode-recipe');
click('#generate-recipe');
assert.equal(Number(element('#hit-count').textContent), 2, 'Recipe generation must reset previous genre notes');
console.log('Generation modes smoke test passed');
