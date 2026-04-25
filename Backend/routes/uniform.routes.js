const router = require("express").Router();
const auth = require("../middleware/auth");
const uniform = require("../controllers/uniform.controller");


/* ================== REQUESTS ================== */

// GET ALL REQUESTS
router.get("/requests", auth, uniform.getRequests);

// EXPORT REQUESTS
router.get("/requests/export", auth, uniform.exportRequests);

// GET REQUEST BY ID
router.get("/requests/:id", auth, uniform.getRequestById);

// CREATE REQUEST
router.post("/requests", auth, uniform.createRequest);

// REVIEW REQUEST
router.put("/requests/:id/review", auth, uniform.reviewRequest);

module.exports = router;
