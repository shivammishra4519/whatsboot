const Joi = require('joi');
const { getDB } = require('../dbConnection');
const bcrypt = require('bcryptjs');
const { userRegistraion } = require('../modal/userRegistration');
const jwt = require('jsonwebtoken');
// User registration function

const JWT_SECRET = 'whatsapp';
const userRegistration = async (req, res) => {
  try {
    const db = getDB();
    const collection = db.collection('users');
    const data = req.body;

    // Validate user input
    const { error, value } = userRegistraion.validate(data);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Check if the user already exists
    const isUserExist = await collection.findOne({ number: data.number });
    if (isUserExist) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const isEmailExit = await collection.findOne({ email: data.email });
    if (isEmailExit) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Remove confirmPassword from the data object
    // delete data.confirmPassword;

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    // Save the user with the hashed password
    const userData = { ...data, password: hashedPassword };
    const result = await collection.insertOne(userData);

    if (result) {
      return res.status(201).json({ message: 'User registered successfully' });
    } else {
      return res.status(500).json({ message: 'Failed to register user' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


const login = async (req, res) => {
  try {
    const db = getDB();
    const collection = db.collection('users');
    const { userId, password } = req.body;


    // Find the user by either email or number
    const user = await collection.findOne({ $or: [{ email: userId }, { number: userId }] });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if the password matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const role = user.role || 'user';
    // Generate JWT token
    const token = jwt.sign({ number: user.number, role: role }, JWT_SECRET, { expiresIn: '24h' });

    // Send the token as a cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: false, // Set to true if using HTTPS
      maxAge: 3600 * 1000, // 1 hour
      sameSite: 'Lax' // or 'Lax', 'Strict' based on your needs
    });

    return res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const adminregister = async (req, res) => {
  try {
    const db = getDB();
    const collection = db.collection('users');
    const { number, email, password } = req.body;
    if (!number || !email || !password) {
      res.status(400).json({ message: "username password or email can not blank" })
    }

    const result = await collection.findOne({ role: "admin" });
    console.log(result)
    if (result) {
      return res.status(400).json({ message: "Admin Already exit" })
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const insert = await collection.insertOne({ number, email, hashedPassword, password, role: "admin" });
    if (!insert) {
      return res.status(400).json({ message: "user not register please try again letter" })
    }
    res.status(200).json({ message: "user registred successfully" });
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: "Internal server error" });
  }
}


const checkRole = async (req, res) => {
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
      return res.status(401).json({ message: 'Invalid token.' });
    }

    const db = getDB();
    const collection = db.collection('users');
    const number = decoded.number;
    const findResult = await collection.findOne({ number });

    if (!findResult) {
      return res.status(400).json({ message: 'Invalid request: user not found.' });
    }

    const role = findResult.role;
    if (role === 'admin') {
      return res.status(200).json({ message: 'success', role });
    }

    // If the role is not 'admin', still return a successful response with the role
    return res.status(200).json({ message: 'success', role:'user' });

  } catch (error) {
    console.error('Error in checkRole:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};



const logout = (req, res) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Only send cookie over HTTPS in production
    sameSite: 'Lax' // Adjust based on your needs
  });
  res.status(200).json({ message: 'Logout successful' });
};


const getAllUser = async (req, res) => {
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

    const users = await collection.find(
      { role: { $ne: "admin" } },        // Filter out admin users
      { projection: { password: 0 } }    // Exclude the password field
    ).toArray();
    
    res.status(200).json(users)
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { userRegistration, login, adminregister, checkRole, logout,getAllUser };
