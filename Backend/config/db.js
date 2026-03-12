const mysql = require("mysql2");

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Admin@123",
  database: "employee list",
  port: 3306
});

module.exports = db;
