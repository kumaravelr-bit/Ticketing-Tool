const mysql = require("mysql2");

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Kavin@091001",
  database: "employee_list",
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


module.exports = db.promise();
