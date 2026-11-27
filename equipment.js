// Экипировка персонажа и общий рюкзак. Предметы перемещаются без копирования прочности.
(() => {
  const slots=document.getElementById('equipment-slots');
  const dialog=document.getElementById('backpack-dialog');
  const order=['gloves','head','boots','rightHand','chest','leftHand','belt','other1','other2'];
  const allowed={head:'шлем, шляпа',boots:'ботинки, сапоги',gloves:'перчатки',belt:'пояс',chest:'нагрудная броня, кольчуга, мантия',rightHand:'одноручное оружие, двуручное оружие',leftHand:'щит, двуручное оружие',other1:'кольцо, амулет, плащ',other2:'кольцо, амулет, плащ',consumables:'зелье'};
  const outlines={head:'head',boots:'boots',gloves:'gloves',belt:'belt',chest:'chest',rightHand:'sword',leftHand:'shield',other1:'ring',other2:'ring'};
  let shown=null, tooltip=null, contextMenu=null;
  const consumableSlots=document.getElementById('consumable-slots');
  const closeContext=()=>{contextMenu?.remove();contextMenu=null;};
  const bagSlots=document.getElementById('backpack-slots');
  const backpackSize=80;
  let backpackPage=0;
  const filter=document.getElementById('backpack-filter');
  const matchesFilter=(item,type)=>{
    if(type==='all')return true;
    if(!item)return false;
    if(type==='melee'||type==='ranged')return !!item.attack && !!item.attack.isShot===(type==='ranged');
    if(type==='other')return item.allowedSlots?.some(slot=>slot==='other1'||slot==='other2');
    return item.allowedSlots?.includes(type);
  };
  const modifierNames={maxHP:'ОЗ',maxWP:'WP',mp:'ОП',maxMP:'ОП',maxAP:'ОД',consumableSlots:'Слот расходников',vit:'VIT',str:'STR',att:'ATT',int:'INT',wis:'WIS',cha:'CHA',luc:'LUC',eva:'Уклонение (%)',physical:'Физическая защита',fire:'Защита от огня',water:'Защита от воды',earth:'Защита от земли',air:'Защита от воздуха',poison:'Защита от яда',mind:'Защита разума',dark:'Защита от тьмы',light:'Защита от света',cri:'Крит (%)',blo:'Блок (%)'};
  const hide=()=>{tooltip?.remove();tooltip=null;};
  function show(anchor,item,slot,entity){
    hide();
    tooltip=document.createElement('div');tooltip.className='spell-tooltip equipment-tooltip';tooltip.setAttribute('role','tooltip');
    const heading=document.createElement('h3');heading.className='spell-title';heading.textContent=item?.name??window.EQUIPMENT_SLOTS[slot]??'Расходник';tooltip.append(heading);
    const line=(label,value)=>{const p=document.createElement('p');p.textContent=`${label}: ${value}`;tooltip.append(p);};
    if(!item)line('Слот для',allowed[slot]);
    else if(item.attack){
      const a=item.attack;
      const types={dagger:'Кинжал',sword:item.hands===2?'Двуручный меч':'Одноручный меч',axe:item.hands===2?'Двуручный топор':'Одноручный топор',bow:'Лук',sling:'Праща'};
      line('Оружие',types[item.weaponType]??item.weaponType??(item.hands===2?'Двуручное':'Одноручное'));line('ОД',a.apCost);
      line('Урон',`${a.damageBase} + ${a.damagePerStr??0} × STR (физический)`);
      line('Точность',`${a.baseAccuracy}%`);line('Крит шанс',`${a.baseCritChance}%`);
      line('Дальность',`${a.minRange===a.range||a.minRange===undefined?a.range:`${a.minRange}–${a.range}`}${a.modifiable?' [изменяемая]':' [неизменяемая]'}`);
    }else if(item.ac!==undefined){
      line('AC',window.getArmorSourceAC(item));line('Прочность',item.indestructible?'Несокрушимый':`${item.durability} / ${item.maxDurability}`);
      if(window.isArmorBroken(item))line('Состояние','Сломано');
    }
    const damageNames={physical:'физический',poison:'яд',fire:'огонь',water:'вода',earth:'земля',air:'воздух',light:'свет',dark:'тьма'};
    for(const part of item?.attack?.bonusDamage??[])line('Дополнительный урон',`+${part.damage} ${damageNames[part.damageType]??part.damageType}`);
    if(item?.consumable){
      const use=item.consumable;
      if(use.heal)line('Лечение',`+${use.heal} ОЗ`);
      if(use.cleansePoison)line('Эффект','Снимает яд');
      if(use.removeBleedingStacks)line('Эффект','Снимает 1 стак Кровотечения');
      if(use.spell){line('Урон','6 огонь');line('Дальность','1–5 [неизменяемая]');line('АОЕ','Квадрат 3×3');line('LOS','Требует');line('Эффект','Горение на 2 хода');}
      line('Применение',`${use.apCost??2} ОД`);
    }
    if(item?.consumableSlots!==undefined)line('Слоты расходников',item.consumableSlots);
    for(const [key,value] of Object.entries(item?.modifiers??{})) {
      const effective=item.ac!==undefined&&window.isArmorBroken(item)?Math.floor(value*.25):value;
      const amount=`${effective>=0?'+':''}${effective}`;
      if(['maxHP','maxWP','maxAP','maxMP','mp'].includes(key)){
        const p=document.createElement('p');p.textContent=`${amount} ${modifierNames[key]}`;tooltip.append(p);
      }else line(modifierNames[key]??key,amount);
    }
    (anchor.closest('dialog[open]')??document.body).append(tooltip);
    const r=anchor.getBoundingClientRect();tooltip.style.left=`${Math.max(8,Math.min(r.left,innerWidth-tooltip.offsetWidth-8))}px`;tooltip.style.top=`${Math.max(8,Math.min(r.bottom+8,innerHeight-tooltip.offsetHeight-8))}px`;
  }
  window.renderEquipment=function(entity){
    if(shown?.id!==entity?.id)closeContext();
    shown=entity;
    renderConsumables(entity);
    renderBackpack(entity);
    const equipment=entity?.Equipment??{};
    const key=JSON.stringify([entity?.id,equipment,gameState.selectedBackpackIndex,window.canManageEquipment(entity)]);
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
      const selected=gameState.backpack?.[gameState.selectedBackpackIndex];
      cell.classList.toggle('equipment-compatible',!!selected?.allowedSlots?.includes(slot)&&window.canManageEquipment(entity));
      cell.append(art);
      cell.addEventListener('click',()=>{ if(window.changeEquipment(shown,gameState.selectedBackpackIndex??null,slot))hide(); });
      cell.addEventListener('mouseenter',()=>show(cell,item,slot,shown));cell.addEventListener('focus',()=>show(cell,item,slot,shown));
      cell.addEventListener('mouseleave',hide);cell.addEventListener('blur',hide);slots.append(cell);
    }
  };
  function renderBackpack(entity){
    if(!gameState.backpack)window.resetSharedBackpack();
    const bag=gameState.backpack;
    for(const cell of bagSlots.children)cell.setAttribute('aria-pressed',String(gameState.selectedBackpackIndex===Number(cell.dataset.index)));
    const entries=bag.map((item,index)=>({item,index})).filter(entry=>matchesFilter(entry.item,filter.value));
    while(entries.length&&!entries.at(-1).item)entries.pop();
    const pages=Math.max(1,Math.ceil(entries.length/backpackSize));
    backpackPage=Math.max(0,Math.min(backpackPage,pages-1));
    document.getElementById('backpack-prev').disabled=backpackPage===0;
    document.getElementById('backpack-next').disabled=backpackPage===pages-1;
    const key=JSON.stringify([entity?.id,bag,filter.value,backpackPage,window.canManageEquipment(entity)]);
    if(bagSlots.dataset.key===key)return;
    bagSlots.dataset.key=key;bagSlots.replaceChildren();
    for(let position=0;position<backpackSize;position++){
      const {item,index}=entries[backpackPage*backpackSize+position]??{item:null,index:-1};
      const cell=document.createElement('button');cell.type='button';cell.className='equipment-slot backpack-slot';cell.dataset.index=index;
      cell.setAttribute('aria-label',item?.name??'Свободная ячейка');cell.setAttribute('aria-pressed',String(gameState.selectedBackpackIndex===index));
      if(item){
        const image=document.createElement('img');image.src=item.iconPath;image.alt='';image.draggable=false;cell.append(image);
        cell.addEventListener('mouseenter',()=>show(cell,item,null,shown));cell.addEventListener('focus',()=>show(cell,item,null,shown));
        cell.addEventListener('mouseleave',hide);cell.addEventListener('blur',hide);
        cell.addEventListener('click',()=>{gameState.selectedBackpackIndex=gameState.selectedBackpackIndex===index?null:index;renderEquipment(shown);});
        cell.addEventListener('dblclick',()=>{
          if(item.consumable){
            const count=window.getConsumableSlotCount(shown);if(!count)return;
            let slot=shown.consumables.findIndex((value,index)=>!value&&index<count);if(slot<0)slot=0;
            window.changeConsumable(shown,index,slot);return;
          }
          const destination=item.allowedSlots.find(slot=>!shown?.Equipment?.[slot])??item.allowedSlots[0];
          window.changeEquipment(shown,index,destination);
        });
      }
      bagSlots.append(cell);
    }
  }
  function renderConsumables(entity){
    const capacity=window.getConsumableSlotCount(entity),items=entity?.consumables??[];
    const key=JSON.stringify([entity?.id,capacity,items,entity?.ap,gameState.activeEntityId,gameState.selectedBackpackIndex,window.canManageEquipment(entity)]);
    if(consumableSlots.dataset.key===key)return;
    consumableSlots.dataset.key=key;consumableSlots.replaceChildren();
    for(let slot=0;slot<6;slot++){
      const item=items[slot],locked=slot>=capacity,cell=document.createElement('button');
      cell.type='button';cell.className=`equipment-slot consumable-slot${locked?' locked':''}`;cell.dataset.consumableSlot=slot;
      cell.setAttribute('aria-label',locked?'Недоступный слот расходника':item?.name??'Свободный слот расходника');
      cell.setAttribute('aria-disabled',String(locked));
      if(item){const image=document.createElement('img');image.src=item.iconPath;image.alt='';cell.append(image);}
      cell.classList.toggle('equipment-compatible',!locked&&!!gameState.backpack?.[gameState.selectedBackpackIndex]?.consumable);
      cell.addEventListener('click',()=>{if(!locked)window.changeConsumable(shown,gameState.selectedBackpackIndex??null,slot);});
      cell.addEventListener('mouseenter',()=>{if(!locked)show(cell,item,'consumables',shown);});cell.addEventListener('mouseleave',hide);
      cell.addEventListener('contextmenu',event=>{
        event.preventDefault();closeContext();hide();if(locked||!item)return;
        const owner=shown;contextMenu=document.createElement('div');contextMenu.className='consumable-menu';contextMenu.setAttribute('role','menu');
        const use=document.createElement('button');use.type='button';use.textContent='Применить';use.setAttribute('role','menuitem');use.disabled=!window.canUseConsumable(owner,slot);
        use.addEventListener('click',()=>{if(window.useConsumable(owner,slot)&&item.consumable.spell){hide();dialog.close();}closeContext();});contextMenu.append(use);document.body.append(contextMenu);
        contextMenu.style.left=`${Math.max(0,Math.min(event.clientX,innerWidth-contextMenu.offsetWidth-8))}px`;
        contextMenu.style.top=`${Math.max(0,Math.min(event.clientY,innerHeight-contextMenu.offsetHeight-8))}px`;
      });
      consumableSlots.append(cell);
    }
  }
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.consumable-menu'))closeContext();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeContext();if(dialog.open&&!document.querySelector('dialog:modal')){dialog.close();event.preventDefault();event.stopPropagation();}}},true);
  filter.addEventListener('change',()=>{backpackPage=0;hide();gameState.selectedBackpackIndex=null;renderEquipment(shown);});
  for(const [id,delta] of [['backpack-prev',-1],['backpack-next',1]])document.getElementById(id).addEventListener('click',()=>{hide();backpackPage+=delta;renderBackpack(shown);});
  const toolbar=document.querySelector('.battle-toolbar');
  const positionBackpack=()=>dialog.style.setProperty('--backpack-top',`${Math.max(72,toolbar.getBoundingClientRect().bottom+16)}px`);
  new ResizeObserver(positionBackpack).observe(toolbar);
  window.addEventListener('resize',positionBackpack);
  positionBackpack();
  document.getElementById('open-backpack').addEventListener('click',()=>{hide();renderBackpack(shown);if(!dialog.open)dialog.show();});
  document.getElementById('close-backpack').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',hide);
  const entity=gameState.entities.find(e=>e.id===(gameState.selectedEntityId??gameState.hoveredEntityId??gameState.activeEntityId));
  window.renderEquipment(entity);
})();
