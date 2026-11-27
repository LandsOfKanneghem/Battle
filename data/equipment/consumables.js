// Определения предметов; экземпляры и прочность создаются отдельно.
Object.assign(window.EQUIPMENT_ITEMS, {
  "healing-potion": {
    "id": "healing-potion",
    "name": "Зелье лечения",
    "itemType": "Расходник",
    "allowedSlots": ["consumables"],
    "iconPath": "assets/equipment/healing-potion.png",
    "consumable": {"heal": 10},
  },
});
