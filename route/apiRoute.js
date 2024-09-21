const express = require('express');
const { sendSingleMessage} = require('../controler/apimessging'); // Ensure the path and export are correct

const router = express.Router();

router.get('/single/message', sendSingleMessage);






module.exports = router;