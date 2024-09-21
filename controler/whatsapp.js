const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const jwt = require('jsonwebtoken');
const qrcode = require('qrcode');
const { getDB } = require('../dbConnection'); // Assuming you have a db.js file for MongoDB connection
require('dotenv').config();

const executablePath = process.env.executablePath;
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
const deleteWithRetry = (filePath, retries = 5, delay = 1000) => {
    if (retries === 0) {
        console.error(`Failed to delete: ${filePath} after multiple attempts`);
        return;
    }

    try {
        fs.rmSync(filePath, { recursive: true, force: true });
        console.log(`Deleted session files at: ${filePath}`);
    } catch (err) {
        if (err.code === 'EPERM') {
            console.log(`File in use, retrying in ${delay / 1000} seconds...`);
            setTimeout(() => deleteWithRetry(filePath, retries - 1, delay), delay);
        } else {
            console.error(`Error deleting session files:`, err);
        }
    }
};

const deleteUserSessionFiles = (userId) => {
    const userSessionPath = path.join(__dirname, 'sessions', userId);

    if (fs.existsSync(userSessionPath)) {
        deleteWithRetry(userSessionPath);
    } else {
        console.log(`No session files found for user ${userId}.`);
    }
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
       deleteUserSessionFiles(sessionId);
       delete sessions[sessionId];
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
            }), puppeteer: {
                 executablePath,
               headless:true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            },
        });

        client.on('qr', async (qr) => {
            console.log('QR Code received', qr);
            console.log("sessions",sessions)
            const qrCodeImagePath = path.join(sessionPath, `${sessionId}.png`);

            try {
                await qrcode.toFile(qrCodeImagePath, qr, { width: 150 });

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
            const userId = client.info.wid._serialized; // WhatsApp ID of the logged-in user
            const pushName = client.info.pushname; // User's name
            const platform = client.info.platform; // Platform of the logged-in user
        
            console.log('Logged-in user details:');
            console.log('User ID:', userId);
            console.log('User Name:', pushName);
            console.log('Platform:', platform);
            
            try {
                const db = getDB();
                await db.collection('sessions').updateOne(
                    { sessionId },
                    { $set: { status: 'connected' ,username:pushName,platform,userId} },
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
        client.on('message', async (msg) => {

            const phoneNumber = msg.to;
            const cleanedPhoneNumber = phoneNumber.replace('@c.us', '');
        
            let messageType = 'text';
            let mediaUrl = null;
        
            if (msg.hasMedia) {
                const media = await msg.downloadMedia();
                messageType = msg.type; // Set the message type to image, document, etc.
                
                // Save the media file and set the media URL (this part should be implemented as per your storage logic)
            }
        
            try {
                const db = getDB();
                const soldPlanCollection = db.collection('soldPlans');
                let username = cleanedPhoneNumber;
        
                // Remove the first '91' if it exists
                if (phoneNumber.startsWith('91')) {
                    username = cleanedPhoneNumber.slice(2);
                }
        
                const planResult = await soldPlanCollection.findOne({ username });
              
                if (planResult) {
                    const plan = planResult.plans[0].plan;
        
                    if (plan && plan.autoReplay === 'yes') {
                        const autoreplyCollection = db.collection('autoreply');
                        const autoreplyResult = await autoreplyCollection.findOne({ username });
        
                        if (autoreplyResult) {
                            const sanitizedMessage = msg.body.trim().replace(/\s+/g, ' ').toLowerCase();
                            const objectArray = autoreplyResult.answers; // Assuming answers are stored in autoreplyResult
                            const messageResult = objectArray.find(obj => obj.message === sanitizedMessage);
        
                            if (messageResult) {
                                const answer = messageResult.answer;
                                // Send the reply message
                                await client.sendMessage(msg.from, answer); // Corrected to msg.from
                            }
                        }
                    }
                }
        
            } catch (error) {
                console.error('Error processing auto-reply:', error);
            }
        
            try {
                const db = getDB();
                const receivedMessagesCollection = db.collection('receivedmessages');
        
                // Structure the message data
                const messageData = {
                    from: msg.from,        // Sender's number
                    body: msg.body || '',  // Message content (could be empty if it's an image)
                    type: messageType,     // Message type (text, image, etc.)
                    timestamp: new Date(), // Timestamp of the message
                };
        
                // Store the message under the corresponding username/sessionId
                await receivedMessagesCollection.updateOne(
                    { username: cleanedPhoneNumber }, // Find the document by username
                    { $push: { messages: messageData } }, // Add the message to the 'messages' array
                    { upsert: true } // Create the document if it doesn't exist
                );
        
                console.log('Message saved to database');
            } catch (error) {
                console.error('Error saving incoming message:', error);
            }
        });
        
        


        client.on('disconnected', async reason => {
            console.error(`Client disconnected: ${reason}`);
            const sessionId = client.authStrategy.clientId;
            delete sessions[sessionId];
            try {
                const db = getDB();
                await db.collection('sessions').updateOne(
                    { sessionId },
                    { $set: { status: 'disconnected'} },
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
            return res.status(404).json({ error: 'Session not found or not authenticated12' });
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
        const  sessionId = decoded.number;
        console.log(`Checking session ID:1 ${sessionId}`);

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

       
      
            // Check if the client instance exists
            const client = sessions[sessionId];
            if (client) {
                // Optionally, check if the client is authenticated
                return res.status(200).json({ message: 'You are logged in successfully' });
            } else {
                // Session data exists but client instance is not found
                return res.status(400).json({ message: 'Session is not active' });
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
            console.log(`Session for ${username} not found.`);
            return res.status(404).json({ error: 'Please Login First' });
        }

        // Ensure client is authenticated
        client.on('authenticated', () => {
            console.log(`Client authenticated for session: ${username}`);
        });

        if (!client.info || !client.info.wid) { 
            return res.status(404).json({ error: 'Client not authenticated yet.' });
        }

        const chatId = `91${to}@c.us`; // Append @c.us for regular WhatsApp numbers
        const db = getDB();
        const collection = db.collection('soldPlans');
        
        // Check the user's active plan
        const result = await collection.findOne({ username });

        if (!result || !result.plans || result.plans.length === 0) {
            return res.status(400).json({ message: "You do not have any active plan." });
        }

        const plan = result.plans[0].plan;
        const timestamp = result.plans[0].timestamp;
        const duration = plan.duration;
        const ipLimit = plan.ip;

        if (!plan) {
            return res.status(400).json({ message: "You do not have any active plan." });
        }

        const expired = isPlanExpired(timestamp, duration);
        if (expired) {
            await collection.updateOne(
                { username },
                { $unset: { "plans.0": "" } }
            );

            await collection.updateOne(
                { username },
                { $pull: { plans: null } }
            );

            return res.status(400).json({ message: "Your plan has expired." });
        }

        // Sending WhatsApp Message
        try {
            const response = await client.sendMessage(chatId, message);

            // Save the message to the database
            const messageCollection = db.collection('sendedmessages');
            const ip = req.ip;
            await messageCollection.updateOne(
                { username }, // Find the document by username
                { $push: { messages: { to, message, timestamp: new Date(), ip } } }, // Add the message to the 'messages' array
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
            return res.status(400).json({ error: 'Session not found or not authenticated222' });
        }

        // Split the 'to' string by commas to get an array of numbers
        const numbers = to.split(',');

        const db = getDB();
        const collection = db.collection('soldPlans');
        const tokenCollection = db.collection('ipTokens');
        const result = await collection.findOne({ username: decoded.number });

        if (!result || !result.plans || result.plans.length === 0) {
            return res.status(400).json({ message: "You do not have any active plan." });
        }

        const plan = result.plans[0].plan;
        const timestamp = result.plans[0].timestamp;
        const duration = plan.duration;
        const ipLimit = plan.ip;

        if (!plan) {
            return res.status(400).json({ message: "You do not have any active plan." });
        }

        const expired = isPlanExpired(timestamp, duration);
        if (expired) {
            await collection.updateOne(
                { username: decoded.number },
                { $unset: { "plans.0": "" } }
            );

            await collection.updateOne(
                { username: decoded.number },
                { $pull: { plans: null } }
            );

            return res.status(400).json({ message: "Your plan has expired." });
        }
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

function isPlanExpired(timestamp, duration) {
    // Parse the timestamp to a Date object
    const purchaseDate = new Date(timestamp);

    // Calculate the expiration date by adding the duration to the purchase date
    const expirationDate = new Date(purchaseDate);
    expirationDate.setDate(purchaseDate.getDate() + duration);

    // Get the current date
    const currentDate = new Date();

    // Compare the current date with the expiration date
    return currentDate > expirationDate;
}


async function checkAnswer(to, msg) {
    try {
        const username = to;
        const db = getDB();
        const collection = db.collection('autoreply');
        const result = await collection.findOne({ username });

    } catch (error) {

    }
}



const sessionRecover = async (req, res) => {
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
            console.error('Token verification failed:', err);
            return res.status(400).json({ message: 'Invalid token.' });
        }

        const sessionId = decoded.number;

        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
        }

        const sessionPath = path.join(__dirname, 'sessions', sessionId);
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: sessionId,
                dataPath: sessionPath,
            }),
            puppeteer: {
                executablePath,
                headless:true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            },
        });

        let responseSent = false; // Track if a response has been sent

        client.on('qr', async (qr) => {
            console.log(qr)
            return res.status(400).json({message:"Your session can not recover"})
        });

        client.on('ready', async () => {
            console.log(`${sessionId} is ready!`);
            const userId = client.info.wid._serialized;
            const pushName = client.info.pushname;
            const platform = client.info.platform;

            console.log('Logged-in user details:', { userId, pushName, platform });
            if (!responseSent) {
                res.status(200).json({ message: `Session is ready for ${userId}` });
                responseSent = true; // Mark response as sent
            }

            try {
                const db = getDB();
                await db.collection('sessions').updateOne(
                    { sessionId },
                    { $set: { status: 'connected', username: pushName, platform, userId } },
                    { upsert: true }
                );
                sessions[sessionId] = client;
            } catch (error) {
                console.error('Error updating session status:', error);
                if (!responseSent) {
                    res.status(500).json({ error: 'Failed to update session status' });
                }
            }
        });

        // Other event handlers...

        

        client.on('error', (error) => {
            console.error('Client encountered an error:', error);
        });

        client.initialize();
    } catch (error) {
        console.error('Error in sessionRecover:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};


module.exports = { loginWhatsapp, sendMessage, isLoggedIn, sendQuickMessage, sendQuickMessageMulti, sessions,sessionRecover };
