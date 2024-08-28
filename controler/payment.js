const Joi = require('joi');
const { getDB } = require('../dbConnection');
const bcrypt = require('bcryptjs');
const { userRegistraion } = require('../modal/userRegistration');
const jwt = require('jsonwebtoken');
// User registration function


const paymentRequest=async(req,res)=>{
    try {
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
            return res.status(400).json({ message: 'Invalid token.' });
        }
        const db=getDB();
        const collection=db.collection('onlinePayments');
        const result=await collection.find().toArray();
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in sendQuickMessage:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

module.exports={paymentRequest}