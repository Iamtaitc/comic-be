// src/routers/adminRoutes/crawlerError.routes.js
const express = require('express');
const router = express.Router();
const crawlerErrorController = require('../../controllers/admin/crawlerErrorController');

// GET /admin/crawler-errors?limit=50
router.get('/crawler-errors', crawlerErrorController.getCrawlerErrors);

module.exports = router;
