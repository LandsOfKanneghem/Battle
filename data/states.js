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
  overrides: [], neutralizes: ['freeze', 'wet'], blocks: [], permanent: false, innate: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 Q24 14 32 17 Q40 29 28 36 Q10 43 6 29 Q3 20 13 12 L12 24 Q22 19 20 2" fill="#f65a25"/><path d="M22 17 Q35 34 21 35 Q11 34 15 25 L19 28 Z" fill="#ffdc36"/></svg>`
};
const WET = {
  id: 'wet', name: 'Влага', mpBonus: 0, initiativeBonus: 0,
  description: '+1 сопротивление огню, −1 сопротивление воде', duration: 3, casterName: '', suppressed: false,
  // Общий расчёт характеристик учитывает модификаторы до поглощения урона ES.
  modifiers: { resistances: { fire: 1, water: -1 } },
  overrides: [], neutralizes: ['burning'], blocks: [], permanent: false, innate: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 Q5 22 8 29 Q12 39 22 37 Q35 35 32 24 Q29 16 20 3 Z" fill="#2a7fff" stroke="#a0d4ff" stroke-width="2"/><path d="M13 26 Q11 32 19 33" fill="none" stroke="#d0f4ff" stroke-width="2" stroke-linecap="round"/></svg>`
};
const HEAVY = {
  id: 'heavy', name: 'Тяжесть', mpBonus: 0, initiativeBonus: 0,
  description: 'Нельзя толкнуть; обычная ходьба разрешена', duration: 2, casterName: '', suppressed: false,
  overrides: ['light'], neutralizes: [], blocks: [], permanent: false, innate: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M15 14 V10 Q15 4 20 4 Q25 4 25 10 V14" fill="none" stroke="#c5c9ce" stroke-width="4"/><path d="M11 14 H29 L35 35 H5 Z" fill="#57616e" stroke="#bbc4cf" stroke-width="2"/><path d="M20 18 V29 M15 24 L20 29 L25 24" fill="none" stroke="#e5e9ef" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};
const LIGHT = {
  id: 'light', name: 'Легкость', duration: 2, mpBonus: 0, initiativeBonus: 0,
  description: 'Временно снимает Тяжесть (перекрывает).', casterName: '', suppressed: false,
  overrides: ['heavy'], neutralizes: [], blocks: [], permanent: false, innate: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4 Q24 10 30 12 Q38 16 34 24 Q30 32 20 34 Q10 32 6 24 Q2 16 10 12 Q16 10 20 4 Z" fill="#d5edf6" stroke="#829ea9" stroke-width="2"/><path d="M14 20 Q20 16 26 20" fill="none" stroke="#fff" stroke-width="2"/></svg>`
};
const CHILL = {
  id: 'chill', name: 'Охлаждение', mpBonus: 0, initiativeBonus: 0,
  description: 'Охлаждение — пока без дополнительных эффектов', duration: 2, casterName: '', suppressed: false,
  overrides: [], neutralizes: [], blocks: [], permanent: false, innate: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="#def7ff" stroke-width="2" stroke-linecap="round"><path d="M20 5 V35 M7 12 L33 28 M7 28 L33 12 M15 8 L20 13 L25 8 M15 32 L20 27 L25 32 M9 18 L14 17 L13 11 M27 29 L26 23 L32 22 M9 22 L14 23 L13 29 M27 11 L26 17 L32 18"/></g><circle cx="20" cy="20" r="3" fill="#bfe8ff"/></svg>`
};
const ADRENALINE = {
  id: 'adrenaline', name: 'Адреналин', duration: 2, apBonus: 2, evaBonus: 10, mpBonus: 0, initiativeBonus: 0,
  description: '+2 ОД, +10% уклонения, иммунитет к Слабости и Истощению. После окончания действия на цель накладывается Адреналиновый откат на 1 ход.', casterName: '', suppressed: false,
  overrides: [], neutralizes: [], blocks: [], permanent: false, innate: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 36 Q0 23 4 12 Q10 1 20 10 Q30 1 36 12 Q40 23 20 36 Z" fill="#d84458" stroke="#ffb2b6" stroke-width="2"/><path d="M23 7 L13 22 H21 L17 34 L29 17 H22 Z" fill="#fff2a3"/></svg>`
};
const ADRENALINE_CRASH = {
  id: 'adrenaline-crash', name: 'Адреналиновый откат', duration: 1, apBonus: -2, accuracyBonus: -10, sfcBonus: 10, mpBonus: 0, initiativeBonus: 0,
  description: '-2 ОД, -10% к точности, +10% к провалу заклинания. Иммунитет к Адреналину и Бодрости.', casterName: '', suppressed: false,
  overrides: [], neutralizes: [], blocks: [], permanent: false, innate: false, unremovable: true,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 36 Q0 23 4 12 Q10 1 20 10 Q30 1 36 12 Q40 23 20 36 Z" fill="#665477" stroke="#b9a9cb" stroke-width="2"/><path d="M20 10 V29 M13 22 L20 29 L27 22" fill="none" stroke="#ded3eb" stroke-width="3"/></svg>`
};
const WEAKNESS = {
  id: 'weakness', name: 'Слабость', duration: 2, accuracyBonus: -30, mpBonus: 0, initiativeBonus: 0,
  description: 'Точность уменьшается на 30%, урон от атак и умений уменьшается на 20%.', casterName: '', suppressed: false,
  overrides: [], neutralizes: [], blocks: [], permanent: false, innate: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="#626f63" stroke="#b5c0b1" stroke-width="2"/><path d="M20 8 V31 M11 22 L20 31 L29 22" fill="none" stroke="#e5e8d7" stroke-width="3" stroke-linecap="round"/></svg>`
};
const EXHAUSTION = {
  id: 'exhaustion', name: 'Истощение', duration: 2, sfcBonus: 30, mpBonus: 0, initiativeBonus: 0,
  description: 'Шанс провала заклинания увеличивается на 30%, урон от заклинаний уменьшается на 20%.', casterName: '', suppressed: false,
  overrides: [], neutralizes: [], blocks: [], permanent: false, innate: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="11" r="6" fill="#9ca6b4" stroke="#d5dce6"/><path d="M8 35 L11 24 Q20 16 29 24 L32 35 M12 24 L7 30 M28 24 L33 30" fill="none" stroke="#9ca6b4" stroke-width="4" stroke-linecap="round"/><path d="M16 12 H18 M22 12 H24 M17 16 H23" stroke="#455265" stroke-width="1.5" stroke-linecap="round"/></svg>`
};
const VIGOR = {
  id: 'vigor', name: 'Бодрость', duration: 2, mpBonus: 0, initiativeBonus: 0,
  description: 'Иммунитет к Слабости', casterName: '', suppressed: false,
  overrides: [], neutralizes: [], blocks: [], permanent: false, innate: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="#3e8768" stroke="#a5f1bd" stroke-width="2"/><path d="M20 31 V9 M11 18 L20 9 L29 18" fill="none" stroke="#e7ffce" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};
const BLEEDING = {
  id: 'bleeding', name: 'Кровотечение', duration: 2, mpBonus: 0, initiativeBonus: 0,
  description: '2 урона в начале хода (не блокируется)', casterName: '', suppressed: false,
  overrides: [], neutralizes: [], blocks: [], permanent: false, innate: false, stackable: true,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 Q5 22 7 29 Q10 38 20 38 Q32 38 34 28 Q35 21 20 3 Z" fill="#c93650" stroke="#ffadb6" stroke-width="2"/><path d="M12 26 Q10 32 18 33" fill="none" stroke="#ffe1e5" stroke-width="2" stroke-linecap="round"/></svg>`
};
const WATER_ENTITY = {
  id: 'water-entity', name: 'Водяная сущность',
  description: 'Иммунитет к урону водой. Иммунитет к Влаге, Охлаждению и Горению.',
  duration: 0, mpBonus: 0, initiativeBonus: 0,
  permanent: true, unremovable: true,
  overrides: [], neutralizes: [], blocks: ['wet', 'chill', 'burning'],
  casterName: '', suppressed: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 Q5 22 8 29 Q12 39 22 37 Q35 35 32 24 Q29 16 20 3 Z" fill="#2a7fff" stroke="#a0d4ff" stroke-width="2"/><path d="M13 26 Q11 32 19 33" fill="none" stroke="#d0f4ff" stroke-width="2" stroke-linecap="round"/></svg>`
};
const LEVITATION = {
  id: 'levitation', name: 'Левитация', duration: 0, mpBonus: 0, initiativeBonus: 0,
  description: 'Цель может преодолевать водные преграды, но не может заканчивать на них ход. Стоимость движения по водным преградам 1 ОП.',
  casterName: '', suppressed: false, overrides: [], neutralizes: [], blocks: [], permanent: false, innate: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 6 Q22 14 26 16 Q34 20 30 28 Q26 36 20 36 Q14 36 10 28 Q6 20 14 16 Q18 14 20 6 Z" fill="#d5edf6" stroke="#829ea9" stroke-width="2"/><path d="M12 30 Q16 26 20 30 M20 30 Q24 26 28 30" fill="none" stroke="#a0d4ff" stroke-width="2"/></svg>`
};
const OLD_AGE = {
  id: 'old-age', name: 'Старость', duration: 2, mpBonus: 0, initiativeBonus: 0,
  description: 'Понижает все базовые характеристики живого существа на 2 ед.',
  modifiers: { vit: -2, str: -2, att: -2, int: -2, wis: -2, cha: -2, luc: -2 },
  casterName: '', suppressed: false, overrides: [], neutralizes: [], blocks: [], permanent: false, innate: false,
  icon: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M12 3 H28 V7 H12 Z M12 37 H28 V33 H12 Z" fill="#8a6f4a"/><path d="M13 7 H27 L27 14 Q27 18 20 20 Q13 18 13 14 Z M13 33 H27 L27 26 Q27 22 20 20 Q13 22 13 26 Z" fill="#d5b98a" stroke="#8a6f4a" stroke-width="1.5"/><path d="M20 20 V26 M20 20 V14" stroke="#8a6f4a" stroke-width="1.5"/></svg>`
};
const stateTypes = new Map([[OLD_AGE.id, OLD_AGE], [LEVITATION.id, LEVITATION], [WATER_ENTITY.id, WATER_ENTITY], [SPEED.id, SPEED], [SLOWNESS.id, SLOWNESS], [FREEZE.id, FREEZE], [BURNING.id, BURNING], [WET.id, WET], [HEAVY.id, HEAVY], [LIGHT.id, LIGHT], [CHILL.id, CHILL], [ADRENALINE.id, ADRENALINE], [ADRENALINE_CRASH.id, ADRENALINE_CRASH], [WEAKNESS.id, WEAKNESS], [EXHAUSTION.id, EXHAUSTION], [VIGOR.id, VIGOR], [BLEEDING.id, BLEEDING]]);
