const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const ctrl = require("../controllers/relieving.controller");

// DASHBOARD
router.get("/dashboard", auth, ctrl.getRelievingDashboard);

// ACTIVE EMPLOYEE SEARCH FOR CREATE FORM
router.get("/candidates", auth, ctrl.getRelievingCandidates);

// CREATE / UPDATE / GET
router.post("/generate", auth, ctrl.generateRelievingLetter);
router.get("/:id", auth, ctrl.getRelievingLetterById);
router.put("/:id", auth, ctrl.updateRelievingLetter);

// APPROVAL
router.post("/:id/approve", auth, ctrl.approveRelievingLetter);
router.post("/:id/reject", auth, ctrl.rejectRelievingLetter);

// FILE ACTIONS
router.get("/preview/:id", auth, ctrl.previewRelievingLetter);
router.get("/download/:id", auth, ctrl.downloadRelievingLetter);
router.post("/send-mail", auth, ctrl.sendRelievingLetterMail);

module.exports = router;
