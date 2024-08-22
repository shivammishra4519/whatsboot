const { getDB } = require('../dbConnection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { userRegistraion } = require('../modal/userRegistration');

const addPlan = async (req, res) => {
    try {
        const db = getDB();
        const collection = db.collection('plans');
        const data = req.body;

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
            return res.status(400).json({ message: 'Invalid token.' });
        }

        // Check user role
        const role = decoded.role;
        if (role !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized user' }); // Use 403 for forbidden access
        }

        const description=data.description;
        const descriptionAray = description.split(',');
        delete data.description;
        data.description=descriptionAray;
        // Proceed with adding the plan
        const result = await collection.insertOne(data);
        return res.status(201).json({ message: 'Plan added successfully', planId: result.insertedId });
    } catch (error) {
        console.error('Error in addPlan:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};


const getAllPlan=async(req,res)=>{
    try {
        
        const db = getDB();
        const collection = db.collection('plans');
   

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
            return res.status(400).json({ message: 'Invalid token.' });
        }

        const plans=await collection.find().toArray();
        res.status(200).json(plans)

    } catch (error) {
        console.log(error);
        return res.status(500).json({message:"internal serverv error"})
    }
}

module.exports = { addPlan ,getAllPlan};
