import { setCreatureStats } from "../functions/battleFunctions"
import { countArea, cloneObj } from "../functions/otherFunctions"
import { drawLine2 } from "../functions/BresenhamAlgo"

function setSpell(name, effects, cd, dmg, dmgType, duration, manacost, apcost, range, area, target, LOS, castsPerTurn, castsPerFight, requirment) {
    return {name, effects, cd, dmg, dmgType, duration, manacost, apcost, range, area, target, LOS, castsPerTurn, castsPerFight, requirment}
}

//dmg - урон, в пределах [min, max]
//range - дальность применения, в пределах [min, max], 3 поле опционально (иногда бывает по прямой)
//area - область [area, radius]: area - описание обл-ти, radius - радиус области
let fireShot = setSpell('Огненный выстрел', [],
                            0, [8, 10], 'fire',
                            null, 2, 3, [0, 10], ['solo'], 'any', true, 2, null, null)

let fireBall = setSpell('Огненный шар', [],
                            1, [18, 22], 'fire',
                            null, 5, 4, [0, 8], ['square', 1], 'any', true, null, null, null)

let armageddon = setSpell('Армагеддон', [],
                            8, [40, 44], 'fire',
                            null, 15, 6, [0, 0], ['allMap', 99], 'any', false, null, 1, null)

let waterBubble = setSpell('Водный пузырь', [],
                            0, [8, 10], 'water',
                            2, 3, 3, [0, 8], ['cross', 1], 'any', true, 2, null, null)

let frostRing = setSpell('Кольцо холода', [],
                            2, [8, 10], 'water',
                            null, 3, 3, [0, 8], ['ring', 1], 'any', true, null, null, null)

let rainbow = setSpell('Радуга', [],
                            1, [14, 18], 'light',
                            null, 5, 4, [0, 8], ['square', 1], 'enemy', false, null, null, null)

let fear = setSpell('Испуг', [effect_fear],
                            2, null, null,
                            null, 2, 2, [2, 8, 'linear'], ['solo'], 'notarget', false, null, null, null)

let vacuum = setSpell('Вакуум', [effect_vacuum],
                            3, null, null,
                            null, 8, 2, [0, 8], ['square', 2], 'notarget', false, null, null, null)


let Spells = new Map();
Spells.set("fireShot", fireShot)
Spells.set("fireBall", fireBall)
Spells.set("armageddon", armageddon)
Spells.set("waterBubble", waterBubble)
Spells.set("frostRing", frostRing)
Spells.set("rainbow", rainbow)
Spells.set("fear", fear)
Spells.set("vacuum", vacuum)

export default Spells



function effect_fear(caster, spell, pos, bmap, setBmap) {
    let startI = caster.y, startJ = caster.x, finishI = pos.i, finishJ = pos.j
    if (startI !== finishI) {
        let signI = (startI < finishI) ? 1 : -1
        if (bmap[startI + signI][startJ].creature !== null) {
            let startMovement = startI + 2 * signI, finishMovement = finishI, i = startMovement
            while (i !== finishMovement) {
                i += signI
                if (bmap[i][startJ].creature !== null || bmap[i][startJ].type === 'obstacle') {
                    finishMovement = i - signI
                    break
                }
            }
            setCreatureStats(bmap[startMovement - signI][startJ].creature, 
                ['x', 'y'], 
                [startJ, finishMovement],
                bmap, setBmap)
        } else return
    } else {
        let signJ = (startJ < finishJ) ? 1 : -1
        if (bmap[startI][startJ + signJ].creature !== null) {
            let startMovement = startJ + 2 * signJ, finishMovement = finishJ, j = startMovement
            while (j !== finishMovement) {
                j += signJ
                if (bmap[startI][j].creature !== null || bmap[startI][j].type === 'obstacle') {
                    finishMovement = j - signJ
                    break
                }
            }
            setCreatureStats(bmap[startI][startMovement - signJ].creature, 
                ['x', 'y'], 
                [finishMovement, startI],
                bmap, setBmap)
        } else return
    }
}

function effect_vacuum(caster, spell, pos, bmap, setBmap) {
    let i = pos.i, j = pos.j, radius = spell.area[1], rows = bmap.length, cols = bmap[0].length
    let {startI, startJ, finishI, finishJ} = countArea(i, j, radius, rows, cols)
    let unitsArr = [], distance, newUnit
    for (let ii = startI; ii < finishI; ii++)
                for (let jj = startJ; jj < finishJ; jj++) {
                    if (bmap[ii][jj].creature !== null) {
                        distance = Math.abs(i - ii) + Math.abs(j - jj)
                        newUnit = cloneObj(bmap[ii][jj].creature)
                        unitsArr.push({unit: newUnit, distance})
                    }     
                }
    
    if (unitsArr.length) {
        unitsArr.sort((a, b) => a.distance - b.distance)
        let target, LOS = []
        let newBmap = bmap.map(arr => arr.slice())
        for (let k = 0; k < unitsArr.length; k++) {
            startI = unitsArr[k].unit.y
            startJ = unitsArr[k].unit.x
            LOS = drawLine2(startJ, startI, j, i, newBmap)//нужна именно 2-ая версия алг-тма
            target = {i: LOS[LOS.length - 1].i, j: LOS[LOS.length - 1].j}
            newUnit = unitsArr[k].unit
            newUnit.x = target.j
            newUnit.y = target.i
            newBmap[startI][startJ].creature = null
            newBmap[newUnit.y][newUnit.x].creature = newUnit
        }
        setBmap(newBmap)
    }
}
