const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const ffmpeg = require('fluent-ffmpeg');
const { sessions } = require('./whatsapp');
const { getDB } = require('../dbConnection');
const { Client, MessageMedia } = require('whatsapp-web.js');
require('dotenv').config();

// Set up FFmpeg path
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

const router = express.Router();

// Define the absolute path to the uploads folder
const uploadDir = path.join(__dirname, '..', 'uploads');

// Ensure the 'uploads' directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer to store files in the uploads folder
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to filename
    }
});

const upload = multer({ storage: storage }); // Use the custom storage configuration

const sessionsArray = sessions;

// Convert video to MP4 (with H.264 video codec and AAC audio codec)
const convertVideoToMP4 = (inputPath, outputPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .output(outputPath)
            .videoCodec('libx264')
            .audioCodec('aac')
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err))
            .run();
    });
};

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

        const { number } = req.body;
        const file = req.file;

        if (!number || !file) {
            return res.status(400).json({ message: "Required parameters are missing" });
        }

        // Check if the media file is too large
        const maxSize = 16 * 1024 * 1024; // 16 MB
        if (file.size > maxSize) {
            return res.status(400).json({ message: "File size exceeds the 16 MB limit." });
        }

        const db = getDB();
        const messageCollection = db.collection('sendedmessages');

        const ip = req.ip.replace(/^::ffff:/, "");
        const sessionId = decoded.number;  // Use the decoded token data

        const client = sessionsArray[sessionId];

        if (!client) {
            return res.status(404).json({ error: 'Session not found or not authenticated' });
        }

        const to = `91${number}@c.us`;

        const sendMediaWithRetry = async (retryCount = 3) => {
            try {
                // Prepare the media file to send
                let filePath = path.join(uploadDir, file.filename);

                // Check if the file is a video and needs conversion
                const isVideo = file.mimetype.startsWith('video');
                if (isVideo) {
                    const outputFilePath = path.join(uploadDir, `converted_${file.filename}`);
                    filePath = await convertVideoToMP4(filePath, outputFilePath); // Convert video to MP4
                }

                // Check if the file exists
                if (!fs.existsSync(filePath)) {
                    console.error('File does not exist:', filePath);
                    return res.status(400).json({ error: 'File does not exist' });
                }

                const media = MessageMedia.fromFilePath(filePath);

                console.log('Sending media:', {
                    to,
                    media: {
                        mimetype: media.mimetype,
                        filename: file.filename,
                        path: filePath
                    }
                });

                // Send the media
                const response = await client.sendMessage(to, media);
                console.log('Media sent successfully:', response);

                // Optionally delete the file after sending
                fs.unlink(filePath, (err) => {
                    if (err) console.error('Failed to delete file:', err);
                });

                // Save the message to the database
                await messageCollection.updateOne(
                    { username: sessionId },
                    { $push: { messages: { to, media: file.filename, timestamp: new Date(), ip } } },
                    { upsert: true }
                );

                return res.status(200).json({ success: true, response });
            } catch (err) {
                console.error('Error sending media:', err);
                if (retryCount > 0) {
                    console.warn(`Retrying sendMedia (${retryCount} retries left)...`);
                    return sendMediaWithRetry(retryCount - 1);
                } else {
                    console.error('Failed to send media after retries:', err);
                    return res.status(500).json({ error: 'Failed to send media after retries' });
                }
            }
        };

        await sendMediaWithRetry();

    } catch (error) {
        console.error('Error in sendMediaWithRetry:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;
