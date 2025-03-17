import { createMatrix } from "./otherFunctions"
import { PriorityQueue } from "./PriorityQueue"

function manhattanDistance(i1, j1, i2, j2) {
    return (Math.abs(i2 - i1) + Math.abs(j2 - j1)) * 10
}

//считает информацию для соседней клетки с координатами (ni, nj)
function processCell(ni, nj, i, j, finish, f, g, h, mc, parents, processed, occupied, neighbours) {
    if (!occupied[ni][nj] && !processed[ni][nj] && ni > 0 && nj > 0) {
        if (g[i][j] + mc[ni][nj] < g[ni][nj]) {
            g[ni][nj] = g[i][j] + mc[ni][nj]//не +10, а зависит от типа местности, м.б. разный штраф
            parents[ni][nj] = {i, j}
        }                 
        h[ni][nj] = manhattanDistance(ni, nj, finish.i, finish.j)
        f[ni][nj] = g[ni][nj] + h[ni][nj]
        neighbours.push({i: ni, j: nj, f: f[ni][nj]})
    } else return
}

//алгоритм А*
export function findPath(start, finish, map) {
    let m = map.length, n = map[0].length//кол-во строк и столбцов
    let INF = 888888//бесконечно большое число
    let f = createMatrix(m, n, 0)//g + h
    let g = createMatrix(m, n, INF)//кол-во шагов до текущей клетки
    let h = createMatrix(m, n, 0)//эвристическая ф-ия, в нашем случае - Манхэттэнское расстояние
    let mc = createMatrix(m, n, 0)//хранит в [i][j] стоимость шага по этой местности
    let parents = createMatrix(m, n, null)//хранит в [i][j] ячейку, откуда мы пришли сюда
    let processed = createMatrix(m, n, false)//обработанные клетки
    let occupied = createMatrix(m, n, false)//занятые клетки (препятствием или с-вом)
    for (let i = 0; i < map.length; i++)
        for (let j = 0; j < map[0].length; j++) {
            if (map[i][j].type === 'obstacle' || map[i][j].creature !== null) occupied[i][j] = true
            mc[i][j] = map[i][j].moveCost
        }
    mc[start.i][start.j] = 0//в исходную клетку идти не надо
            
    let neighbours = new PriorityQueue()

    //ищем путь
    let i = start.i, j = start.j, nextCell
    h[i][j] = manhattanDistance(i, j, finish.i, finish.j)
    g[i][j] = 0
    processed[i][j] = true
    while (true) {
        processCell(i + 1, j, i, j, finish, f, g, h, mc, parents, processed, occupied, neighbours)
        processCell(i, j + 1, i, j, finish, f, g, h, mc, parents, processed, occupied, neighbours)
        processCell(i - 1, j, i, j, finish, f, g, h, mc, parents, processed, occupied, neighbours)
        processCell(i, j - 1, i, j, finish, f, g, h, mc, parents, processed, occupied, neighbours)
        processed[i][j] = true
        nextCell = neighbours.extractMin()               
        i = nextCell.i
        j = nextCell.j
        if (nextCell.i === finish.i && nextCell.j === finish.j) break            
    }

    //выводим путь
    let path = []
    let curCell = {i: nextCell.i, j: nextCell.j, distance: g[nextCell.i][nextCell.j]}
    while (!(curCell.i === start.i && curCell.j === start.j)) {
        path.push(curCell)
        let {i: pi, j: pj} = parents[i][j]//координаты родителя
        curCell = {i: pi, j: pj, distance: g[pi][pj]}
        i = curCell.i
        j = curCell.j
    } 
    path.push(curCell)
    return path
}