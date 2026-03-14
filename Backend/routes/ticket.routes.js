const router = require("express").Router();
const auth = require("../middleware/auth");
const ticket = require("../controllers/ticket.controller");

/* ========================
   TICKET TYPES
======================== */

router.get("/types", auth, ticket.getTicketTypes);

/* ========================
   CREATE TICKET
======================== */

router.post("/", auth, ticket.createTicket);
router.post("/opened/search", auth, ticket.searchOpenedTickets);

module.exports = router;