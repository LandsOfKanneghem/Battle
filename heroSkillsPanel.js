// Display only leaf skills; prerequisites are still stored on each hero.
(() => {
  const panel = document.getElementById('hero-skills-panel');
  const list = document.getElementById('hero-skills-list');
  const empty = document.getElementById('hero-skills-empty');
  let previousKey = null;
  window.renderHeroSkills = function(entity) {
    const visible = !!entity && window.MapEquipment.HEROES.includes(entity.type) && window.gameState.isAlly(entity);
    panel.hidden = !visible;
    const selected = visible ? entity.skills ?? [] : [];
    const key = JSON.stringify([entity?.id, selected]);
    if (key === previousKey) return;
    previousKey = key;
    const skills = window.HeroSkills.highest(selected);
    empty.hidden = skills.length > 0;
    list.replaceChildren(...skills.map(skill => {
      const row = document.createElement('li');
      row.textContent = skill.name;
      row.title = skill.description ?? '';
      row.dataset.skill = skill.id;
      return row;
    }));
  };
})();
