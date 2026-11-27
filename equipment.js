// Панель только для просмотра. Слоты не меняют экипировку по нажатию.
(() => {
  const panel=document.getElementById('equipment-panel'), slots=document.getElementById('equipment-slots');
  const order=['gloves','head','boots','rightHand','chest','leftHand','belt','other1','other2'];
  const allowed={head:'шлем, шляпа',boots:'ботинки, сапоги',gloves:'перчатки',belt:'пояс',chest:'нагрудная броня, кольчуга, мантия',rightHand:'одноручное оружие, двуручное оружие',leftHand:'щит, двуручное оружие',other1:'кольцо, амулет, плащ',other2:'кольцо, амулет, плащ'};
  const outlines={head:'head',boots:'boots',gloves:'gloves',belt:'belt',chest:'chest',rightHand:'sword',leftHand:'shield',other1:'ring',other2:'ring'};
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
      }else if(!item){
        const image=document.createElement('img');image.src=`assets/equipment/empty-${outlines[slot]}.png`;
        image.className='equipment-outline';image.alt='';image.draggable=false;art.append(image);
      }
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
