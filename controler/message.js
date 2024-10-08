const Joi = require('joi');
const { getDB } = require('../dbConnection');
const bcrypt = require('bcryptjs');
const { userRegistraion } = require('../modal/userRegistration');
const jwt = require('jsonwebtoken');
// User registration function
const fs = require('fs/promises');
const path = require('path');
const JWT_SECRET = 'whatsapp';



const sendedMessage=async(req,res)=>{
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
            console.log(err);
            return res.status(400).json({ message: 'Invalid token.' });
        }
        const db=getDB();
        const collection=db.collection('sendedmessages');
        const result=await collection.findOne({username:decoded.number});
        res.status(200).json(result)

    } catch (error) {
        console.log(error);
        return res.status(500).json({message:"Internal server error"})
    }
}


const incomingMessages=async(req,res)=>{
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
            console.log(err);
            return res.status(400).json({ message: 'Invalid token.' });
        }
        const db=getDB();
        const collection=db.collection('receivedmessages');
        const username=`91${decoded.number}`;
        const result=await collection.findOne({username});
        res.status(200).json(result)

    } catch (error) {
        console.log(error);
        return res.status(500).json({message:"Internal server error"})
    }
}





module.exports={sendedMessage,incomingMessages}