const jwt = require('jsonwebtoken');
const JWT_SECRET = 'whatsapp'; // Use your actual secret

const verifyToken = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = await req.cookies.auth_token || (authHeader && authHeader.replace('Bearer ', ''));

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (ex) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};

module.exports = verifyToken;
