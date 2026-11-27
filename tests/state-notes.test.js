const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function setup() {
  const ctx = {};ctx.window = ctx;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../data/states.js'), 'utf8'), ctx);
  return { notes: id => ctx.getStateInteractionNotes(id).join('\n'),
    states: vm.runInContext('stateTypes', ctx), get: ctx.getStateInteractionNotes };
}
test('every state has interaction footnotes; unknown ids produce none', () => {
  const { states, get } = setup();
  for (const state of states.values()) {
    const notes = get(state.id);assert(notes.length > 0, state.id);
    assert(notes.every(note => typeof note === 'string' && !note.includes('undefined')), state.id);
    assert.equal(new Set(notes).size, notes.length, state.id);
  }
  assert.equal(get('unknown').length, 0);
});
test('forward and reverse relations distinguish overrides, neutralization and immunity', () => {
  const { notes } = setup();
  assert.match(notes('speed'), /Взаимное перекрытие.*Медлительность/);
  assert.match(notes('slowness'), /Взаимное перекрытие.*Скорость/);
  assert.match(notes('wet'), /При наложении снимает «Горение»/);
  assert.match(notes('wet'), /Снимается при наложении «Горение»/);
  assert.match(notes('water-entity'), /Не позволяет наложить.*Влага.*Охлаждение.*Горение/);
  assert.match(notes('chill'), /Нельзя наложить.*Водяная сущность/);
});
test('special rules cover permanent penalties, crash lock, healing and periodic immunities', () => {
  const { notes } = setup();
  assert.match(notes('adrenaline'), /перманентные — только подавляет/);
  assert.doesNotMatch(notes('adrenaline-crash'), /Слабость/);
  assert.doesNotMatch(notes('weakness'), /откат/);
  assert.doesNotMatch(notes('vigor'), /откат/);
  assert.doesNotMatch(notes('adrenaline-crash'), /Бодрость/);
  assert.match(notes('weak-poison'), /Любое лечение.*даже при полном здоровье/);
  assert.match(notes('freeze'), /Горения, Кровотечения, Слабого яда/);
  assert.match(notes('bleeding'), /один последний наложенный стак/);
  assert.match(notes('light'), /Тяжесть неснимаемая/);
});

test('Heavy and Levitation footnotes describe suppression and recovery in both directions', () => {
  const { notes, states } = setup();
  assert(states.get('heavy').overrides.includes('levitation'));
  assert.match(notes('heavy'), /Перекрывает: «Левитация»/);
  assert.match(notes('heavy'), /Блокирует притягивание языком/);
  assert.match(notes('levitation'), /Перекрывается: «Тяжесть»/);
  assert.match(notes('levitation'), /длительность продолжает отсчитываться/);
});
