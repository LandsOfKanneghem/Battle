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
const stateTypes = new Map([[SPEED.id, SPEED], [SLOWNESS.id, SLOWNESS]]);
