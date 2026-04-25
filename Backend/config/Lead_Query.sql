CREATE DATABASE IF NOT EXISTS employee_leads
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE employee_leads;

CREATE TABLE IF NOT EXISTS leads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  lead_number VARCHAR(40) DEFAULT NULL,

  activity_type ENUM('TELECALLS', 'DIRECT VISIT') NOT NULL,
  customer_type ENUM('NEW CUSTOMER', 'EXISTING CUSTOMER') NOT NULL,
  interested_in ENUM('INTERNET', 'IOT') NOT NULL,
  connection_type ENUM('BB', 'ILL', 'LIVE EVENT', 'SME') DEFAULT NULL,
  connection_stage ENUM('HOT', 'COLD', 'WARM') NOT NULL,

  customer_name VARCHAR(120) NOT NULL,
  mobile_no VARCHAR(15) NOT NULL,
  mail VARCHAR(120) DEFAULT NULL,

  address VARCHAR(500) NOT NULL,

  latitude DECIMAL(10,7) DEFAULT NULL,
  longitude DECIMAL(10,7) DEFAULT NULL,

  lead_ref ENUM(
    'CUSTOMER','SELF','TECH TEAM','IVR',
    'FACEBOOK','WEBSITE','GOOGLE BUSINESS','INSTAGRAM'
  ) NOT NULL,

  ex_customer_id VARCHAR(50) DEFAULT NULL,
  ex_customer_name VARCHAR(120) DEFAULT NULL,
  tech_id VARCHAR(50) DEFAULT NULL,
  tech_name VARCHAR(120) DEFAULT NULL,

  remarks VARCHAR(500) DEFAULT NULL,

  status ENUM('FOLLOWUP', 'ID CREATED', 'CANCELLED', 'ORDER WIN') NOT NULL,

  next_follow_date DATE DEFAULT NULL,
  current_updates VARCHAR(500) DEFAULT NULL,

  customer_id VARCHAR(50) DEFAULT NULL,
  plan VARCHAR(100) DEFAULT NULL,

  plan_value_without_gst DECIMAL(10,2) DEFAULT NULL,
  total_revenue_without_gst DECIMAL(12,2) DEFAULT NULL,

  feedback VARCHAR(500) DEFAULT NULL,

  payment_mode ENUM('MONTHLY','QUARTERLY','HALF YEARLY','YEARLY') DEFAULT NULL,

  otc_without_gst DECIMAL(10,2) DEFAULT NULL,
  deposit_without_gst DECIMAL(10,2) DEFAULT NULL,

  emp_id VARCHAR(30) NOT NULL,
  emp_name VARCHAR(120) NOT NULL,

  vendor_movement VARCHAR(80) NOT NULL,
  move_to_asm VARCHAR(80) NOT NULL,

  connection_branch VARCHAR(120) NOT NULL,
  zone VARCHAR(80) NOT NULL,
  branch VARCHAR(80) NOT NULL,

  lead_date DATE NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  INDEX idx_status_date (status, lead_date),
  INDEX idx_emp_date (emp_id, lead_date),
  INDEX idx_zone_branch (zone, branch),
  INDEX idx_mobile (mobile_no),

  UNIQUE KEY uq_lead_number (lead_number)

) ENGINE=InnoDB;
