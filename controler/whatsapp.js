const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const jwt = require('jsonwebtoken');
const qrcode = require('qrcode');
const { getDB } = require('../dbConnection'); // Assuming you have a db.js file for MongoDB connection

const sessions = {};


const deleteSessionFolder = async (sessionId) => {
//     try {
//         const sessionPath = path.join(__dirname, 'sessions', sessionId);
//         console.log(`Deleting folder at path: ${sessionPath}`);
//   // Remove the folder and its contents
//   await fs.rm(sessionPath, { recursive: true, force: true });

//   console.log(`Folder deleted successfully: ${sessionPath}`);
// } catch (error) {
//   console.error(`Error deleting folder: ${error.message}`);
// }
};

const loginWhatsapp = async (req, res) => {
    try {
        const authHeader = req.header('Authorization');
        const token = req.cookies.auth_token || (authHeader && authHeader.replace('Bearer ', ''));

        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        const secretKey = process.env.JWT_SECRET || 'whatsapp'; 
        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (err) {
            console.log(err);
            return res.status(400).json({ message: 'Invalid token.' });
        }

        const sessionId = decoded.number;
        console.log(`Session ID: ${sessionId}`);
        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
        }

        // Delete existing session if it exists
        await deleteSessionFolder(sessionId);

        const sessionPath = path.join(__dirname, 'sessions', sessionId);
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: sessionId,
                dataPath: sessionPath,
            }),
        });

        client.on('qr', async (qr) => {
            console.log('QR Code received');
            const qrCodeImagePath = path.join(sessionPath, `${sessionId}.png`);

            try {
                await qrcode.toFile(qrCodeImagePath, qr, { width: 300 });

                if (!res.headersSent) {
                    res.sendFile(qrCodeImagePath, (err) => {
                        if (err) {
                            console.error('Error sending QR code image:', err);
                            if (!res.headersSent) {
                                res.status(500).json({ error: 'Failed to send QR code image' });
                            }
                        } else {
                            console.log('QR code image sent successfully!');
                        }
                    });
                }
            } catch (error) {
                console.error('Error generating QR code:', error);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to generate QR code' });
                }
            }
        });

        client.on('ready', async () => {
            console.log(`${sessionId} is ready!`);
            try {
                const db = getDB();
                await db.collection('sessions').updateOne(
                    { sessionId },
                    { $set: { status: 'ready' } },
                    { upsert: true }
                );
                sessions[sessionId] = client;
            } catch (error) {
                console.error('Error updating session status:', error);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to update session status' });
                }
            }
        });

        client.on('disconnected', reason => {
            console.error(`Client disconnected: ${reason}`);
            // Optionally, clean up session data here
        });

        client.on('error', error => {
            console.error('Client encountered an error:', error);
        });

        client.initialize();
    } catch (error) {
        console.error('Error in loginWhatsapp:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};









const sendMessage = async (req, res) => {
    try {
        const { sessionId, to, message } = req.body;

        if (!sessionId || !to || !message) {
            return res.status(400).json({ error: 'sessionId, to, and message are required' });
        }

        const client = sessions[sessionId];

        if (!client) {
            return res.status(404).json({ error: 'Session not found or not authenticated' });
        }

        const chatId = `${to}@c.us`; // Append @c.us for regular WhatsApp numbers

        try {
            const response = await client.sendMessage(chatId, message);
            console.log(`Message sent to ${to}: ${message}`);
            res.status(200).json({ success: true, response });
        } catch (err) {
            console.error('Error sending message:', err);
            res.status(500).json({ error: 'Failed to send message' });
        }
    } catch (error) {
        console.error('Error in sendMessage:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const isLoggedIn = async (req, res) => {
    try {
        const { sessionId } = req.body;
        console.log(`Checking session ID: ${sessionId}`);

        if (!sessionId) {
            return res.status(400).json({ message: 'sessionId is required' });
        }

        // Access the database and find the session
        const db = getDB();
        const collection = db.collection('sessions');
        const result = await collection.findOne({ sessionId });

        if (!result) {
            return res.status(400).json({ message: 'Session not found' });
        }

        const status = result.status;

        // Check if session is in 'ready' state
        if (status == 'ready') {
            // Check if the client instance exists
            const client = sessions[sessionId];
            if (client) {
                // Optionally, check if the client is authenticated
                return res.status(200).json({ message: 'You are logged in successfully' });
            } else {
                // Session data exists but client instance is not found
                return res.status(400).json({ message: 'Session is not active' });
            }
        }

        return res.status(400).json({ message: 'Session is not ready' });
    } catch (error) {
        console.error('Error in isLoggedIn:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};



const sendQuickMessage = async (req, res) => {
    try {
        // Extract the token from the Authorization header or cookies
        const authHeader = req.header('Authorization');
        const token = req.cookies.auth_token || (authHeader && authHeader.replace('Bearer ', ''));

        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        // Verify the token
        const secretKey = process.env.JWT_SECRET || 'whatsapp'; // Use an environment variable for the secret key
        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (err) {
            console.log(err);
            return res.status(400).json({ message: 'Invalid token.' });
        }

        const username = decoded.number; // Use the sessionId as the username
        const { to, message } = req.body;

        if (!username || !to || !message) {
            return res.status(400).json({ error: 'username, to, and message are required' });
        }

        const client = sessions[username];
       

        if (!client) {
            return res.status(404).json({ error: 'Session not found or not authenticated' });
        }
        client.on('ready', async () => { });
        client.on('authenticated', () => {
            console.log(`${sessionId} authenticated!`);
        });
        const chatId = `91${to}@c.us`; // Append @c.us for regular WhatsApp numbers

        try {
            const response = await client.sendMessage(chatId, message);
            console.log(`Message sent to ${to}: ${message}`);

            // Save the message to the database
            const db = getDB();
            const collection = db.collection('sendedmessages');
            const ip = req.ip
            await collection.updateOne(
                { username }, // Find the document by username
                { $push: { messages: { to, message, timestamp: new Date(), ip } } }, // Add the message object to the existing messages array
                { upsert: true } // Create the document if it doesn't exist
            );

            res.status(200).json({ success: true, response });
        } catch (err) {
            console.error('Error sending message:', err);
            res.status(500).json({ error: 'Failed to send message' });
        }
    } catch (error) {
        console.error('Error in sendQuickMessage:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const sendQuickMessageMulti = async (req, res) => {
    try {
        // Extract the token from the Authorization header or cookies
        const authHeader = req.header('Authorization');
        const token = req.cookies.auth_token || (authHeader && authHeader.replace('Bearer ', ''));

        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        // Verify the token
        const secretKey = process.env.JWT_SECRET || 'whatsapp'; // Use an environment variable for the secret key
        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (err) {
            console.log(err);
            return res.status(400).json({ message: 'Invalid token.' });
        }

        const username = decoded.number; // Use the sessionId as the username
        const { to, message } = req.body;

        if (!username || !to || !message) {
            return res.status(400).json({ error: 'username, to, and message are required' });
        }

        const client = sessions[username];
        

        if (!client) {
            return res.status(404).json({ error: 'Session not found or not authenticated' });
        }

        // Split the 'to' string by commas to get an array of numbers
        const numbers = to.split(',');

        // Initialize an array to store the results of sending messages
        const sendResults = [];

        for (let number of numbers) {
            const chatId = `91${number.trim()}@c.us`; // Append @c.us for regular WhatsApp numbers

            try {
                const response = await client.sendMessage(chatId, message);
                console.log(`Message sent to ${number.trim()}: ${message}`);

                // Save the message to the database
                const db = getDB();
                const collection = db.collection('sendedmessages');
                const ip = req.ip;

                await collection.updateOne(
                    { username }, // Find the document by username
                    { $push: { messages: { to: number.trim(), message, timestamp: new Date(), ip } } }, // Add the message object to the existing messages array
                    { upsert: true } // Create the document if it doesn't exist
                );

                sendResults.push({ number: number.trim(), success: true, response });
            } catch (err) {
                console.error(`Error sending message to ${number.trim()}:`, err);
                sendResults.push({ number: number.trim(), success: false, error: 'Failed to send message' });
            }
        }

        res.status(200).json({ success: true, results: sendResults });
    } catch (error) {
        console.error('Error in sendQuickMessage:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


module.exports = { loginWhatsapp, sendMessage, isLoggedIn, sendQuickMessage, sendQuickMessageMulti, sessions };
