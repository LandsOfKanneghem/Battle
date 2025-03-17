export function initBattle(battleID) {
    let btMap = battleID.battleMap
    let creatures = [...battleID.allies, ...battleID.enemies]

    //матрица объектов, координаты объекта соответствуют координате на боевой карте
    //объекты выглядят след. образом: {рельеф, существо, поверхность}
    let btMapH = btMap.length;
    let btMapW = btMap[0].length;   
    let battleMapInfo = new Array(btMapH);
    for (let i = 0; i < btMapH; i++) battleMapInfo[i] = new Array(btMapW);

    //записываем в каждую ячейку значение поверхности в координате
    for (let y = 0; y < btMapW; y++) {
        for (let x = 0; x < btMapH; x++) {
            battleMapInfo[x][y] = {terrain: btMap[x][y], creature: null, surface: null}
        }
    }

    //записываем в матрицу информацию о с-вах
    for (let i = 0; i < creatures.length; i++) {    
        let creature = creatures[i];
        let x = creature.x;
        let y = creature.y;
        battleMapInfo[x][y].creature = creature;
    }

    return battleMapInfo;
}


export function startBattle(allies, enemies, creatures, setCreaturesQueue, playersTurn, setPlayersTurn, setTurns) {
    //ход игрока
    let currentUnitIndex = 0;
    let maxUnitIndex = Math.max(allies.length, enemies.length);
    if (playersTurn) {
//        setPlayersTurn(prevState => !prevState)
    } 
    //ход ИИ
    else {
//        setPlayersTurn(prevState => !prevState)
    }
//    setTurns(prevState => prevState + 1)

    //1 - игрок, 0 - ИИ
    let firstUnit = (creatures[allies[0]].IP >= creatures[enemies[0]].IP ? 1 : 0)
    let creaturesQueue = []//очередь существ

    for (let i = 0; i < maxUnitIndex; i++) {
        if (firstUnit) {
            if (i < allies.length) creaturesQueue.push(allies[i])
            if (i < enemies.length) creaturesQueue.push(enemies[i])
        }
        else {
            if (i < enemies.length) creaturesQueue.push(enemies[i])
            if (i < allies.length) creaturesQueue.push(allies[i])
        }
    }
    setCreaturesQueue(creaturesQueue)
}

export function setPos(curId, prevPos, newPos, creature, setCreatures, setTargetCreture, battleMapInfo, setBattleMapInfo) {
    let {x, y} = newPos;
    if (battleMapInfo[x][y].creature === null && battleMapInfo[x][y].terrain >= 100) {
        setCreatures(prevState => {
            let newState = {...prevState, [curId]: {...prevState[curId], x: newPos.x, y: newPos.y, MP: prevState[curId].MP - 1}}
            setTargetCreture(newState[curId])
            battleMapInfo[prevPos.x][prevPos.y].creature = null;
            battleMapInfo[x][y].creature = newState[curId];
            setBattleMapInfo(battleMapInfo)
            return newState
        })     
        
    }   
}

export function setCreatureStats(unit, statsArr, valuesArr, bmap, setBmap) {
    let newBmap = bmap.map(arr => arr.slice())
    let newUnit = JSON.parse(JSON.stringify(unit))             
    statsArr.forEach((stat, index) => newUnit[stat] = valuesArr[index]);
    newBmap[unit.y][unit.x].creature = null
    newBmap[newUnit.y][newUnit.x].creature = newUnit
    setBmap(newBmap)
}

export function initCreatures(arr) {
    let creatures = {}
    arr.map(item => creatures[item.id] = item)
    return creatures;
}