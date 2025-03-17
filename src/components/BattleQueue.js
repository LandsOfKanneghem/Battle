import React from "react"
import '../styles/styles.css'


export default function BattleQueue(props) {
    let unitList = props.creaturesQueue.map((item, index) => {
        return <BattleQueueItem key={index} img={item.img} id={index} 
                                hoverQueueImg={props.hoverQueueImg}
                                removeFocus={props.removeFocus}/>
    })
    
    return(
        <div className="battle--queue">
            {unitList}
        </div>
    )
}

function BattleQueueItem(props) {
    return(
        <img className="battle--queue--img" src={props.img} alt=""
             onMouseOver={() => props.hoverQueueImg(props.id)}
             onMouseLeave={() => props.removeFocus()}/>
    )
}