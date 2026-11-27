// Панель только для просмотра. Слоты не меняют экипировку по нажатию.
(() => {
  const panel=document.getElementById('equipment-panel'), slots=document.getElementById('equipment-slots');
  const order=['gloves','head','boots','rightHand','chest','leftHand','belt','other1','other2'];
  const allowed={head:'шлем, шляпа',boots:'ботинки, сапоги',gloves:'перчатки',belt:'пояс',chest:'нагрудная броня, кольчуга, мантия',rightHand:'одноручное оружие, двуручное оружие',leftHand:'щит, двуручное оружие',other1:'кольцо, амулет, плащ',other2:'кольцо, амулет, плащ'};
  const outlines={
    head:'<path d="M14 46V28Q14 10 32 10Q50 10 50 28V46L38 52V34H26V52ZM15 30H49M32 11V28"/>',
    boots:'<path d="M16 12H34V36L48 43V51H12V43L16 34ZM17 22H33M12 44H45"/>',
    gloves:'<path d="M20 53V41L12 28Q9 20 15 21L22 29V12Q26 6 29 13V26V9Q34 4 36 11V26V12Q42 7 43 15V29V20Q49 16 50 24V39L44 53ZM20 44H44"/>',
    belt:'<path d="M8 24H24V19H40V24H56V40H40V45H24V40H8ZM24 19V45M40 19V45M30 25H35V39H30ZM8 31H23M42 31H56"/>',
    chest:'<path d="M18 10L26 8Q32 21 38 8L46 10L55 23L46 30V53H18V30L9 23ZM26 8Q32 29 38 8M22 47H42"/>',
    rightHand:'<path d="M16 48L45 13L53 8L53 19L24 53ZM12 39L32 56M10 57L19 47M7 55L12 60"/>',
    leftHand:'<path d="M12 12L32 7L52 12V32Q49 47 32 57Q15 47 12 32ZM32 9V53M15 29H49"/>',
    other1:'<path d="M24 13L32 7L40 13L36 23H28ZM24 13H40M26 23Q12 27 13 39Q14 53 32 55Q50 53 51 39Q52 27 38 23M26 29Q19 33 20 40Q21 48 32 49Q43 48 44 40Q45 33 38 29"/>'
  };
  outlines.other2=outlines.other1;
  let shown=null, tooltip=null;
  const hide=()=>{tooltip?.remove();tooltip=null;};
  function show(anchor,item,slot,entity){
    hide();
    tooltip=document.createElement('div');tooltip.className='spell-tooltip equipment-tooltip';tooltip.setAttribute('role','tooltip');
    const heading=document.createElement('h3');heading.className='spell-title';heading.textContent=item?.name??window.EQUIPMENT_SLOTS[slot];tooltip.append(heading);
    const line=(label,value)=>{const p=document.createElement('p');p.textContent=`${label}: ${value}`;tooltip.append(p);};
    if(!item)line('Слот для',allowed[slot]);
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
    for(const slot of order){
      const label=window.EQUIPMENT_SLOTS[slot];
      const item=slot==='leftHand'&&equipment.rightHand?.hands===2 ? equipment.rightHand : equipment[slot];
      const cell=document.createElement('button');cell.type='button';cell.className=`equipment-slot${item?' filled':''}`;cell.dataset.slot=slot;
      cell.setAttribute('aria-label',`${label}: ${item?.name??'Пусто'}`);
      const art=document.createElement('div');art.className='equipment-art';
      if(item?.iconPath){
        const image=document.createElement('img');image.src=item.iconPath;image.alt='';image.draggable=false;art.append(image);
      }else if(!item)art.innerHTML=`<svg viewBox="0 0 64 64" aria-hidden="true" class="equipment-outline" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">${outlines[slot]}</svg>`;
      cell.append(art);
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
