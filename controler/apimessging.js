const { getDB } = require('../dbConnection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const axios = require('axios')
const { sessions } = require('./whatsapp')
require('dotenv').config();


const sessionsArray = sessions;

const sendSingleMessage = async (req, res) => {
    try {
        const data = req.query;
        const token = data.token;
        const number = data.number;
        const message = data.message;
        if (!token) {
            return res.status(400).json({ message: "Can not Found Token" });
        }
        if (!number) {
            return res.status(400).json({ message: "Number can not be blank" });
        }
        if (!message) {
            return res.status(400).json({ message: "Message can not be Blank" });
        }
        const db = getDB();
        const collection = db.collection('soldPlans');
        const tokenCollection = db.collection('ipTokens');
        const userInfo = await tokenCollection.findOne({ encodedData: token });
      
        if (!userInfo) {
            return res.status(400).json({ message: "Invalid token" });
        }
        const ip = req.ip;
       

        const decodedData = Buffer.from(token, 'base64').toString('utf8');
        const parsedData = JSON.parse(decodedData);
        // if (userInfo.token == parsedData.tk) {
        //     return res.status(400).json({ message: "Invalid Token" });
        // }
        const sessionId = userInfo.username;
        const client = sessionsArray[sessionId];
        console.log(client)
        if (!client) {
            return res.status(404).json({ error: 'Session not found or not authenticated12' });
        }
        const to = `91${number}@c.us`;

        try {
            const response = await client.sendMessage(to, message);
           
            res.status(200).json({ success: true, response });
        } catch (err) {
            console.error('Error sending message:', err);
            res.status(500).json({ error: 'Failed to send message' });
        }


    } catch (error) {
        console.error('Error in addAnswer:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}

module.exports = { sendSingleMessage }