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

        // Check if the message already exists in the user's answers array
        const existingMessage = await collection.findOne({
            username,
            answers: { $elemMatch: { message: sanitizedMessage } }
        });

        if (existingMessage) {
            return res.status(400).json({ message: 'Message already present' });
        }

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



const getAllAnswer = async (req, res) => {
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
        const result = await collection.findOne({ username });
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in addAnswer:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}


const deleteMessage = async (req, res) => {
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

        // Sanitize the message input: remove extra spaces and convert to lowercase
        const sanitizedMessage = req.body.message.trim().replace(/\s+/g, ' ').toLowerCase();

        // Pull the message from the answers array
        const result = await collection.updateOne(
            { username }, // Find by username
            { $pull: { answers: { message: sanitizedMessage } } } // Remove the object with the matching message
        );

        if (result.modifiedCount > 0) {
            return res.status(200).json({ message: 'Message deleted successfully' });
        } else {
            return res.status(400).json({ message: 'Message not found or failed to delete' });
        }

    } catch (error) {
        console.error('Error in deleteMessage:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};



module.exports = { addAnswer, getAllAnswer ,deleteMessage}
