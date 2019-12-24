import React, {Component} from 'react';
import {Table} from 'semantic-ui-react'
import axios from 'axios'

async function queryCalendar(){
    axios.get('http://127.0.0.1:5000/api/gettimes').then(async res => {
        console.log(res.data)
        return await res.data 
    })
}

class WeeklyTable extends Component {
    constructor(){
        super()
        this.state = {
            times: []
        }
    }
    componentDidMount(){
        axios.get('http://127.0.0.1:5000/api/gettimes')
        .then(res => {
            return res.data 
        }).then(data => {
            console.log(data)
            let categories = data.map((category) => {
                return (
                    <Table.Row>
                        <Table.Cell>{category.id}</Table.Cell>
                        <Table.Cell>{category.name}</Table.Cell>
                        <Table.Cell>{category.time}</Table.Cell>
                    </Table.Row>
                )
            })
            this.setState({categories: categories});
        })
    }
    render(){
        return (
            <Table celled>
            <Table.Header>
            <Table.Row>
                <Table.HeaderCell>ID</Table.HeaderCell>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Time</Table.HeaderCell>
            </Table.Row>
            </Table.Header>
            <Table.Body>
                {this.state.categories}
            </Table.Body>
        </Table>
        )
    }
}

export default WeeklyTable;
