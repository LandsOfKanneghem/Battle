// node --test tests/los.test.cjs — проверяем реальную функцию из index.html.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const source = html.slice(html.indexOf('    function checkLOS('), html.indexOf('    function canTarget('));
function scene(crates = [], entities = [], water = []) {
  const obstacles = new Map([...crates.map(p => [p.join(','), 'crate']), ...water.map(p => [p.join(','), 'water'])]);
  const ctx = vm.createContext({ obstacles, entities: entities.map(([x,y]) => ({ position: {x,y} })) });
  vm.runInContext(source, ctx);
  return (a,b) => ctx.checkLOS({x:a[0],y:a[1]}, {x:b[0],y:b[1]});
}

test('Свободная горизонталь, вертикаль, диагональ и наклон', () => {
  const los = scene();
  for (const end of [[6,0],[0,6],[6,6],[5,2]]) assert(los([0,0],end));
});
test('Ящик на линии, в цели и в исходной клетке блокирует', () => {
  assert(!scene([[2,0]])([0,0],[4,0]));
  assert(!scene([[4,0]])([0,0],[4,0]));
  assert(!scene([[0,0]])([0,0],[4,0]));
});
test('Касание угла разрешено только при 45°, включая диагональную щель', () => {
  assert(scene([[1,0]])([0,0],[2,2]));
  assert(scene([[1,0],[0,1]])([0,0],[2,2]));
  assert(!scene([[1,1]])([0,0],[2,2])); // Пересечение внутренней области запрещено.
  assert(!scene([[2,0]])([0,0],[3,1])); // Касание при произвольном наклоне.
});
test('Близкий ящик без касания не блокирует', () => {
  assert(scene([[1,0]])([0,0],[1,2]));
  assert(scene([[2,1]])([0,0],[4,0]));
});
test('Вода прозрачна; промежуточное существо блокирует, конечные — нет', () => {
  assert(scene([],[],[[1,0]])([0,0],[2,0]));
  assert(!scene([],[[1,0]])([0,0],[2,0]));
  const los = scene([],[[0,0],[2,0]]);
  assert(los([0,0],[2,0])); assert(los([2,0],[0,0]));
  assert(scene([],[[1,0]])([0,0],[2,2]));
  assert(!scene([],[[1,1]])([0,0],[2,2]));
  assert(!scene([],[[2,0]])([0,0],[3,1]));
});

// Независимый эталон: пересечение отрезка с замкнутым квадратом
// методом отсечения по двум координатам (включая стороны и углы).
function touches(a,b,cell) {
  let enter=0, exit=1;
  for(let axis=0;axis<2;axis++) {
    const delta=b[axis]-a[axis], low=cell[axis]-.5, high=cell[axis]+.5;
    if(delta===0) { if(a[axis]<low || a[axis]>high) return false; }
    else {
      const t1=(low-a[axis])/delta, t2=(high-a[axis])/delta;
      enter=Math.max(enter,Math.min(t1,t2)); exit=Math.min(exit,Math.max(t1,t2));
      if(enter>exit) return false;
    }
  }
  // При 45° единственное касание угла не блокирует; пересечение — блокирует.
  const diagonal = Math.abs(b[0]-a[0]) === Math.abs(b[1]-a[1]);
  return !(diagonal && enter === exit);
}
test('Все направления и симметрия: 15 625 комбинаций против геометрического эталона', () => {
  const points=[];
  for(let y=0;y<5;y++) for(let x=0;x<5;x++) points.push([x,y]);
  for(const crate of points) {
    const los=scene([crate]);
    for(const a of points) for(const b of points) {
      const expected=!touches(a,b,crate);
      assert.equal(los(a,b),expected, JSON.stringify({a,b,crate}));
      assert.equal(los(b,a),expected, 'Обратное направление');
    }
  }
});
