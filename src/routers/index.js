const express = require('express');
const router = express.Router();

router.use('', require('./adminRoutes'));

router.use('', require('./userRoutes'));


module.exports = router;