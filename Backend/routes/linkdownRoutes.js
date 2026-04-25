const express = require("express");
const {
  getLinkdownById,
  createLinkdown,
  updateLinkdown,
} = require("../controllers/linkdownController");

const router = express.Router();

router.get("/linkdown/:id", getLinkdownById);
router.post("/linkdown", createLinkdown);
router.put("/linkdown/:id", updateLinkdown);

module.exports = router;