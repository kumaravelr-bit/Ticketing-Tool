const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth"); // ✅ YOUR EXISTING AUTH
const controller = require("../controllers/manpower.controller");

/* CREATE */
router.post("/requests", auth, controller.createRequest);

/* SUMMARY */
router.get("/home-summary", auth, controller.getSummary);

/* LIST */
router.get("/requests", auth, controller.getRequests);

/* DETAIL */
router.get("/requests/:id", auth, controller.getRequestById);

router.put("/requests/:id", auth, controller.updateManpowerRequest);
router.put("/requests/:id/:type", auth, controller.updateManpowerAction);


module.exports = router;