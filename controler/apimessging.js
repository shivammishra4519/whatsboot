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
        
        if (!token || !number || !message) {
            return res.status(400).json({ message: "Required parameters are missing" });
        }

        const db = getDB();
        const tokenCollection = db.collection('ipTokens');
        const messageCollection = db.collection('sendedmessages');

        const userInfo = await tokenCollection.findOne({ encodedData: token });
        if (!userInfo) {
            return res.status(400).json({ message: "Invalid token" });
        }

        console.log("req ip begfore",req.ip)

        // const ip = req.ip.replace(/^::ffff:/, "");
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const decodedData = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
        console.log("req ip",ip)
        console.log("db ip",decodedData.ip)
        if (ip !== decodedData.ip) {
            return res.status(400).json({ message: "IP is not listed" });
        }

        const sessionId = userInfo.username;
        const client = sessionsArray[sessionId];

        if (!client) {
            return res.status(404).json({ error: 'Session not found or not authenticated' });
        }

        const to = `91${number}@c.us`;

        const sendMessageWithRetry = async (retryCount = 3) => {
            try {
                const response = await client.sendMessage(to, message);
                
                // Save the message to the database
                await messageCollection.updateOne(
                    { username: sessionId },
                    { $push: { messages: { to, message, timestamp: new Date(), ip } } },
                    { upsert: true }
                );

                return res.status(200).json({ success: true, response });
            } catch (err) {
                if (retryCount > 0) {
                    console.warn(`Retrying sendMessage (${retryCount} retries left)...`);
                    return sendMessageWithRetry(retryCount - 1);
                } else {
                    console.error('Failed to send message after retries:', err);
                    return res.status(500).json({ error: 'Failed to send message after retries' });
                }
            }
        };

        await sendMessageWithRetry();

    } catch (error) {
        console.error('Error in sendSingleMessage:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};



module.exports = { sendSingleMessage }