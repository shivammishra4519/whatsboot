const express = require('express');
const { paymentRequest} = require('../controler/payment'); // Ensure the path and export are correct

const router = express.Router();

router.post('/requests', paymentRequest);


module.exports = router;