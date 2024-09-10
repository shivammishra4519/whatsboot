const express = require('express');
const { addAnswer,getAllAnswer,deleteMessage} = require('../controler/autoreply'); // Ensure the path and export are correct

const router = express.Router();

router.post('/answer', addAnswer);
router.post('/get', getAllAnswer);
router.post('/delete', deleteMessage);





module.exports = router;