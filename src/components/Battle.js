import React from "react"
import '../styles/styles.css'
import BattleField from './BattleField'
import BattleMenu from './BattleMenu'
import BattleMaps from "./game resources/battle_maps"
import Spells from './game resources/spells'
import { setCreatureStats } from "./functions/battleFunctions"
import { getRandomValue, createMatrix, cloneObj, countArea } from "./functions/otherFunctions"
import { findPath } from "./functions/AStarAlgo"
import { drawLine } from "./functions/BresenhamAlgo"

import * as PIXI from "pixi.js";
import { Stage, Container, Sprite } from '@pixi/react';
import img_deepWater from './game resources/img/basic/deep water.png';
import img_grass from './game resources/img/basic/grass.png';
import img_sand from './game resources/img/basic/sand.png';
import img_shallowWater from './game resources/img/basic/shallow water.png';


let terrainArr = [img_grass, img_sand, img_shallowWater]
let obstaclesArr = [img_deepWater]
let NO_TINT = '#FFFFFF'
let DARK_TINT = '#555555'//AAAAAA
let SHADOW_TINT = '#AAAAAA'//AAAAAA
let BRIGHT_TINT = '#E1CA3F'//E1CA3F
let FOCUS_TINT = '#4169E1'


export default function Battle(props) {
    let battle = BattleMaps.get(props.battleID)
    const rows = battle.battleMap.length
    const cols = battle.battleMap[0].length
    const tileSize = 50    
    
    let [battleDataLoaded, setBattleDataLoaded] = React.useState(false)//загрузка данных
    let [displayedUnit, setDisplayedUnit] = React.useState(battle.allies[0])//какое с-во отображается в меню
    let [creaturesQueue, setCreaturesQueue] = React.useState([])
    let [isPlayersTurn, setIsPlayersTurn] = React.useState(true)//сейчас ход игрока?
    let [currentUnit, setCurrentUnit] = React.useState(null)//какое с-во сейчас ходит?
    let [currentUnitIndex, setCurrentUnitIndex] = React.useState(0)//индекс текущего с-ва в очереди с-в
    let [currentTurn, setCurrentTurn] = React.useState(1)
    let [bmap, setBmap] = React.useState(() => {//матрица ячеек поля боя, содержит детальную информацию где что находится
        //type: terrain / obstacle
        //subtype (подтип): трава, песок, дерево, и т.д.
        //creature: null / ссылка на с-во
        //surface (поверхность): вода, лед, и т.д.
        //trap: null / trap
        let initValue = {type: null, subtype: null, moveCost: null, creature: null, surface: null, trap: null}
        return createMatrix(rows, cols, initValue)
    })
    let [focusedUnit, setFocusedUnit] = React.useState(null)//подсвеченная клетка

    //состояния заклинаний
    let [isCastingSpell, setIsCastingSpell] = React.useState(false)//в этом режиме ивенты работают иначе
    let [chosenSpell, setChosenSpell] = React.useState(null) 
    let [aoeCells, setAoeCells] = React.useState(() => {
        let initValue = {tint: NO_TINT}
        return createMatrix(rows, cols, initValue)
    })   
    let [visibleCells, setVisibleCells] = React.useState(() => {
        let initValue = {tint: NO_TINT}
        return createMatrix(rows, cols, initValue)
    })  
    let [distance, setDistance] = React.useState(0)//расстояние от героя до выбранной клетки
    let [aoe, setAoe] = React.useState(null)

    React.useEffect(()=>{startBattle()}, [])
    React.useEffect(()=>{if (currentUnit) commitMapChanges()}, [bmap])
    React.useEffect(()=>{isPlayersTurn ? startTurn() : AI_turn()}, [isPlayersTurn, currentUnitIndex])
    React.useEffect(()=>{
        resetTint()
        setIsCastingSpell(false)
        if (creaturesQueue.length) {
            if (currentUnitIndex === creaturesQueue.length) {
                setCurrentTurn(prevState => prevState + 1)
                setCurrentUnitIndex(0)
            } else {
                setCurrentUnit(creaturesQueue[currentUnitIndex])
                setDisplayedUnit(creaturesQueue[currentUnitIndex])
            }
        }
    }, [currentUnitIndex])

    //эффекты заклинаний
    React.useEffect(()=>{
        resetTint()
        if (isPlayersTurn && isCastingSpell) setChosenSpell(Spells.get("vacuum"))
        else setChosenSpell(null)
    }, [isPlayersTurn, isCastingSpell])
    React.useEffect(()=>{(chosenSpell !== null) ? setSpellRange() : resetSpellRange()}, [chosenSpell])
    

    //ф-ия для автоматического изменения при изменении карты: currentUnit, displayedUnit, creaturesQueue
    function commitMapChanges() {
        let unit = {}, newQueue = cloneObj(creaturesQueue)
        for (let i = 0; i < rows; i++)
            for (let j = 0; j < cols; j++) {
                if (bmap[i][j].creature !== null) {
                    unit = cloneObj(bmap[i][j].creature)
                    if (unit.unitID === currentUnit.unitID) setCurrentUnit(unit)
                    if (unit.unitID === displayedUnit.unitID) setDisplayedUnit(unit)
                    for (let k = 0; k < creaturesQueue.length; k++)
                        if (unit.unitID === creaturesQueue[k].unitID) newQueue[k] = unit
                }
            }
        setCreaturesQueue(newQueue)
    }

    function initBattle() {
        let newBmap = bmap.map(arr => arr.slice())
        let newQueue = [], alliesArr = [], enemiesArr = []

        battle.battleMap.forEach((row, i) => {
            row.forEach((symbol, j) => {            
                switch (symbol) {
                    case '=': {
                        newBmap[i][j].type = 'obstacle'
                        newBmap[i][j].subtype = 0//water
                        break
                    }                  
                    case '.': {
                        newBmap[i][j].type = 'terrain'
                        newBmap[i][j].subtype = 0//grass
                        newBmap[i][j].moveCost = 10
                        break
                    }
                    case 's': {
                        newBmap[i][j].type = 'terrain'
                        newBmap[i][j].subtype = 1//sand
                        newBmap[i][j].moveCost = 20
                        break
                    }   
                    case '~': {
                        newBmap[i][j].type = 'terrain'
                        newBmap[i][j].subtype = 2//shallow water
                        newBmap[i][j].moveCost = 30
                        break
                    }                
                    default: {}
                }
            })
        })
        
        battle.allies.forEach((item, index) => {
            item.side = 'ally'
            newBmap[item.y][item.x].creature = item
            alliesArr.push(item)
        })
        battle.enemies.forEach(item => {
            item.side = 'enemy'
            newBmap[item.y][item.x].creature = item
            enemiesArr.push(item)
        })

        setBmap(newBmap)

        alliesArr.sort((a, b) => a.IP - b.IP)
        enemiesArr.sort((a, b) => a.IP - b.IP)
        let lastAllyIndex = alliesArr.length - 1, lastEnemyIndex = enemiesArr.length - 1
        let flag = alliesArr[lastAllyIndex].IP > enemiesArr[lastEnemyIndex].IP ? 
                    'allyIsHandling' : 'enemyIsHandling'
        while (alliesArr.length || enemiesArr.length) {
            if (flag === 'enemyIsHandling' && alliesArr.length) {
                newQueue.push(enemiesArr.pop())
                flag = 'allyIsHandling'
            } else if (flag === 'allyIsHandling' && enemiesArr.length) {
                newQueue.push(alliesArr.pop())
                flag = 'enemyIsHandling'
            } else {
                while (alliesArr.length) newQueue.push(alliesArr.pop())
                while (enemiesArr.length) newQueue.push(enemiesArr.pop())
            }
        }

        setCreaturesQueue(newQueue)
        setCurrentUnit(newQueue[0])
        setDisplayedUnit(newQueue[0])
        newQueue[0].alignment === 'ally' ? setIsPlayersTurn(true) : setIsPlayersTurn(false)
    }

    function startBattle() {
        initBattle()
        setBattleDataLoaded(true)
        setChosenSpell(Spells.get("vacuum"))
        /*
        fireShot
        fireBall
        armageddon
        waterBubble
        frostRing
        rainbow
        fear
        vacuum
        */
    }

    //сбрасывает окраску АОЕ спелов
    function resetTint() {
        setAoeCells(prevState => {
            return  prevState.map(row => 
                row.map(item => {
                return {...item, tint: NO_TINT}
            }))
        }) 
    }

    //окрашивает линию, возвращаему алг-том Брезенхема
    function tintLine(line, tintType) {
        setVisibleCells(prevState => {
            let newState = prevState.map(line => line.slice())
            let i, j
            for (let k = 0; k < line.length; k++) {
                i = line[k].i
                j = line[k].j
                newState[i][j].tint = tintType
            }  
            return newState
        })
    }

    //окрашивает кратчайший путь
    function tintPath(path) {
        setAoeCells(prevState => {
            let newState = prevState.map(path => path.slice())
            let i, j, currentDistance//расстояние от героя до текущей клетки в пути
            for (let k = 0; k < path.length; k++) {
                i = path[k].i
                j = path[k].j
                currentDistance = path[k].distance / 10
                newState[i][j].tint = (currentUnit.MP >= currentDistance) ? BRIGHT_TINT : SHADOW_TINT
            }  
            return newState
        })                         
    }

    //AOV - св-во для обл-ти видимости
    function tintArea(targetPos, type, radius, tintType, AOV) {
        let {i, j} = targetPos
        if (AOV === true) setVisibleCells(prevState => {
            let newState = prevState.map(path => path.slice())
            let {startI, startJ, finishI, finishJ} = countArea(i, j, radius, rows, cols)
            if (type === 'rhombus') {
                if (chosenSpell.LOS) {                
                    for (let ii = startI; ii < finishI; ii++)
                        for (let jj = startJ; jj < finishJ; jj++) 
                            if (Math.abs(i - ii) + Math.abs(j - jj) <= radius) {
                                let LOS = drawLine(j, i, jj, ii, bmap)
                                tintLine(LOS, tintType)
                            }
                }
                else {
                    for (let ii = startI; ii < finishI; ii++)
                        for (let jj = startJ; jj < finishJ; jj++) 
                            if (Math.abs(i - ii) + Math.abs(j - jj) <= radius) {
                                newState[ii][jj].tint = tintType
                            }
                }
            }
            else if (type === 'linear') {
                if (chosenSpell.LOS) {                
                    for (let ii = startI; ii < finishI; ii++)
                        for (let jj = startJ; jj < finishJ; jj++) 
                            if (ii === i || jj === j) {
                                let LOS = drawLine(j, i, jj, ii, bmap)
                                tintLine(LOS, tintType)
                            }
                }
                else {
                    for (let ii = startI; ii < finishI; ii++)
                        for (let jj = startJ; jj < finishJ; jj++) 
                            if (ii === i || jj === j) {
                                newState[ii][jj].tint = tintType
                            }
                }
            }
            return newState
        })
        //для АОЕ
        else setAoeCells(prevState => {
            let newState = prevState.map(path => path.slice())
            let {startI, startJ, finishI, finishJ} = countArea(i, j, radius, rows, cols)
            //МОЖЕТ ДОБАВИТЬ АОЕ????? (имеется ввиду состояние aoe, только для solo его нет)
            if (type === 'solo') {
                newState[i][j].tint = tintType
            }
            else if (type === 'square') {
                for (let ii = startI; ii < finishI; ii++)
                    for (let jj = startJ; jj < finishJ; jj++) newState[ii][jj].tint = tintType
                setAoe({startI, startJ, finishI, finishJ})
            }
            else if (type === 'rhombus') {
                for (let ii = startI; ii < finishI; ii++)
                    for (let jj = startJ; jj < finishJ; jj++) 
                        if (Math.abs(i - ii) + Math.abs(j - jj) <= radius) {
                            newState[ii][jj].tint = tintType
                        }
                setAoe({startI, startJ, finishI, finishJ})
            }
            else if (type === 'cross') {
                for (let ii = startI; ii < finishI; ii++)
                    for (let jj = startJ; jj < finishJ; jj++) 
                        if (ii === i || jj === j) {
                            newState[ii][jj].tint = tintType
                        }
                setAoe({startI, startJ, finishI, finishJ})
            }
            else if (type === 'ring') {
                let diameter = 2 * radius + 1
                for (let ii = startI; ii < finishI; ii++)
                    for (let jj = startJ; jj < finishJ; jj++) 
                        if (ii === startI || ii === startI + diameter - 1 || jj === startJ || jj === startJ + diameter - 1) {
                            newState[ii][jj].tint = tintType
                        }
                setAoe({startI, startJ, finishI, finishJ})
            }
            else if (type === 'allMap') {
                for (let ii = startI; ii < finishI; ii++)
                    for (let jj = startJ; jj < finishJ; jj++) 
                        newState[ii][jj].tint = tintType
                setAoe({startI, startJ, finishI, finishJ})
            }
            return newState
        })
    }

    //"воздействовать" на юнита
    function affectUnit(unit, spell, pos) {
        if (spell.target === 'enemy' && unit.alignment === 'ally') return
        else if (spell.target === 'ally' && unit.alignment === 'enemy') return
        else {
            let newBmap = bmap.map(arr => arr.slice())

            if (spell.dmg !== null) unit.HP -= Math.floor(getRandomValue(spell.dmg[0], spell.dmg[1]) * 
                                    (1 - (unit[spell.dmgType + 'Res'] / 100)))

            if (spell.effects.length) {
                spell.effects[0](unit, spell, pos, bmap, setBmap)
            }

            newBmap[unit.y][unit.x].creature = unit
            setBmap(newBmap)
        }
    }

    //нарисовать обл-ть видимости заклинания
    function setSpellRange() {
        let areaType = chosenSpell.range[2] ? chosenSpell.range[2] : 'rhombus'//если тип не указан, то по умолчанию ромб
        tintArea({i: currentUnit.y, j: currentUnit.x}, areaType, chosenSpell.range[1], SHADOW_TINT, true)
        if (chosenSpell.range[0]) tintArea({i: currentUnit.y, j: currentUnit.x}, areaType, chosenSpell.range[0] - 1, NO_TINT, true)
    }

    //убрать обл-ть видимости
    function resetSpellRange() {
        setVisibleCells(prevState => {
            return  prevState.map(row => 
                row.map(item => {
                return {...item, tint: NO_TINT}
            }))
        })
    }

    //сколдовать заклинание
    function castSpell(caster, targetPos, spell) {
        let {i, j} = targetPos
        setCreatureStats(caster, 
            ['AP', 'Mana'], 
            [caster.AP - spell.apcost, caster.Mana - spell.manacost],
            bmap, setBmap)
        caster = bmap[caster.y][caster.x].creature
        if (caster.unitID === displayedUnit.unitID) setDisplayedUnit(caster)

        if (spell.target === 'notarget') {
            if (spell.effects.length) {
                spell.effects[0](caster, spell, targetPos, bmap, setBmap)
            }
        }
        else if (spell.area[0] === 'solo') {
            if (bmap[i][j].creature !== null) {
                let unit = cloneObj(bmap[i][j].creature)
                affectUnit(unit, spell, targetPos)
                setDisplayedUnit(unit)
            }
        }
        else {
            let {startI, startJ, finishI, finishJ} = aoe
            for (let ii = startI; ii < finishI; ii++)
                for (let jj = startJ; jj < finishJ; jj++) {
                    if (bmap[ii][jj].creature !== null && aoeCells[ii][jj].tint === DARK_TINT) {
                        let unit = cloneObj(bmap[ii][jj].creature)
                        affectUnit(unit, spell, targetPos)
                    }
                }
        }
    }

    function handleObstacleOver(e) {
        resetTint()
    }

    function handleMouseOver(e) {    
        resetTint()    
        let {x, y} = e.target.gamecoords
        let bmapCell = bmap[y][x]
        if (bmapCell.creature !== null) setDisplayedUnit(bmapCell.creature)
        if (isPlayersTurn) {
            if (!isCastingSpell) {
                if (bmapCell.type === 'terrain' && bmapCell.creature === null) {                    
                    let start = {i: currentUnit.y, j: currentUnit.x}
                    let finish = {i: y, j: x}
                    let path = findPath(start, finish, bmap)
                    setDistance(path[0].distance / 10)
                    tintPath(path)
                }
            }
            else {
                if (bmapCell.type === 'terrain' && visibleCells[y][x].tint === SHADOW_TINT) tintArea({i: y, j: x}, chosenSpell.area[0], chosenSpell.area[1], DARK_TINT, false)
            }
        }
    }

    function handleMouseDown(e) {
        let {x, y} = e.target.gamecoords
        let bmapCell = bmap[y][x]
        if (isPlayersTurn) {
            if (!isCastingSpell) {
                if (bmapCell.creature === null && currentUnit.MP >= distance) {
                    setCreatureStats(bmap[currentUnit.y][currentUnit.x].creature, 
                                    ['MP', 'x', 'y'], 
                                    [currentUnit.MP - distance, x, y],
                                    bmap, setBmap)
                    let unit = bmap[y][x].creature
                    setDisplayedUnit(unit)
                    resetTint()
                }
            }   
            else {
                if (bmapCell.type === 'terrain' && visibleCells[y][x].tint === SHADOW_TINT) {
                    if (currentUnit.AP < chosenSpell.apcost) return
                    else if (currentUnit.Mana < chosenSpell.manacost) return
                    else castSpell(currentUnit, {i: y, j: x}, chosenSpell)
                    //tintLine(drawLine(j, i, jj, ii, bmap), BRIGHT_TINT)//ТЕСТ ЛОС
                }
            }        
        }      
    }

    function AI_turn() {
        if (!creaturesQueue[currentUnitIndex] || creaturesQueue[currentUnitIndex].alignment !== 'enemy') return
        setTimeout(() => {
            if (creaturesQueue[currentUnitIndex + 1] && creaturesQueue[currentUnitIndex + 1].alignment === 'ally') setIsPlayersTurn(true)
            setCurrentUnitIndex(prevState => prevState + 1)
        }, 500)//имитация хода
        startTurn()
    }

    //пока только обновляет ОП и ОД, но надо, чтобы пробегалось по всем эффектам и с учетом их всех
    //модифицировало
    function startTurn() {
        if (creaturesQueue.length) {
            let curUnit = creaturesQueue[currentUnitIndex]
            setCreatureStats(bmap[curUnit.y][curUnit.x].creature, 
                ['AP', 'MP'], 
                [curUnit.maxAP, curUnit.maxMP],
                bmap, setBmap)
        }
    }

    function finishTurn() {
        if (!isPlayersTurn) return
        if (creaturesQueue[currentUnitIndex + 1] && creaturesQueue[currentUnitIndex + 1].alignment === 'enemy') setIsPlayersTurn(false)
        setCurrentUnitIndex(prevState => prevState + 1)
    }

    //сейчас переключает мод, но в будущем надо именно выбрать заклинание
    function chooseSpell() {
        setIsCastingSpell(prevState => !prevState)
    }

    function hoverQueueImg(id) {
        let unit = cloneObj(creaturesQueue[id])
        setDisplayedUnit(unit)
        setFocusedUnit({x: unit.x, y: unit.y})
    }

    //МЕДЛЕННЫЙ УЧАСТОК КОДА. ОБЪЕКТЫ ПЕРЕСОЗДАЮТСЯ МНОГО РАЗ
    let obstacles = []
    let terrains = []
    let allies = []
    let enemies = []

    let UID = 0//для генерации ключей
    bmap.forEach((row, i) => {
        row.forEach((item, j) => {            
            let x = tileSize * j;
            let y = tileSize * i;
            let gamecoords = {x: j, y: i}
            let subtype = item.subtype
            if (item.type === 'obstacle') {
                obstacles.push(<Sprite key={UID++} width={tileSize} height={tileSize} x={x} y={y} image={obstaclesArr[subtype]} gamecoords={gamecoords} interactive={true}
                                pointerover={handleObstacleOver}/>)
            }
            if (item.type === 'terrain') {
                let tintVal
                //если это ячейка с фокусом
                if (focusedUnit !== null && focusedUnit.x === j && focusedUnit.y === i) tintVal = FOCUS_TINT
                //иначе проверяем, является ли ячейка в обл-ти видимости
                else (aoeCells[i][j].tint === NO_TINT) ? tintVal = visibleCells[i][j].tint : tintVal = aoeCells[i][j].tint
                terrains.push(<Sprite key={UID++} width={tileSize} height={tileSize} x={x} y={y} image={terrainArr[subtype]} gamecoords={gamecoords} interactive={true} 
                                tint={tintVal}
                                pointerover={handleMouseOver}
                                pointerdown={handleMouseDown}/>)
            }
            if (item.creature !== null) {
                let creature = item.creature
                if (creature.side === 'ally') 
                    allies.push(<Sprite key={UID++} width={tileSize} height={tileSize} x={x} y={y} unitInfo={creature} image={creature.img}/>)
                else if (creature.side === 'enemy')
                    enemies.push(<Sprite key={UID++} width={tileSize} height={tileSize} x={x} y={y} unitInfo={creature} image={creature.img}/>)
            }
        })
    })

    return(
        <>
        {battleDataLoaded ? 
            <div tabIndex={0} className="battle">
                <div className="left">                   
                    <BattleField battleObjects={{obstacles, terrains, allies, enemies}}/>
                </div>
                <BattleMenu displayedUnit={displayedUnit}
                            creaturesQueue={creaturesQueue}
                            currentTurn={currentTurn}
                            finishTurn={finishTurn}
                            chooseSpell={chooseSpell}
                            hoverQueueImg={hoverQueueImg}
                            removeFocus={()=>setFocusedUnit(null)}/>
            </div> :
            <div></div>
        }  
        </>    
    )
}