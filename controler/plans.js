const { getDB } = require('../dbConnection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const axios = require('axios')

require('dotenv').config();
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
        const name = data.name;
        const formattedName = name.trim().toUpperCase();
        data.name = name;
        const isPresent = await collection.findOne({ name: formattedName });
        if (isPresent) {
            return res.status(400).json({ message: "Plan ALready Exit" });
        }
        const description = data.description;
        const descriptionAray = description.split(',');
        delete data.description;
        data.description = descriptionAray;
        // Proceed with adding the plan
        data.type = "paid"
        const result = await collection.insertOne(data);
        return res.status(201).json({ message: 'Plan added successfully', planId: result.insertedId });
    } catch (error) {
        console.error('Error in addPlan:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};


const getAllPlan = async (req, res) => {
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

        const plans = await collection.find({ type: "paid" }).toArray();
        res.status(200).json(plans)

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "internal serverv error" })
    }
}


const buyPlan = async (req, res) => {
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
            return res.status(400).json({ message: 'Invalid token.' });
        }

        const id = req.body._id;

        const _id = new ObjectId(id);

        const db = getDB();
        const collection = db.collection('plans');
        const plan = await collection.findOne({ _id });
        if (!plan) {
            return res.status(400).json({ message: "Invlid Plan ID" })
        }
        const orderId = 'ORD' + Date.now();
        const url = 'https://mobilefinder.store/api/create-order';
        const dataToSend = {
            order_id: orderId,
        };
        const encodedData = Buffer.from(JSON.stringify(dataToSend)).toString('base64');
        const frontendUrl = process.env.FrontendUrl
        const data1 = {
            customer_mobile: decoded.number,
            user_token: "79d5da79699266f96141e053bc33e828",
            amount: plan.price,
            order_id: orderId,
            redirect_url: `${frontendUrl}payment-success?data=${encodedData}`,
            remark1: id,
            remark2: '',
        };

        const response = await axios.post(url, data1);


        const responseString = response.data;

        const onlinePaymentCollection = db.collection('onlinePayments');
        data1.number = decoded.number;
        data1.status = 'pending'

        // Extract JSON part from the response string
        const parts = responseString.split(')'); // Assuming the response ends with a closing parenthesis ')'
        const jsonString = parts[parts.length - 1].trim(); // Get the last part and trim whitespace

        try {
            const jsonResponse = JSON.parse(jsonString);
            const paymentUrl = jsonResponse.result.payment_url;
            const insertDetails = await onlinePaymentCollection.findOne({ order_id: data1.order_id });
            if (insertDetails) {
                return res.status(400).json({ message: 'Order Id already exit' })
            }
            data1.date = new Date()
            await onlinePaymentCollection.insertOne(data1);
            res.status(200).json({ status: true, paymentUrl });
        } catch (error) {

            res.status(500).json({ status: false, message: 'Failed to parse JSON response' });
        }


    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "internal serverv error" })
    }
}


const verifyPayment = async (req, res) => {
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

        const db = getDB();
        const collection = db.collection('users');
        const onlinePaymentCollection = db.collection('onlinePayments');
        const data = req.body;
        const order_id = data.order_id;
        const result = await onlinePaymentCollection.findOne({ order_id });
        const user_token = result.user_token
        if (!result) {
            return res.status(400).json({ message: 'No Payment Request' });
        }
        if (result.status == 'success') {
            return res.status(400).json({ message: "Payment All Ready Procced" });
        }
        const response = await checkOrderStatus(order_id, user_token);
        if (response.status !== 'COMPLETED') {
            return res.status(400).json({ message: 'Payment not received' });
        }

        const soldPlanCollection = db.collection('soldPlans');
        const username = decoded.number
        const existingPlan = await soldPlanCollection.findOne({

            'plans.utr': response.result.utr,
        });
        const planCollection = db.collection('plans');
        const _id = new ObjectId(result.remark1);
        const plan = await planCollection.findOne({ _id });

        if (existingPlan) {
            return res.status(400).json({ message: 'UTR number already used.' });
        }
        await soldPlanCollection.updateOne(
            { username }, // Find the document by username
            { $push: { plans: { planId: result.remark1, plan: plan, utr: response.result.utr, timestamp: new Date() } } }, // Add the message object to the existing messages array
            { upsert: true } // Create the document if it doesn't exist
        );

        await onlinePaymentCollection.updateOne(
            { order_id }, // Filter to find the document with the given order_id
            {
                $set: { status: "success", utr: response.result.utr } // Update the status field to "success"
            }
        );

        return res.status(200).json({ message: "payment Received successfully" })

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "internal serverv error" })
    }
}



