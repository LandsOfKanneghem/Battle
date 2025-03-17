import img_monk from './img/monk.png';
import img_mage from './img/mage.png';

function setCreatureStats(name, img, alignment, initStats, characteristics, resistances) {
    let [initHP, initMana, initWP, AP, MP] = initStats
    let [vit, wis, str, agi, int, will, ini] = characteristics
    let [physRes, waterRes, fireRes, airRes, earthRes, lightRes, darkRes] = resistances

    let HP = initHP + vit * 4;
    let Mana = initMana + wis * 5;
    let WP = initWP + will * 5;
    let IP = str + agi + int + will + ini;
    let maxHP = HP, maxMana = Mana, maxWP = WP, maxAP = AP, maxMP = MP;

    //множитель ловкости
    let agiMul = Math.floor(agi/10);

    return {
        name, img, alignment,
        HP, maxHP, Mana, maxMana, WP, maxWP, AP, maxAP, MP, maxMP, IP,
        vit, wis, str, agi, int, will, ini, agiMul, 
        physRes, waterRes, fireRes, airRes, earthRes, lightRes, darkRes,
        states: [], effects: [],
    }
}

let monk = setCreatureStats("Монах", img_monk, 'ally',
            [20, 20, 20, 12, 6], 
            [25, 25, 25, 25, 25, 25, 30], 
            [0, 0, 0, 0, 0, 0, 0])

let mage = setCreatureStats("Маг", img_mage, 'ally',
            [20, 20, 20, 12, 6], 
            [20, 40, 10, 10, 40, 40, 40], 
            [0, 0, 0, 0, 0, 0, 0])

let Heroes = new Map();
Heroes.set("monk", monk)
Heroes.set("mage", mage)

export default Heroes