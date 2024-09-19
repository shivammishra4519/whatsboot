const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { sessions } = require('./whatsapp');
const { getDB } = require('../dbConnection');
const { Client, MessageMedia } = require('whatsapp-web.js');
require('dotenv').config();

const router = express.Router();

// Configure multer to store files on disk instead of memory
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');  // Specify a directory to save uploaded files
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ 
    storage: storage, 
    limits: { fileSize: 16 * 1024 * 1024 } // Limit to 16 MB
});

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

        const { number, caption } = req.body;
        console.log(caption);
        const file = req.file;

        if (!number || !file) {
            return res.status(400).json({ message: 'Required parameters are missing.' });
        }

        // File path for the uploaded file
        const filePath = file.path;
        const media = MessageMedia.fromFilePath(filePath);

        const db = getDB();
        const messageCollection = db.collection('sendedmessages');

        const ip = req.ip.replace(/^::ffff:/, '');
        const sessionId = decoded.number;
        const client = sessions[sessionId];

        if (!client) {
            return res.status(404).json({ error: 'Session not found or not authenticated.' });
        }

        const to = `91${number}@c.us`;

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

        // Optionally, delete the file after sending
        const fs = require('fs');
        fs.unlinkSync(filePath); // Delete the file after it's sent

        return res.status(200).json({ success: true, response });
    } catch (error) {
        console.error('Error sending media:', error);
        return res.status(500).json({ message: 'Internal Server Error.' });
    }
});

module.exports = router;
