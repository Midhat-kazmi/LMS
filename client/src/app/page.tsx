'use client'

import React, {FC, useState} from "react"
import Heading from "./utils/Heading"
interface Props{}

const Page: FC <Props> =(props) =>{
    return(

        <div>
          <Heading 
            title="Elearning"
            description="Best Platform"
            keywords = "Programing, MERN, REDUX"
          
          />
        </div>
    )
}

export default Page