// Экипировка персонажа и общий рюкзак. Предметы перемещаются без копирования прочности.
(() => {
  const slots=document.getElementById('equipment-slots');
  const dialog=document.getElementById('backpack-dialog');
  const order=['gloves','head','boots','rightHand','chest','leftHand','belt','other1','other2'];
  const allowed={head:'шлем, шляпа',boots:'ботинки, сапоги',gloves:'перчатки',belt:'пояс',chest:'нагрудная броня, кольчуга, мантия',rightHand:'одноручное оружие, двуручное оружие',leftHand:'щит, двуручное оружие',other1:'кольцо, амулет, плащ',other2:'кольцо, амулет, плащ'};
  const outlines={head:'head',boots:'boots',gloves:'gloves',belt:'belt',chest:'chest',rightHand:'sword',leftHand:'shield',other1:'ring',other2:'ring'};
  let shown=null, tooltip=null;
  const bagSlots=document.getElementById('backpack-slots');
  const backpackSize=100;
  const modifierNames={maxHP:'Макс. ОЗ',maxWP:'Макс. WP',mp:'ОП',vit:'VIT',str:'STR',att:'ATT',int:'INT',wis:'WIS',cha:'CHA',luc:'LUC',eva:'Уклонение (%)',physical:'Физическая защита',fire:'Защита от огня',water:'Защита от воды',earth:'Защита от земли',air:'Защита от воздуха',poison:'Защита от яда',mind:'Защита разума'};
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
    for(const [key,value] of Object.entries(item?.modifiers??{})) { const effective=item.ac!==undefined&&window.isArmorBroken(item)?Math.floor(value*.25):value;line(modifierNames[key]??key,`${effective>=0?'+':''}${effective}`); }
    (anchor.closest('dialog[open]')??document.body).append(tooltip);
    const r=anchor.getBoundingClientRect();tooltip.style.left=`${Math.max(8,Math.min(r.left,innerWidth-tooltip.offsetWidth-8))}px`;tooltip.style.top=`${Math.max(8,Math.min(r.bottom+8,innerHeight-tooltip.offsetHeight-8))}px`;
  }
  window.renderEquipment=function(entity){
    shown=entity;
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
    const key=JSON.stringify([entity?.id,bag,window.canManageEquipment(entity)]);
    if(bagSlots.dataset.key===key)return;
    bagSlots.dataset.key=key;bagSlots.replaceChildren();
    for(let index=0;index<backpackSize;index++){
      const item=bag[index];
      const cell=document.createElement('button');cell.type='button';cell.className='equipment-slot backpack-slot';cell.dataset.index=index;
      cell.setAttribute('aria-label',item?.name??'Свободная ячейка');cell.setAttribute('aria-pressed',String(gameState.selectedBackpackIndex===index));
      if(item){
        const image=document.createElement('img');image.src=item.iconPath;image.alt='';image.draggable=false;cell.append(image);
        cell.addEventListener('mouseenter',()=>show(cell,item,null,shown));cell.addEventListener('focus',()=>show(cell,item,null,shown));
        cell.addEventListener('mouseleave',hide);cell.addEventListener('blur',hide);
        cell.addEventListener('click',()=>{gameState.selectedBackpackIndex=gameState.selectedBackpackIndex===index?null:index;renderEquipment(shown);});
        cell.addEventListener('dblclick',()=>{
          const destination=item.allowedSlots.find(slot=>!shown?.Equipment?.[slot])??item.allowedSlots[0];
          window.changeEquipment(shown,index,destination);
        });
      }
      bagSlots.append(cell);
    }
  }
  document.getElementById('open-backpack').addEventListener('click',()=>{hide();renderBackpack(shown);dialog.showModal();});
  document.getElementById('close-backpack').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',hide);
  const entity=gameState.entities.find(e=>e.id===(gameState.selectedEntityId??gameState.hoveredEntityId??gameState.activeEntityId));
  window.renderEquipment(entity);
})();
