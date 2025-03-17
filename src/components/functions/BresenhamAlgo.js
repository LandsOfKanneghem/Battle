//ВАЖНО!!!
//надо передавать именно [x][y], а не [i][j]

//ЭТА ВЕРСИЯ ЗАХВАТЫВАЕТ ПРЕПЯТСТВИЯ, В КОТОРЫЕ ВРЕЗАЕТСЯ
//(сделано, для того, чтобы с-ва находились в обл-ти видимости закла, а не считались препятствием)
export function drawLine(x1, y1, x2, y2, bmap) {
    let deltaX = Math.abs(x2 - x1)
    let deltaY = Math.abs(y2 - y1)
    let signX = x1 < x2 ? 1 : -1
    let signY = y1 < y2 ? 1 : -1
    let error = deltaX - deltaY, error2
    let LOS = []   
    LOS.push({i: y1, j: x1})

    //если конечная цель находится ровно по диагонали и на пути нет препятствий - мы ее видим
    if (deltaX === deltaY) {
        while(x1 !== x2 || y1 !== y2) {
            x1 += signX;
            y1 += signY;
            if (bmap[y1][x1].type === 'obstacle' || bmap[y1][x1].creature !== null) {
                LOS.push({i: y1, j: x1})
                return LOS
            } else LOS.push({i: y1, j: x1})
        }
        if (bmap[y2][x2].type === 'obstacle' || bmap[y2][x2].creature !== null) {
            LOS.push({i: y2, j: x2})
            return LOS
        } else LOS.push({i: y2, j: x2})
        return LOS
    }
   
    let prevX = x1, prevY = y1;
    error2 = error * 2;
    if(error2 > -deltaY) {
        error -= deltaY;
        x1 += signX;
    }
    if(error2 < deltaX) {
        error += deltaX;
        y1 += signY;
    }     
    //если есть переход по диагонали - проверяем, стоят ли препятствия рядом с переходом
    if (Math.abs(x1 - prevX) === 1 && Math.abs(y1 - prevY)) {
        if (bmap[prevY + signY][prevX].type === 'obstacle' || 
            bmap[prevY + signY][prevX].creature !== null ||
            bmap[prevY][prevX + signX].type === 'obstacle' || 
            bmap[prevY][prevX + signX].creature !== null) {
                return LOS
            }
    }
    while(x1 !== x2 || y1 !== y2) {
        if (bmap[y1][x1].type === 'obstacle' || bmap[y1][x1].creature !== null) {
            LOS.push({i: y1, j: x1})
            return LOS
        } else LOS.push({i: y1, j: x1})
        prevX = x1;
        prevY = y1;
        error2 = error * 2;
        if(error2 > -deltaY) {
            error -= deltaY;
            x1 += signX;
        }
        if(error2 < deltaX) {
            error += deltaX;
            y1 += signY;
        }
        //если есть переход по диагонали - проверяем, стоят ли препятствия рядом с переходом
        if (Math.abs(x1 - prevX) === 1 && Math.abs(y1 - prevY)) {
            if (bmap[prevY + signY][prevX].type === 'obstacle' || 
                bmap[prevY + signY][prevX].creature !== null ||
                bmap[prevY][prevX + signX].type === 'obstacle' || 
                bmap[prevY][prevX + signX].creature !== null) {
                    return LOS
                }
        }
        
    }
    if (bmap[y2][x2].type === 'obstacle' || bmap[y2][x2].creature !== null) {
        LOS.push({i: y2, j: x2})
        return LOS
    } else LOS.push({i: y2, j: x2})
    return LOS
}



//эта версия НЕ захватывает препятствия (например, исп-ся в заклинании Вакуум)
export function drawLine2(x1, y1, x2, y2, bmap) {
    let deltaX = Math.abs(x2 - x1)
    let deltaY = Math.abs(y2 - y1)
    let signX = x1 < x2 ? 1 : -1
    let signY = y1 < y2 ? 1 : -1
    let error = deltaX - deltaY, error2
    let LOS = []   
    LOS.push({i: y1, j: x1})

    //если конечная цель находится ровно по диагонали и на пути нет препятствий - мы ее видим
    if (deltaX === deltaY) {
        while(x1 !== x2 || y1 !== y2) {
            x1 += signX;
            y1 += signY;
            if (bmap[y1][x1].type === 'obstacle' || bmap[y1][x1].creature !== null) {
                return LOS
            } else LOS.push({i: y1, j: x1})
        }
        if (bmap[y2][x2].type === 'obstacle' || bmap[y2][x2].creature !== null) {
            return LOS
        } else LOS.push({i: y2, j: x2})
        return LOS
    }
   

    let prevX = x1, prevY = y1;
    error2 = error * 2;
    if(error2 > -deltaY) {
        error -= deltaY;
        x1 += signX;
    }
    if(error2 < deltaX) {
        error += deltaX;
        y1 += signY;
    }     
    //если есть переход по диагонали - проверяем, стоят ли препятствия рядом с переходом
    if (Math.abs(x1 - prevX) === 1 && Math.abs(y1 - prevY)) {
        if (bmap[prevY + signY][prevX].type === 'obstacle' || 
            bmap[prevY + signY][prevX].creature !== null ||
            bmap[prevY][prevX + signX].type === 'obstacle' || 
            bmap[prevY][prevX + signX].creature !== null) {
                return LOS
            }
    }
    while(x1 !== x2 || y1 !== y2) {
        if (bmap[y1][x1].type === 'obstacle' || bmap[y1][x1].creature !== null) {
            return LOS
        } else LOS.push({i: y1, j: x1})
        prevX = x1;
        prevY = y1;
        error2 = error * 2;
        if(error2 > -deltaY) {
            error -= deltaY;
            x1 += signX;
        }
        if(error2 < deltaX) {
            error += deltaX;
            y1 += signY;
        }
        //если есть переход по диагонали - проверяем, стоят ли препятствия рядом с переходом
        if (Math.abs(x1 - prevX) === 1 && Math.abs(y1 - prevY)) {
            if (bmap[prevY + signY][prevX].type === 'obstacle' || 
                bmap[prevY + signY][prevX].creature !== null ||
                bmap[prevY][prevX + signX].type === 'obstacle' || 
                bmap[prevY][prevX + signX].creature !== null) {
                    return LOS
                }
        }
        
    }
    if (bmap[y2][x2].type === 'obstacle' || bmap[y2][x2].creature !== null) {
        return LOS
    } else LOS.push({i: y2, j: x2})
    return LOS
}