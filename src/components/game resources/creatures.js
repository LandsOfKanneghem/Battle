import img_Koatl from './img/Koatl.png';
import img_demonLord from './img/demon lord.png';
import img_thief from './img/thief.png';
import img_beholder from './img/beholder.png';
import img_purpleDragon from './img/purple dragon.png';
import img_finist from './img/fairybird.gif';
import img_fireBird from './img/firebird.gif';

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

let finist = setCreatureStats("Финист", img_finist, 'enemy',
            [20, 20, 20, 12, 6], 
            [40, 40, 40, 40, 40, 40, 40], 
            [0, 0, 0, 0, 0, 0, 0])

let fireBird = setCreatureStats("Жар-птица", img_fireBird, 'enemy',
            [20, 20, 20, 12, 6], 
            [50, 50, 50, 50, 50, 50, 50], 
            [0, 0, 100, 0, 0, 0, 0])

let Creatures = new Map();
Creatures.set("finist", finist)
Creatures.set("fireBird", fireBird)

export default Creatures