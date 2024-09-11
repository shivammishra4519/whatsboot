const { getDB } = require('../dbConnection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

require('dotenv').config();

const addIp = async (req, res) => {
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
            console.error('Token verification failed:', err);
            return res.status(400).json({ message: 'Invalid token.' });
        }

        const db = getDB();
        const collection = db.collection('soldPlans');
        const tokenCollection = db.collection('ipTokens');
        
        // Find the user by token
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

        const { ipAddress } = req.body;
        if (!ipAddress) {
            return res.status(400).json({ message: "IP address cannot be blank." });
        }

        const uniqueId = generateUniqueId();
        const tokenData = {
            ip: ipAddress,
            tk: uniqueId
        };
        const encodedData = Buffer.from(JSON.stringify(tokenData)).toString('base64');

        const obj = {
            ipAddress,
            token: uniqueId,
            username: decoded.number,
            timestamp: new Date(),
            encodedData
        };
        const username=decoded.number;

        // Check if the IP address already exists in the ipTokens collection
        // const existingToken = await tokenCollection.findOne({ ipAddress });
        const existingToken = await tokenCollection.findOne({ 
            ipAddress: ipAddress, 
            username: username 
          });
        

        if (existingToken) {
            const updateResult = await tokenCollection.updateOne(
                { ipAddress },
                { $set: { token: uniqueId, timestamp: new Date(), encodedData } }
            );
        } else {
          
            const ipCount = await tokenCollection.countDocuments({ username: decoded.number });
            console.log("IP Count: ", ipCount);

            if (ipCount >= ipLimit) {
                return res.status(400).json({ message: "IP limit reached. Cannot add more IPs." });
            }

            // Insert a new record
            const insertResult = await tokenCollection.insertOne(obj);
            
        }

        return res.status(200).json({ encodedData });

    } catch (error) {
        console.error('Error in addIp:', error);
        return res.status(500).json({ message: "Internal server error." });
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

function generateUniqueId(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}




const getToken = async (req, res) => {
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

        const username = decoded.number;
        const db = getDB()
        const collection = db.collection('ipTokens');
        const data = await collection.find({username}).toArray();
        res.status(200).json(data)
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
}


const whiteListedIp=async(req,res)=>{
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

        const username = decoded.number;
        const db = getDB()
        const collection = db.collection('ipTokens');
        const data = await collection.find().toArray();
        res.status(200).json(data)
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

const deleteIp = async (req, res) => {
    try {
        // Extract the Authorization header and token from cookies
        const authHeader = req.header('Authorization');
        const token = req.cookies.auth_token || (authHeader && authHeader.replace('Bearer ', ''));

        // If no token is provided, return a 401 status
        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        // Verify the token
        const secretKey = process.env.JWT_SECRET || 'whatsapp'; // Ensure the secret key is in env variables
        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (err) {
            return res.status(400).json({ message: 'Invalid token.' });
        }

        // Ensure id is provided and valid
        const id = req.body._id;
        if (!id) {
            return res.status(400).json({ message: 'ID is required.' });
        }

        const _id = new ObjectId(id); // Convert the provided ID to ObjectId
        const db = getDB();
        const collection = db.collection('ipTokens');

        // Attempt to delete the document
        const result = await collection.deleteOne({ _id });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'IP not found.' });
        }

        // Success
        res.status(200).json({ message: 'IP deleted successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};


module.exports = { addIp, getToken,whiteListedIp,deleteIp };
