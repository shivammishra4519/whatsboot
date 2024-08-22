const express = require('express');
const { sendedMessage ,incomingMessages,deleteFolder} = require('../controler/message'); // Ensure the path and export are correct

const router = express.Router();

router.post('/viewmessage', sendedMessage);
router.post('/incomming', incomingMessages);
router.post('/delete', deleteFolder);


module.exports = router;