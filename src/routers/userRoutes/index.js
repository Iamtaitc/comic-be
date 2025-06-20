"use strict";

const express = require("express");
const router = express.Router();
//TOdo: done
router.use("/v1", require("./comic"));
router.use("/v1", require("./auth"));
router.use("/v1", require("./user"));
router.use("/v1", require("./notification"));
router.use("/v1", require("./cmt"));


module.exports = router;