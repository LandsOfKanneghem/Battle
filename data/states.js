// Данные состояний и справочник по их идентификаторам.
const SPEED = {
  id: 'speed', name: 'Скорость', mpBonus: 2, initiativeBonus: 5,
  description: '+2 MP, +5 инициативы', duration: 0, casterName: '', suppressed: false,
  overrides: ['slowness'], neutralizes: [], blocks: [], permanent: false, innate: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M14 13 H25 V27 L32 29 V35 H10 V28 L14 25 Z" fill="#a97544" stroke="#e4c894"/><path d="M14 18 L2 11 L5 23 L13 26 M13 20 L4 16" fill="#d5edf6" stroke="#829ea9"/><path d="M31 22 V5 M25 11 L31 5 L37 11" fill="none" stroke="#74ef9e" stroke-width="3"/></svg>`
};
const SLOWNESS = {
  id: 'slowness', name: 'Медлительность', mpBonus: -2, initiativeBonus: -5,
  description: '−2 MP, −5 инициативы', duration: 0, casterName: '', suppressed: false,
  overrides: ['speed'], neutralizes: [], blocks: [], permanent: false, innate: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 10 H21 V27 L29 30 V36 H4 V28 L7 25 Z" fill="#956637" stroke="#dfba7a"/><path d="M32 4 V23 M26 17 L32 23 L38 17" fill="none" stroke="#ff7474" stroke-width="3"/></svg>`
};
const FREEZE = {
  id: 'freeze', name: 'Заморозка', mpBonus: 0, initiativeBonus: 0,
  description: 'Пропуск хода, иммунитет к урону, запрет перемещения', duration: 2, casterName: '', suppressed: false,
  overrides: [], neutralizes: ['burning'], blocks: [], permanent: false, innate: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><g stroke="#a4eaff" stroke-width="2.5" stroke-linecap="round" fill="none"><path d="M20 3 V37 M5 11 L35 29 M5 29 L35 11 M14 7 L20 13 L26 7 M14 33 L20 27 L26 33 M6 18 L13 16 L12 9 M28 31 L27 24 L34 22 M6 22 L13 24 L12 31 M28 9 L27 16 L34 18"/></g><circle cx="20" cy="20" r="3" fill="#effdff"/></svg>`
};
const BURNING = {
  id: 'burning', name: 'Горение', mpBonus: 0, initiativeBonus: 0, tickDamage: 1, damageType: 'fire',
  description: '1 урон огнём в начале хода', duration: 2, casterName: '', suppressed: false,
  overrides: [], neutralizes: ['freeze'], blocks: [], permanent: false, innate: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 Q24 14 32 17 Q40 29 28 36 Q10 43 6 29 Q3 20 13 12 L12 24 Q22 19 20 2" fill="#f65a25"/><path d="M22 17 Q35 34 21 35 Q11 34 15 25 L19 28 Z" fill="#ffdc36"/></svg>`
};
const stateTypes = new Map([[SPEED.id, SPEED], [SLOWNESS.id, SLOWNESS], [FREEZE.id, FREEZE], [BURNING.id, BURNING]]);
