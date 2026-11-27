// Панель только для просмотра. Слоты не меняют экипировку по нажатию.
(() => {
  const panel=document.getElementById('equipment-panel'), slots=document.getElementById('equipment-slots');
  const icons={chest:'<path d="M18 8H46L56 22L46 30V56H18V30L8 22Z" fill="#979eaa" stroke="#e0d2aa" stroke-width="3"/><path d="M24 9Q32 28 40 9M32 24V53" fill="none" stroke="#3d4350" stroke-width="4"/>',leftHand:'<path d="M10 10L32 5L54 10V32Q51 50 32 60Q13 50 10 32Z" fill="#606c81" stroke="#e0d2aa" stroke-width="4"/><path d="M32 10V52M15 27H49" stroke="#c7b98e" stroke-width="4"/>'};
  let shown=null, tooltip=null;
  const hide=()=>{tooltip?.remove();tooltip=null;};
  function show(anchor,item,slot,entity){
    hide();
    tooltip=document.createElement('div');tooltip.className='spell-tooltip equipment-tooltip';tooltip.setAttribute('role','tooltip');
    const heading=document.createElement('h3');heading.className='spell-title';heading.textContent=item?.name??window.EQUIPMENT_SLOTS[slot];tooltip.append(heading);
    const line=(label,value)=>{const p=document.createElement('p');p.textContent=`${label}: ${value}`;tooltip.append(p);};
    if(!item)line('Слот',slot==='leftHand'&&entity?.Equipment?.rightHand?.hands===2?'Занят двуручным оружием':'Пусто');
    else if(item.attack){
      const a=item.attack;
      line('Оружие',item.hands===2?'Двуручное':'Одноручное');line('ОД',a.apCost);
      line('Урон',`${a.damageBase} + ${a.damagePerStr??0} × STR (физический)`);
      line('Точность',`${a.baseAccuracy}%`);line('Крит шанс',`${a.baseCritChance}%`);
      line('Дальность',`${a.minRange}–${a.range}${a.modifiable?' [изменяемая]':' [неизменяемая]'}`);
    }else if(item.ac!==undefined){
      line('AC',window.getArmorSourceAC(item));line('Прочность',item.indestructible?'Несокрушимый':`${item.durability} / ${item.maxDurability}`);
      if(window.isArmorBroken(item))line('Состояние','Сломано');
    }
    document.body.append(tooltip);
    const r=anchor.getBoundingClientRect();tooltip.style.left=`${Math.max(8,Math.min(r.left,innerWidth-tooltip.offsetWidth-8))}px`;tooltip.style.top=`${Math.max(8,Math.min(r.bottom+8,innerHeight-tooltip.offsetHeight-8))}px`;
  }
  window.renderEquipment=function(entity){
    shown=entity;
    const equipment=entity?.Equipment??{};
    const key=JSON.stringify([entity?.id,equipment]);
    if(slots.dataset.key===key)return;
    slots.dataset.key=key;hide();slots.replaceChildren();
    for(const [slot,label] of Object.entries(window.EQUIPMENT_SLOTS)){
      const item=equipment[slot],blocked=slot==='leftHand'&&equipment.rightHand?.hands===2;
      const cell=document.createElement('button');cell.type='button';cell.className=`equipment-slot${item?' filled':''}`;cell.dataset.slot=slot;
      cell.setAttribute('aria-label',`${label}: ${item?.name??(blocked?'Занято двуручным оружием':'Пусто')}`);
      const art=document.createElement('div');art.className='equipment-art';
      if(item?.attack)art.innerHTML=item.attack.svg;
      else if(item)art.innerHTML=`<svg viewBox="0 0 64 64" aria-hidden="true">${icons[slot]??icons.chest}</svg>`;
      else art.textContent=blocked?'↔':'—';
      const caption=document.createElement('span');caption.textContent=label;cell.append(art,caption);
      cell.addEventListener('mouseenter',()=>show(cell,item,slot,shown));cell.addEventListener('focus',()=>show(cell,item,slot,shown));
      cell.addEventListener('mouseleave',hide);cell.addEventListener('blur',hide);slots.append(cell);
    }
  };
  const resize=()=>{
    const stats=document.querySelector('.stats'),header=document.querySelector('.hero-masthead');
    document.querySelector('.equipment-column').style.height=`${document.querySelector('.panel').getBoundingClientRect().height}px`;
    panel.style.height=`${stats.getBoundingClientRect().height}px`;
    document.querySelector('.equipment-spacer').style.height=`${header.getBoundingClientRect().height}px`;
  };
  new ResizeObserver(resize).observe(document.querySelector('.stats'));
  new ResizeObserver(resize).observe(document.querySelector('.hero-masthead'));
  resize();
  const entity=gameState.entities.find(e=>e.id===(gameState.selectedEntityId??gameState.hoveredEntityId??gameState.activeEntityId));
  window.renderEquipment(entity);
})();
