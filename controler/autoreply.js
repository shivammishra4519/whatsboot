const { getDB } = require('../dbConnection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const axios = require('axios')

require('dotenv').config();


const addAnswer = async (req, res) => {
    try {
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
            console.log(err);
            return res.status(400).json({ message: 'Invalid token.' });
        }

        const db = getDB();
        const collection = db.collection('autoreply');

        const username = decoded.number;

        // Sanitize the input: remove extra spaces and convert to lowercase
        const sanitizedAnswer = req.body.answer.trim().replace(/\s+/g, ' ');
        const sanitizedMessage = req.body.message.trim().replace(/\s+/g, ' ').toLowerCase();

        // Object to be pushed into the array
        const newAnswer = {
            answer: sanitizedAnswer,
            message: sanitizedMessage,
            timestamp: new Date()
        };

        // Push the new object into the array in the existing document or create a new document if it doesn't exist
        const result = await collection.updateOne(
            { username },  // Find the document by username
            { $push: { answers: newAnswer } },  // Push the new answer object into the 'answers' array
            { upsert: true }  // Create document if it doesn't exist
        );

        if (result.modifiedCount > 0 || result.upsertedCount > 0) {
            return res.status(200).json({ message: 'Answer added successfully' });
        } else {
            return res.status(400).json({ message: 'Failed to add answer' });
        }

    } catch (error) {
        console.error('Error in addAnswer:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};



module.exports={addAnswer}
