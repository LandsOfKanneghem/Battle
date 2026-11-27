// Определения предметов; экземпляры и прочность создаются отдельно.
Object.assign(window.EQUIPMENT_ITEMS, {
  "healing-potion": {
    "id": "healing-potion",
    "name": "Зелье лечения",
    "itemType": "Расходник",
    "allowedSlots": ["consumables"],
    "iconPath": "assets/equipment/healing-potion.png",
    "consumable": {"heal": 10, "apCost": 2},
  },
  "antidote": {
    "id": "antidote",
    "name": "Противоядие",
    "itemType": "Расходник",
    "allowedSlots": ["consumables"],
    "iconPath": "assets/equipment/antidote.png",
    "consumable": {"apCost": 2, "cleansePoison": true},
  },
  "bandages": {
    "id": "bandages",
    "name": "Бинты",
    "itemType": "Расходник",
    "allowedSlots": ["consumables"],
    "iconPath": "assets/equipment/bandages.png",
    "consumable": {"apCost": 1, "removeBleedingStacks": 1},
  },
  "volatile-mixture": {
    "id": "volatile-mixture",
    "name": "Гремучая смесь",
    "itemType": "Расходник",
    "allowedSlots": ["consumables"],
    "iconPath": "assets/equipment/volatile-mixture.png",
    "consumable": {"apCost": 2, "spell": {"id": "volatile-mixture-throw", "name": "Гремучая смесь", "abilityType": "ability", "damageBase": 6, "damageType": "fire", "fixedDamage": true, "noCrit": true, "apCost": 2, "maxUsesPerTurn": 1, "maxCooldown": 0, "range": 5, "minRange": 1, "modifiable": false, "noLOS": false, "isAOE": true, "aoeSize": 3, "target": "any", "appliesBurning": true, "durationBase": 2, "durationPerInt": 0, "canCastOnAnyCell": true, "iconPath": "assets/equipment/volatile-mixture.png", "svg": "<svg viewBox=\"0 0 64 64\"><image href=\"assets/equipment/volatile-mixture.png\" width=\"64\" height=\"64\"/></svg>"}},
  },
});
