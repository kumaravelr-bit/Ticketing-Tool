require("dotenv").config();
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));
app.use("/api/employee", require("./routes/employee.routes"));
app.use("/api/others", require("./routes/others.routes"));
app.use("/api/tickets", require("./routes/ticket.routes"));
app.use("/api/auth", require("./routes/auth.routes"));


app.listen(process.env.PORT || 8090, () =>
  console.log("Server running on port", process.env.PORT)
);

module.exports = app;