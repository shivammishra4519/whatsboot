const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { sessions } = require('./whatsapp');
const { getDB } = require('../dbConnection');
const { Client, MessageMedia } = require('whatsapp-web.js');
require('dotenv').config();

const router = express.Router();

// Configure multer to store files in memory
const storage = multer.memoryStorage(); // Use memory storage instead of disk storage
const upload = multer({ storage: storage }); // Use the memory storage configuration

const sessionsArray = sessions;

// Endpoint to send media
router.post('/send-media', upload.single('file'), async (req, res) => {
    try {
        // Authentication
        const authHeader = req.header('Authorization');
        const token = req.cookies.auth_token || (authHeader && authHeader.replace('Bearer ', ''));

        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        // Verify the token
        const secretKey = process.env.JWT_SECRET || 'whatsapp';
        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (err) {
            console.error('Invalid token:', err);
            return res.status(400).json({ message: 'Invalid token.' });
        }

        // Extract data from request
        const { number, caption } = req.body;
        const file = req.file;

        if (!number || !file) {
            return res.status(400).json({ message: 'Required parameters are missing.' });
        }

        // Check if the media file is too large
        const maxSize = 16 * 1024 * 1024; // 16 MB
        if (file.size > maxSize) {
            return res.status(400).json({ message: 'File size exceeds the 16 MB limit.' });
        }

        const db = getDB();
        const messageCollection = db.collection('sendedmessages');

        const ip = req.ip.replace(/^::ffff:/, '');
        const sessionId = decoded.number;
        const client = sessionsArray[sessionId];

        if (!client) {
            return res.status(404).json({ error: 'Session not found or not authenticated.' });
        }

        const to = `91${number}@c.us`;

        // Prepare the media in memory (convert the buffer into MessageMedia)
        const media = new MessageMedia(file.mimetype, file.buffer.toString('base64'), file.originalname);

        console.log('Sending media:', {
            to,
            media: {
                mimetype: media.mimetype,
                filename: file.originalname
            },
            caption
        });

        // Send the media with a caption
        const response = await client.sendMessage(to, media, { caption });
        console.log('Media sent successfully with caption:', response);

        // Save the message to the database
        await messageCollection.updateOne(
            { username: sessionId },
            { $push: { messages: { to, media: file.originalname, caption, timestamp: new Date(), ip } } },
            { upsert: true }
        );

        return res.status(200).json({ success: true, response });
    } catch (error) {
        console.error('Error sending media:', error);
        return res.status(500).json({ message: 'Internal Server Error.' });
    }
});

module.exports = router;
