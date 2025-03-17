import React from "react"
import '../styles/styles.css'
import BattleQueue from './BattleQueue'

import phys from './game resources/img/logo/phys-logo.png';
import air from './game resources/img/logo/air-logo.png';
import water from './game resources/img/logo/water-logo.png';
import fire from './game resources/img/logo/fire-logo.png';
import earth from './game resources/img/logo/earth-logo.png';
import light from './game resources/img/logo/light-logo.png';
import dark from './game resources/img/logo/dark-logo.png';


export default function BattleMenu(props) {
    let info = props.displayedUnit
    let {name, img,
        HP, maxHP, Mana, maxMana, WP, maxWP, AP, MP, IP,
        vit, wis, str, agi, int, will, ini,
        physRes, waterRes, fireRes, airRes, earthRes, lightRes, darkRes,
        x, y, states} = info   

    function makeLogo(img) {
        return <img className="battle--creature-info--logo" src={img} alt=""/>
    }

    return(
        <div className="battle--menu">
            <button className="battle--button" onClick={props.finishTurn}>Передать ход</button>
            <button className="battle--button" onClick={props.chooseSpell}>Заклинание</button>
            <div className="battle--creature-info">
                <div>{name}</div>
                <img className="battle--creature-info--img" src={img} alt=""/>
                <table id="main-stats">
                    <thead><tr><th>HP</th><th>Mana</th><th>WP</th><th>AP</th><th>MP</th><th>IP</th></tr></thead>
                    <tbody><tr><td>{HP}/{maxHP}</td><td>{Mana}/{maxMana}</td><td>{WP}/{maxWP}</td><td>{AP}</td><td>{MP}</td><td>{IP}</td></tr></tbody>
                </table>

                <table id="characteristics">
                    <thead><tr><th>Vit</th><th>Wis</th><th>Str</th><th>Agi</th><th>Int</th><th>Wil</th><th>Ini</th></tr></thead>
                    <tbody><tr><td>{vit}</td><td>{wis}</td><td>{str}</td><td>{agi}</td><td>{int}</td><td>{will}</td><td>{ini}</td></tr></tbody>
                </table>

                <table id="resistances">
                    <thead><tr><th>{makeLogo(phys)}</th><th>{makeLogo(water)}</th><th>{makeLogo(fire)}</th><th>{makeLogo(air)}</th><th>{makeLogo(earth)}</th><th>{makeLogo(light)}</th><th>{makeLogo(dark)}</th></tr></thead>
                    <tbody><tr><td>{physRes}%</td><td>{waterRes}%</td><td>{fireRes}%</td><td>{airRes}%</td><td>{earthRes}%</td><td>{lightRes}%</td><td>{darkRes}%</td></tr></tbody>
                </table>   
                <span>x: {x}, y: {y}, turn: {props.currentTurn}</span>       
            </div>
            <BattleQueue creaturesQueue={props.creaturesQueue} hoverQueueImg={props.hoverQueueImg} removeFocus={props.removeFocus}/>
        </div>
    )
}