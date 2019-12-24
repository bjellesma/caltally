import React from 'react';
import {Container} from 'semantic-ui-react'
import WeeklyTable from './components/WeeklyTable'
import 'semantic-ui-css/semantic.min.css'
import axios from 'axios'

async function getCategories(){
  let res = await axios.get('http://127.0.0.1:5000/api/gettimes')
  return res.data
}

const App = () => {
  
  let categories = getCategories()
  console.log(categories)
  // const categories = [
  //   {
  //     "id": 2,
  //     "name": "bill",
  //     "time": "17:00"
  //   },
  //   {
  //     "id": 1,
  //     "name": "ned",
  //     "time": "15:00"
  //   }
  // ]
  return (
    <Container>
      <WeeklyTable categories={{categories}} />
    </Container>
  );
}

export default App;
