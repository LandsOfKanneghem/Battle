import React from "react"
import '../styles/styles.css'
import '../styles/terrain.css'

import * as PIXI from "pixi.js";
import { Stage, Container, Sprite } from '@pixi/react';


export default function BattleField(props) {
    let {obstacles, terrains, allies, enemies} = props.battleObjects;

    return(
        <div className="battle--field">
            <Stage width={750} height={550}>
                <Container>
                    {obstacles}
                    {terrains}
                    {allies}
                    {enemies}
                </Container>
            </Stage>
        </div>
    )
}