async function checkOrderStatus(order_id, user_token) {
    const url = 'https://mobilefinder.store/api/check-order-status';
    const data1 = {
        "user_token": user_token,
        "order_id": order_id
    };

    try {
        const response = await axios.post(url, data1);
        const responseString = response.data;
        return responseString
    } catch (error) {
        console.error('Error occurred while making the request:', error);
    }
}

const deletePlan = async (req, res) => {
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

        const db = getDB();
        const collection = db.collection('plans');
        const id = req.body;

        const _id = new ObjectId(id);
        const result = await collection.deleteOne({ _id });
        res.status(200).json({ message: "Plan Deleted Successfully" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "internal serverv error" })
    }
}

const getActivePlans = async (req, res) => {
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

        const db = getDB();
        const collection = db.collection('soldPlans');

        const plans = await collection.find().toArray();
        res.status(200).json(plans);

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "internal serverv error" })
    }
}


const currentPlanUser = async (req, res) => {
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

        const db = getDB();
        const collection = db.collection('soldPlans');
        const username = decoded.number;
        const result = await collection.findOne({ username });
        res.status(200).json(result)
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "internal serverv error" })
    }
}
const addFreeTrailPlan = async (req, res) => {
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
        const name = data.name;
        const formattedName = name.trim().toUpperCase();
        data.name = name;
        const isPresent = await collection.findOne({ name: formattedName });
        if (isPresent) {
            return res.status(400).json({ message: "Plan ALready Exit" });
        }
        const description = data.description;
        const descriptionAray = description.split(',');
        delete data.description;
        data.description = descriptionAray;
        // Proceed with adding the plan
        data.type = 'free'
        const isFreePlanExit = await collection.findOne({ type: "free" });
        if (isFreePlanExit) {
            return res.status(400).json({ message: "Can not add more Trail Plan" })
        }
        const result = await collection.insertOne(data);
        return res.status(201).json({ message: 'Plan added successfully', planId: result.insertedId });
    } catch (error) {
        console.error('Error in addPlan:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};


const getFreePlan = async (req, res) => {
    try {
        const db = getDB();
        const collection = db.collection('plans');
        const soldPlanCollection = db.collection('soldPlans');
        const freeTrailCollection = db.collection('freeTrails')
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

        const result = await soldPlanCollection.findOne({ username: decoded.number });
        const userResult=await freeTrailCollection.findOne({username:decoded.number})
        if (userResult) {
            return res.status(400).json({ message: "Your free trail session is expired" })
        }
        const username = decoded.number;
        const userInfo = {
            username: decoded.number,
            date: new Date()
        }
        const plan = await collection.findOne({ type: "free" });
        await soldPlanCollection.updateOne(
            { username }, // Find the document by username
            { $push: { plans: { planId: plan._id, plan: plan, timestamp: new Date() } } }, // Add the message object to the existing messages array
            { upsert: true } // Create the document if it doesn't exist
        );

        await freeTrailCollection.insertOne(userInfo);

        res.status(200).json({ message: "Plan Updated" });
    } catch (error) {
        console.error('Error in addPlan:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
module.exports = { addPlan, getAllPlan, buyPlan, verifyPayment, deletePlan, getActivePlans, currentPlanUser, addFreeTrailPlan, getFreePlan };
