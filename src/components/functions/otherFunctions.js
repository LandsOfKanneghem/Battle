//возвращает случайное число
export function getRandomValue(min, max) {
    max += 1//иначе max не входит в диапазон
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min) + min)
}

//создание и инициализация матрицы
export function createMatrix(rows, cols, initValue) {
    let matrix = new Array(rows)
    if (typeof(initValue) !== 'object') {
        for (let i = 0; i < rows; i++) {
            matrix[i] = new Array(cols)
            for (let j = 0; j < cols; j++) matrix[i][j] = initValue
        }
    }
    else {
        for (let i = 0; i < rows; i++) {
            matrix[i] = new Array(cols)
            for (let j = 0; j < cols; j++) matrix[i][j] = JSON.parse(JSON.stringify(initValue)) 
        }
    }
    return matrix
}

//клонирование объекта
export function cloneObj(obj) {
    return JSON.parse(JSON.stringify(obj))
}

//расчет диаметра закрашиваемой обл-ти, начальной и конечной позиций
export function countArea(i, j, radius, rows, cols) {
    let diameter = 2 * radius + 1//диаметр закрашиваемой зоны
    //start - начальная точка, delta - вычитаем из радиуса, если уперлись в край карты
    let startI, startJ, deltaI = 0, deltaJ = 0
    if (i - radius < 0) {startI = 0; deltaI = radius - i;} 
    else startI = i - radius
    if (j - radius < 0) {startJ = 0; deltaJ = radius - j;} 
    else startJ = j - radius
    let finishI = (startI + diameter > rows - 1) ? rows - 1 : startI + diameter - deltaI
    let finishJ = (startJ + diameter > cols - 1) ? cols - 1 : startJ + diameter - deltaJ
    return {startI, startJ, finishI, finishJ}
}