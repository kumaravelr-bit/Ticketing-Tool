CREATE DATABASE IF NOT EXISTS employee_list;
USE employee_list;

CREATE TABLE IF NOT EXISTS zones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  zone_name VARCHAR(50) UNIQUE NOT NULL
) ENGINE=InnoDB;

INSERT INTO zones (zone_name) VALUES
('THANJAVUR'),
('NAMAKKAL'),
('ERODE'),
('CHENNAI'),
('COIMBATORE'),
('MADURAI'),
('TIRUNELVELI'),
('SALEM'),
('HEAD OFFICE'),
('PONDICHERRY'),
('KRISHNAGIRI'),
('THIRUVALLUR'),
('TIRUCHIRAPPALLI');

CREATE TABLE branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_name VARCHAR(50) NOT NULL,
  short_name VARCHAR(10),
  zone_id INT NOT NULL,

  INDEX idx_branch_zone (zone_id),

  CONSTRAINT fk_branch_zone
    FOREIGN KEY (zone_id) REFERENCES zones(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE branches
ADD CONSTRAINT uniq_branch_per_zone UNIQUE (branch_name, zone_id);

INSERT INTO branches (branch_name, short_name, zone_id) VALUES
('Thanjavur','THN',1),
('Thiruvarur','THV',1),
('Nagapattinam','NGM',1),
('Namakkal','NKL',2),
('Rasipuram','RSP',2),
('Paramathi Velur','PMV',2),
('Elampillai','ELM',2);

INSERT INTO branches (branch_name, short_name, zone_id) VALUES
('Head Office', 'HO', 
 (SELECT id FROM zones WHERE zone_name = 'HEAD OFFICE')
);

CREATE TABLE areas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  area_name VARCHAR(100) NOT NULL,
  branch_id INT NOT NULL,

  INDEX idx_area_branch (branch_id),

  CONSTRAINT fk_area_branch
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_name VARCHAR(50) UNIQUE NOT NULL
) ENGINE=InnoDB;

INSERT INTO teams (team_name) VALUES
('SALES'),
('MARKETING'),
('OPERATIONS'),
('HRD'),
('ACCOUNTS'),
('SUPPORT'),
('IT');  

CREATE TABLE designations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  designation_name VARCHAR(50) NOT NULL,
  level INT NOT NULL,
  is_manager TINYINT(1) DEFAULT 0,
  manager_scope ENUM(
    'NONE',
    'TEAM',
    'BRANCH',
    'ZONE',
    'GLOBAL'
  ) NOT NULL DEFAULT 'NONE',

  INDEX idx_designation_team (team_id),
  INDEX idx_designation_level (level),

  CONSTRAINT fk_designation_team
    FOREIGN KEY (team_id) REFERENCES teams(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS designation_reporting_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  child_designation_id INT NOT NULL,
  parent_designation_id INT NOT NULL,
  same_team_only TINYINT(1) NOT NULL DEFAULT 0,
  same_branch_only TINYINT(1) NOT NULL DEFAULT 0,
  same_zone_only TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_designation_rule (child_designation_id, parent_designation_id),
  INDEX idx_drr_child (child_designation_id),
  INDEX idx_drr_parent (parent_designation_id),

  CONSTRAINT fk_drr_child
    FOREIGN KEY (child_designation_id) REFERENCES designations(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_drr_parent
    FOREIGN KEY (parent_designation_id) REFERENCES designations(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS scope_owner_mapping (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NULL,
  zone_id INT NULL,
  branch_id INT NULL,
  designation_id INT NOT NULL,
  employee_id INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_scope_owner (team_id, zone_id, branch_id, designation_id),
  INDEX idx_scope_owner_designation (designation_id),
  INDEX idx_scope_owner_employee (employee_id),
  INDEX idx_scope_owner_team (team_id),
  INDEX idx_scope_owner_zone (zone_id),
  INDEX idx_scope_owner_branch (branch_id),

  CONSTRAINT fk_scope_owner_team
    FOREIGN KEY (team_id) REFERENCES teams(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_scope_owner_zone
    FOREIGN KEY (zone_id) REFERENCES zones(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_scope_owner_branch
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_scope_owner_designation
    FOREIGN KEY (designation_id) REFERENCES designations(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE employees (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- UNIQUE EMPLOYEE CODE
  emp_id VARCHAR(20) NOT NULL UNIQUE,

  -- BASIC INFO
  joining_status ENUM('TRAINEE','PERMANENT') DEFAULT 'TRAINEE',

  name VARCHAR(100) NOT NULL,
  father_name VARCHAR(100),

  gender ENUM('MALE','FEMALE','OTHERS'),

  dob DATE NOT NULL,

  -- CONTACT
  email VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(15) NOT NULL,
  emergency_contact VARCHAR(15),

  -- AUTH
  password VARCHAR(255) NOT NULL,

  -- OTP / SECURITY
  reset_otp VARCHAR(10),
  otp_expiry DATETIME,
  otp_attempts INT DEFAULT 0,
  otp_last_sent DATETIME,

  -- PERSONAL DETAILS
  marital_status ENUM('SINGLE','MARRIED','DIVORCED','WIDOWED'),
  experience VARCHAR(50),

  -- ORGANIZATION STRUCTURE
  role ENUM('SUPER_ADMIN','ADMIN','USER_ACCOUNT') NOT NULL,

  team_id INT NOT NULL,
  designation_id INT NOT NULL,
  manager_id INT NULL,

  branch_id INT NOT NULL,
  zone_id INT NOT NULL,

  -- PROFESSIONAL DETAILS
  qualification VARCHAR(100),
  joining_date DATE,

  -- ADDRESS
  permanent_address TEXT,
  temporary_address TEXT,

  -- MEDIA
  profile_photo VARCHAR(255) DEFAULT NULL,

  -- STATUS TRACKING
  status ENUM('ACTIVE','RELIEVED','DEACTIVATED') DEFAULT 'ACTIVE',
  last_login DATETIME NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- ==============================
  -- 🚀 INDEXES (PERFORMANCE BOOST)
  -- ==============================

  INDEX idx_emp_team (team_id),
  INDEX idx_emp_designation (designation_id),
  INDEX idx_emp_manager (manager_id),
  INDEX idx_emp_branch (branch_id),
  INDEX idx_emp_zone (zone_id),
  INDEX idx_emp_role (role),

  -- 🔥 MOST IMPORTANT INDEX (USED IN YOUR API)
  INDEX idx_emp_team_status (team_id, status, emp_id),

  -- 🔥 LOGIN / AUTH PERFORMANCE
  INDEX idx_emp_email (email),

  -- 🔥 STATUS FILTERING
  INDEX idx_emp_status (status),

  -- ==============================
  -- 🔗 FOREIGN KEYS
  -- ==============================

  CONSTRAINT fk_employee_team
    FOREIGN KEY (team_id) REFERENCES teams(id),

  CONSTRAINT fk_employee_designation
    FOREIGN KEY (designation_id) REFERENCES designations(id),

  CONSTRAINT fk_employee_manager
    FOREIGN KEY (manager_id) REFERENCES employees(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_employee_branch
    FOREIGN KEY (branch_id) REFERENCES branches(id),

  CONSTRAINT fk_employee_zone
    FOREIGN KEY (zone_id) REFERENCES zones(id)

) ENGINE=InnoDB;

ALTER TABLE employees
ADD INDEX idx_emp_status_zone_branch_team (status, zone_id, branch_id, team_id, joining_date);

ALTER TABLE scope_owner_mapping
ADD CONSTRAINT fk_scope_owner_employee
  FOREIGN KEY (employee_id) REFERENCES employees(id)
  ON DELETE CASCADE;


-- zone_id is intentionally retained because frontend access provisioning,
-- auth, employee CRUD, and request visibility all depend on it.

DROP TRIGGER IF EXISTS validate_manager_hierarchy;
DROP TRIGGER IF EXISTS validate_manager_hierarchy_update;

DELIMITER $$

CREATE TRIGGER validate_manager_hierarchy
BEFORE INSERT ON employees
FOR EACH ROW
BEGIN
  DECLARE manager_designation_id INT;
  DECLARE manager_team_id INT;
  DECLARE manager_branch_id INT;
  DECLARE manager_zone_id INT;
  DECLARE manager_role VARCHAR(50);
  DECLARE employee_level INT;
  DECLARE manager_level INT;
  DECLARE manager_is_manager TINYINT(1);
  DECLARE allowed_count INT DEFAULT 0;

  IF NEW.manager_id IS NOT NULL THEN
    SELECT
      e.designation_id,
      e.team_id,
      e.branch_id,
      e.zone_id,
      e.role,
      d.level,
      d.is_manager
    INTO
      manager_designation_id,
      manager_team_id,
      manager_branch_id,
      manager_zone_id,
      manager_role,
      manager_level,
      manager_is_manager
    FROM employees e
    JOIN designations d ON d.id = e.designation_id
    WHERE e.id = NEW.manager_id
    LIMIT 1;

    SELECT d.level
    INTO employee_level
    FROM designations d
    WHERE d.id = NEW.designation_id
    LIMIT 1;

    IF manager_designation_id IS NULL THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Selected manager not found';
    END IF;

    IF manager_role <> 'SUPER_ADMIN' THEN
      IF manager_is_manager <> 1 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Selected manager designation is not marked as manager';
      END IF;

      IF manager_level <= employee_level THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Manager must have higher designation level';
      END IF;

      SELECT COUNT(*)
      INTO allowed_count
      FROM designation_reporting_rules r
      WHERE r.child_designation_id = NEW.designation_id
        AND r.parent_designation_id = manager_designation_id
        AND r.is_active = 1
        AND (r.same_team_only = 0 OR manager_team_id = NEW.team_id)
        AND (r.same_branch_only = 0 OR manager_branch_id = NEW.branch_id)
        AND (r.same_zone_only = 0 OR manager_zone_id = NEW.zone_id);

      IF allowed_count = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Manager mapping is not allowed for this designation hierarchy';
      END IF;
    END IF;
  END IF;
END$$

DELIMITER ;

DELIMITER $$

CREATE TRIGGER validate_team_designation
BEFORE INSERT ON employees
FOR EACH ROW
BEGIN
  IF (
    SELECT team_id FROM designations 
    WHERE id = NEW.designation_id
  ) != NEW.team_id THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Team and Designation mismatch';
  END IF;
END$$

DELIMITER ;

DELIMITER $$

CREATE TRIGGER validate_manager_hierarchy_update
BEFORE UPDATE ON employees
FOR EACH ROW
BEGIN
  DECLARE manager_designation_id INT;
  DECLARE manager_team_id INT;
  DECLARE manager_branch_id INT;
  DECLARE manager_zone_id INT;
  DECLARE manager_role VARCHAR(50);
  DECLARE employee_level INT;
  DECLARE manager_level INT;
  DECLARE manager_is_manager TINYINT(1);
  DECLARE allowed_count INT DEFAULT 0;

  IF NEW.manager_id IS NOT NULL THEN
    SELECT
      e.designation_id,
      e.team_id,
      e.branch_id,
      e.zone_id,
      e.role,
      d.level,
      d.is_manager
    INTO
      manager_designation_id,
      manager_team_id,
      manager_branch_id,
      manager_zone_id,
      manager_role,
      manager_level,
      manager_is_manager
    FROM employees e
    JOIN designations d ON d.id = e.designation_id
    WHERE e.id = NEW.manager_id
    LIMIT 1;

    SELECT d.level
    INTO employee_level
    FROM designations d
    WHERE d.id = NEW.designation_id
    LIMIT 1;

    IF manager_designation_id IS NULL THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Selected manager not found';
    END IF;

    IF manager_role <> 'SUPER_ADMIN' THEN
      IF manager_is_manager <> 1 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Selected manager designation is not marked as manager';
      END IF;

      IF manager_level <= employee_level THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Manager must have higher designation level';
      END IF;

      SELECT COUNT(*)
      INTO allowed_count
      FROM designation_reporting_rules r
      WHERE r.child_designation_id = NEW.designation_id
        AND r.parent_designation_id = manager_designation_id
        AND r.is_active = 1
        AND (r.same_team_only = 0 OR manager_team_id = NEW.team_id)
        AND (r.same_branch_only = 0 OR manager_branch_id = NEW.branch_id)
        AND (r.same_zone_only = 0 OR manager_zone_id = NEW.zone_id);

      IF allowed_count = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Manager mapping is not allowed for this designation hierarchy';
      END IF;
    END IF;
  END IF;
END$$

DELIMITER ;

-- ==============================
-- EMPLOYEE AREAS (OPTIMIZED)
-- ==============================

CREATE TABLE employee_areas (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  emp_id VARCHAR(20) NOT NULL,
  area_id INT NOT NULL,

  UNIQUE KEY uniq_emp_area (emp_id, area_id),

  INDEX idx_area_emp (area_id, emp_id),

  CONSTRAINT fk_emp_area_emp
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_emp_area_area
    FOREIGN KEY (area_id) REFERENCES areas(id)
    ON DELETE CASCADE

) ENGINE=InnoDB;


-- ==============================
-- EMPLOYEE BRANCHES (OPTIMIZED)
-- ==============================
CREATE TABLE employee_branches (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  emp_id VARCHAR(20) NOT NULL,
  branch_id INT NOT NULL,

  access_type ENUM(
    'PRIMARY',
    'CRM',
    'LEAD',
    'SUPPORT'
  ) DEFAULT 'SUPPORT',

  module ENUM(
    'CRM',
    'TICKETING',
    'ERP',
    'ALL'
  ) DEFAULT 'ALL',

  -- 🔥 PREVENT DUPLICATE ENTRIES
  UNIQUE KEY uniq_emp_branch_module (emp_id, branch_id, module),

  -- 🔥 ULTRA FAST QUERY INDEX (MOST IMPORTANT)
  INDEX idx_branch_emp (branch_id, emp_id),

  -- 🔥 SECONDARY INDEX
  INDEX idx_emp_branch (emp_id),

  -- 🔥 FILTERING INDEX (FOR MODULE + ACCESS TYPE)
  INDEX idx_module_access (module, access_type),

  CONSTRAINT fk_eb_emp
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_eb_branch
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE CASCADE

) ENGINE=InnoDB;

-- Existing UNIQUE KEY uniq_emp_branch_module already covers
-- (emp_id, branch_id, module), so no second duplicate unique key is needed.

-- ==============================
-- PERMISSIONS (OPTIMIZED)
-- ==============================
CREATE TABLE permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,

  permission_key VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255)

) ENGINE=InnoDB;


-- ==============================
-- EMPLOYEE PERMISSIONS (OPTIMIZED)
-- ==============================
CREATE TABLE employee_permissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  emp_id VARCHAR(20) NOT NULL,
  permission_id INT NOT NULL,

  -- 🔥 PREVENT DUPLICATE PERMISSIONS
  UNIQUE KEY uniq_emp_permission (emp_id, permission_id),

  -- 🔥 FAST JOIN INDEX
  INDEX idx_perm_emp (emp_id, permission_id),

  -- 🔥 REVERSE LOOKUP (WHO HAS THIS PERMISSION)
  INDEX idx_perm_reverse (permission_id, emp_id),

  CONSTRAINT fk_emp_perm_employee
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_emp_perm_permission
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
    ON DELETE CASCADE

) ENGINE=InnoDB;

-- ==============================
-- TICKET TYPES (OPTIMIZED)
-- ==============================
CREATE TABLE ticket_types (
  type_id INT AUTO_INCREMENT PRIMARY KEY,
  type_name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- ==============================
-- TICKET SUBTYPES (OPTIMIZED)
-- ==============================
CREATE TABLE ticket_subtypes (
  subtype_id INT AUTO_INCREMENT PRIMARY KEY,

  type_id INT NOT NULL,
  subtype_name VARCHAR(100) NOT NULL,

  -- 🔥 PREVENT DUPLICATE SUBTYPES
  UNIQUE KEY uniq_type_subtype (type_id, subtype_name),

  -- 🔥 FAST LOOKUP
  INDEX idx_subtype_type (type_id),

  CONSTRAINT fk_subtype_type
    FOREIGN KEY (type_id) REFERENCES ticket_types(type_id)
    ON DELETE CASCADE

) ENGINE=InnoDB;

-- ==============================
-- TICKETS (FULLY OPTIMIZED)
-- ==============================
CREATE TABLE tickets (

  id BIGINT AUTO_INCREMENT UNIQUE,

  ticket_id VARCHAR(20) PRIMARY KEY,

  type_of_ticket INT NOT NULL,
  subtype_of_ticket INT,

  priority ENUM('Low','Medium','High') DEFAULT 'Low',

  due_date DATETIME NOT NULL,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP 
    ON UPDATE CURRENT_TIMESTAMP,

  branch_id INT NOT NULL,
  assign_team INT NOT NULL,
  assigned_to VARCHAR(20) NULL,   -- ✅ already merged

  customer_id VARCHAR(50),

  customer_name VARCHAR(150) NOT NULL,
  reporter_name VARCHAR(150) NOT NULL,

  landmark VARCHAR(200),
  address TEXT NOT NULL,

  contact_number1 VARCHAR(15) NOT NULL,
  contact_number2 VARCHAR(15),

  more_details TEXT,

  status ENUM('Opened','In Progress','Closed') DEFAULT 'Opened',

  created_by VARCHAR(20),

  -- ==============================
  -- 🚀 PERFORMANCE INDEXES
  -- ==============================

  -- 🔥 MAIN FILTER INDEX (MOST USED)
  INDEX idx_ticket_main (branch_id, assign_team, status),

  -- 🔥 EMPLOYEE LOOKUP
  INDEX idx_ticket_assigned (assigned_to),

  -- 🔥 DATE SORTING
  INDEX idx_ticket_created (created_date),

  -- 🔥 CLOSED / FOLLOW-UP SORTING
  INDEX idx_ticket_updated (updated_at),

  -- 🔥 CUSTOMER SEARCH
  INDEX idx_ticket_customer (customer_id),

  -- 🔥 TYPE FILTERING
  INDEX idx_ticket_type (type_of_ticket, subtype_of_ticket),

  -- 🔥 PRIORITY FILTER
  INDEX idx_ticket_priority (priority),

  -- 🔥 COVERING INDEX (DASHBOARD)
  INDEX idx_ticket_dashboard (status, branch_id, assign_team, created_date),

  -- 🔥 HIGH VOLUME OPEN/CLOSED LISTS
  INDEX idx_ticket_status_created_branch_team (status, created_date, branch_id, assign_team),
  INDEX idx_ticket_status_updated_branch_team (status, updated_at, branch_id, assign_team),
  INDEX idx_ticket_created_by (created_by),

  -- ==============================
  -- 🔗 FOREIGN KEYS
  -- ==============================

  CONSTRAINT fk_ticket_type
    FOREIGN KEY (type_of_ticket) REFERENCES ticket_types(type_id),

  CONSTRAINT fk_ticket_subtype
    FOREIGN KEY (subtype_of_ticket) REFERENCES ticket_subtypes(subtype_id)
    ON DELETE SET NULL,

  CONSTRAINT fk_ticket_branch
    FOREIGN KEY (branch_id) REFERENCES branches(id),

  CONSTRAINT fk_ticket_team
    FOREIGN KEY (assign_team) REFERENCES teams(id),

  CONSTRAINT fk_ticket_employee
    FOREIGN KEY (assigned_to) REFERENCES employees(emp_id)
    ON DELETE SET NULL,

  CONSTRAINT fk_ticket_created_by
    FOREIGN KEY (created_by) REFERENCES employees(emp_id)
    ON DELETE SET NULL

) ENGINE=InnoDB;

-- ==============================
-- TICKET ATTACHMENTS (OPTIMIZED)
-- ==============================
CREATE TABLE ticket_attachments (

  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  ticket_id VARCHAR(20) NOT NULL,

  file_name VARCHAR(255),
  file_path VARCHAR(255) NOT NULL,

  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- 🔥 FAST LOOKUP
  INDEX idx_attachment_ticket (ticket_id),
  INDEX idx_attachment_ticket_uploaded (ticket_id, uploaded_at),

  CONSTRAINT fk_attachment_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
    ON DELETE CASCADE

) ENGINE=InnoDB;


-- ==============================
-- TICKET ACTIONS (OPTIMIZED)
-- ==============================
CREATE TABLE ticket_actions (

  action_id BIGINT AUTO_INCREMENT PRIMARY KEY,

  ticket_id VARCHAR(20) NOT NULL,

  action_type VARCHAR(100) NOT NULL,
  comments TEXT,

  action_by VARCHAR(20),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- 🔥 FAST QUERY INDEXES
  INDEX idx_action_ticket_time (ticket_id, created_at),
  INDEX idx_action_ticket_type_time (ticket_id, action_type, created_at),
  INDEX idx_action_by (action_by),

  CONSTRAINT fk_action_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_action_employee
    FOREIGN KEY (action_by) REFERENCES employees(emp_id)
    ON DELETE SET NULL

) ENGINE=InnoDB;

-- ==============================
-- TICKET RESOLUTIONS (OPTIMIZED)
-- ==============================
CREATE TABLE ticket_resolutions (

  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  ticket_id VARCHAR(20) NOT NULL,

  resolved_by VARCHAR(20),
  handled_by VARCHAR(20),

  issue_type INT,
  issue_sub_type VARCHAR(100),

  comments TEXT,

  resolved_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- 🔥 ONE RESOLUTION PER TICKET (OPTIONAL SAFETY)
  UNIQUE KEY uniq_ticket_resolution (ticket_id),

  -- 🔥 FAST LOOKUP
  INDEX idx_resolution_ticket (ticket_id),
  INDEX idx_resolved_by (resolved_by),

  CONSTRAINT fk_resolution_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_resolution_resolved_by
    FOREIGN KEY (resolved_by) REFERENCES employees(emp_id)
    ON DELETE SET NULL,

  CONSTRAINT fk_resolution_handled_by
    FOREIGN KEY (handled_by) REFERENCES employees(emp_id)
    ON DELETE SET NULL

) ENGINE=InnoDB;

-- ==============================
-- TICKET ASSIGNMENTS (OPTIMIZED)
-- ==============================
CREATE TABLE ticket_assignments (

  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  ticket_id VARCHAR(20) NOT NULL,

  from_team INT,
  to_team INT,

  from_employee VARCHAR(20),
  to_employee VARCHAR(20),

  assigned_by VARCHAR(20),
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- 🔥 FAST HISTORY FETCH
  INDEX idx_ticket_time (ticket_id, assigned_at),

  -- 🔥 EMPLOYEE LOOKUP
  INDEX idx_to_employee (to_employee),

  CONSTRAINT fk_ta_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_ta_from_emp
    FOREIGN KEY (from_employee) REFERENCES employees(emp_id)
    ON DELETE SET NULL,

  CONSTRAINT fk_ta_to_emp
    FOREIGN KEY (to_employee) REFERENCES employees(emp_id)
    ON DELETE SET NULL,

  CONSTRAINT fk_ta_assigned_by
    FOREIGN KEY (assigned_by) REFERENCES employees(emp_id)
    ON DELETE SET NULL

) ENGINE=InnoDB;

-- ==============================
-- 🔥 FAST ASSIGNMENT HISTORY QUERY
-- ==============================
SELECT 
  ta.ticket_id,

  ta.from_employee,
  e1.name AS from_name,

  ta.to_employee,
  e2.name AS to_name,

  ta.from_team,
  ta.to_team,

  ta.assigned_by,
  e3.name AS assigned_by_name,

  ta.assigned_at

FROM ticket_assignments ta

LEFT JOIN employees e1 
  ON ta.from_employee = e1.emp_id

LEFT JOIN employees e2 
  ON ta.to_employee = e2.emp_id

LEFT JOIN employees e3 
  ON ta.assigned_by = e3.emp_id

ORDER BY ta.assigned_at DESC;


-- ==============================
-- EMPLOYEE BRANCHES EXTRA INDEX
-- ==============================
CREATE INDEX idx_emp_module 
ON employee_branches(emp_id, module);

-- ==============================
-- EMPLOYEE AREAS EXTRA INDEX
-- ==============================
CREATE INDEX idx_employee_areas_emp_only
ON employee_areas(emp_id);

-- ==============================
-- EMPLOYEES STATUS INDEX
-- ==============================
CREATE INDEX idx_emp_active 
ON employees(status, role);

-- ==============================
-- TRIGGER: SINGLE PRIMARY BRANCH
-- ==============================
DELIMITER $$

CREATE TRIGGER before_insert_employee_branches
BEFORE INSERT ON employee_branches
FOR EACH ROW
BEGIN
  IF NEW.access_type = 'PRIMARY' THEN
    IF (SELECT COUNT(*) 
        FROM employee_branches 
        WHERE emp_id = NEW.emp_id 
          AND access_type = 'PRIMARY') > 0 THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Only one PRIMARY branch allowed';
    END IF;
  END IF;
END$$

DELIMITER ;

CREATE TABLE payslips (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  payslip_no VARCHAR(40) NOT NULL UNIQUE,

  employee_id INT NOT NULL,

  salary_month TINYINT NOT NULL,
  salary_year SMALLINT NOT NULL,
  salary_date DATE NOT NULL,
  account_number VARCHAR(50),
  lop DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  salary_days DECIMAL(10,2) NOT NULL DEFAULT 0.00,

  total_earnings DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  net_pay DECIMAL(12,2) NOT NULL DEFAULT 0.00,

  remarks VARCHAR(255) DEFAULT NULL,

  created_by INT DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_employee_month (employee_id, salary_month, salary_year),

  INDEX idx_payslip_employee (employee_id),
  INDEX idx_payslip_month_year (salary_month, salary_year),
  INDEX idx_payslip_date (salary_date),
  INDEX idx_payslip_created_by (created_by),

  CONSTRAINT fk_payslip_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_payslip_created_by
    FOREIGN KEY (created_by) REFERENCES employees(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE payslip_components (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  payslip_id BIGINT NOT NULL,

  component_key VARCHAR(50) NOT NULL,
  component_label VARCHAR(100) NOT NULL,
  component_type ENUM('EARNING', 'DEDUCTION') NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,

  UNIQUE KEY uniq_payslip_component (payslip_id, component_key),

  INDEX idx_component_payslip (payslip_id),
  INDEX idx_component_type (component_type),

  CONSTRAINT fk_component_payslip
    FOREIGN KEY (payslip_id) REFERENCES payslips(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE relieving_letters (
  id INT AUTO_INCREMENT PRIMARY KEY,

  employee_id INT NOT NULL,
  document_id VARCHAR(30) NOT NULL UNIQUE,

  letter_date DATE NOT NULL,
  relieving_date DATE NOT NULL,

  last_working_date DATE NOT NULL,
  date_of_joining DATE NOT NULL,

  remarks VARCHAR(255) DEFAULT NULL,
  file_path VARCHAR(255) DEFAULT NULL,

  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_relieving_employee (employee_id),
  INDEX idx_relieving_date (relieving_date),
  INDEX idx_letter_date (letter_date),
  INDEX idx_relieving_created_by (created_by),
  INDEX idx_relieving_emp_date (employee_id, relieving_date),

  CONSTRAINT fk_relieving_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_relieving_created_by
    FOREIGN KEY (created_by) REFERENCES employees(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE offer_letters (
  id INT AUTO_INCREMENT PRIMARY KEY,

  document_id VARCHAR(100) UNIQUE,

  employee_name VARCHAR(150),
  email VARCHAR(150),
  phone VARCHAR(20),
  location VARCHAR(100),
  designation VARCHAR(100),
  team_name VARCHAR(100),

  doj DATE,
  gender ENUM('MALE','FEMALE','OTHERS'),
  marital_status ENUM('SINGLE','MARRIED'),

  grade VARCHAR(10),
  probation_period INT,

  gross_pay INT,
  insurance INT,

  basic INT,
  hra INT,
  other_allowance INT,
  gross_salary_a INT,

  esi_employee INT,
  pf_employee INT,
  total_deduction_a INT,
  take_home INT,

  esi_employer INT,
  pf_employer INT,
  total_deduction_b INT,

  monthly_ctc INT,
  annual_ctc INT,

  gross_pay_words TEXT,
  file_path VARCHAR(255) NULL,

  generated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_year ON offer_letters (generated_date);
CREATE INDEX idx_doc ON offer_letters (document_id);
CREATE INDEX idx_employee ON offer_letters (employee_name);
ALTER TABLE offer_letters ADD created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX idx_offer_letters_fast 
ON offer_letters(employee_name, location, team_name, doj);

ALTER TABLE offer_letters 
ADD zone_id INT AFTER phone,
ADD branch_id INT AFTER zone_id;

-- ❌ REMOVE location (since branch = location)
-- location column retained intentionally to avoid destructive schema changes
-- and to keep backward compatibility with existing data and templates.

-- ✅ Index for performance
CREATE INDEX idx_zone_branch 
ON offer_letters(zone_id, branch_id);

-- SALES hierarchy
INSERT INTO designations (team_id, designation_name, level, is_manager)
SELECT id, 'CMO', 6, 1 FROM teams WHERE team_name='SALES';

INSERT INTO designations (team_id, designation_name, level, is_manager)
SELECT id, 'ASM', 5, 1 FROM teams WHERE team_name='SALES';

INSERT INTO designations (team_id, designation_name, level, is_manager)
SELECT id, 'TELESALES', 3, 0 FROM teams WHERE team_name='SALES';

INSERT INTO designations (team_id, designation_name, level, is_manager)
SELECT id, 'BDM', 2, 1 FROM teams WHERE team_name='SALES';

INSERT INTO designations (team_id, designation_name, level, is_manager)
SELECT id, 'BDE', 2, 0 FROM teams WHERE team_name='SALES';

INSERT INTO designations (team_id, designation_name, level, is_manager)
SELECT id, 'BDO', 2, 0 FROM teams WHERE team_name='SALES';

INSERT INTO designations (team_id, designation_name, level, is_manager)
SELECT id, 'MIS', 3, 0 FROM teams WHERE team_name='SALES';

-- IT designation (required for Super Admin)
INSERT INTO designations (team_id, designation_name, level, is_manager)
SELECT id, 'MANAGER', 6, 1
FROM teams
WHERE team_name='IT';

-- SALES hierarchy
UPDATE designations d
JOIN teams t ON d.team_id = t.id
SET d.level = CASE d.designation_name
    WHEN 'CMO' THEN 9
    WHEN 'ASM' THEN 6
    WHEN 'BDM' THEN 2
    WHEN 'TELESALES' THEN 3
    WHEN 'BDE' THEN 2
    WHEN 'BDO' THEN 2
    WHEN 'MIS' THEN 4
    ELSE d.level
END,
d.is_manager = CASE d.designation_name
    WHEN 'CMO' THEN 1
    WHEN 'ASM' THEN 1
    ELSE 0
END
WHERE t.team_name = 'SALES';

-- IT designation
UPDATE designations d
JOIN teams t ON d.team_id = t.id
SET d.level = 6, d.is_manager = 1
WHERE t.team_name = 'IT' AND d.designation_name='MANAGER';    

/* =========================================================
   DESIGNATION MANAGER MAPPING - PRODUCTION LEVEL
   Higher number = higher authority
   ========================================================= */

/* TECHNICAL */
UPDATE designations d
JOIN teams t ON t.id = d.team_id
SET d.level = 1, d.is_manager = 0, d.manager_scope = 'NONE'
WHERE UPPER(t.team_name) = 'TECHNICAL'
  AND UPPER(d.designation_name) = 'TRAINEE TECHNICAL';

UPDATE designations d
JOIN teams t ON t.id = d.team_id
SET d.level = 2, d.is_manager = 0, d.manager_scope = 'NONE'
WHERE UPPER(t.team_name) = 'TECHNICAL'
  AND UPPER(d.designation_name) = 'JR EXECUTIVE TECHNICAL';

UPDATE designations d
JOIN teams t ON t.id = d.team_id
SET d.level = 3, d.is_manager = 0, d.manager_scope = 'NONE'
WHERE UPPER(t.team_name) = 'TECHNICAL'
  AND UPPER(d.designation_name) = 'EXECUTIVE TECHNICAL';

UPDATE designations d
JOIN teams t ON t.id = d.team_id
SET d.level = 4, d.is_manager = 0, d.manager_scope = 'NONE'
WHERE UPPER(t.team_name) = 'TECHNICAL'
  AND UPPER(d.designation_name) = 'SR EXECUTIVE TECHNICAL';

UPDATE designations d
JOIN teams t ON t.id = d.team_id
SET d.level = 5, d.is_manager = 1, d.manager_scope = 'BRANCH'
WHERE UPPER(t.team_name) = 'TECHNICAL'
  AND UPPER(d.designation_name) = 'ASST BRANCH INCHARGE';

UPDATE designations d
JOIN teams t ON t.id = d.team_id
SET d.level = 6, d.is_manager = 1, d.manager_scope = 'BRANCH'
WHERE UPPER(t.team_name) = 'TECHNICAL'
  AND UPPER(d.designation_name) = 'BRANCH INCHARGE';

UPDATE designations d
JOIN teams t ON t.id = d.team_id
SET d.level = 7, d.is_manager = 1, d.manager_scope = 'ZONE'
WHERE UPPER(t.team_name) = 'TECHNICAL'
  AND UPPER(d.designation_name) = 'ASST TECH LEAD';

UPDATE designations d
JOIN teams t ON t.id = d.team_id
SET d.level = 8, d.is_manager = 1, d.manager_scope = 'ZONE'
WHERE UPPER(t.team_name) = 'TECHNICAL'
  AND UPPER(d.designation_name) = 'TECH LEAD';

/* SALES */
UPDATE designations d
JOIN teams t ON t.id = d.team_id
SET d.level = 2, d.is_manager = 0, d.manager_scope = 'NONE'
WHERE UPPER(t.team_name) = 'SALES'
  AND UPPER(d.designation_name) IN ('BDE', 'BDO', 'BDM');

UPDATE designations d
JOIN teams t ON t.id = d.team_id
SET d.level = 4, d.is_manager = 0, d.manager_scope = 'NONE'
WHERE UPPER(t.team_name) = 'SALES'
  AND UPPER(d.designation_name) IN ('MIS', 'MIS EXECUTIVE', 'VENDOR COORDINATOR', 'SERVICE SUPPORT');

UPDATE designations d
JOIN teams t ON t.id = d.team_id
SET d.level = 6, d.is_manager = 1, d.manager_scope = 'ZONE'
WHERE UPPER(t.team_name) = 'SALES'
  AND UPPER(d.designation_name) = 'ASM';

UPDATE designations d
JOIN teams t ON t.id = d.team_id
SET d.level = 9, d.is_manager = 1, d.manager_scope = 'GLOBAL'
WHERE UPPER(t.team_name) = 'SALES'
  AND UPPER(d.designation_name) IN ('CMO', 'SALES HEAD');

/* HEAD OFFICE GENERIC */
UPDATE designations
SET level = 5, is_manager = 1, manager_scope = 'TEAM'
WHERE UPPER(designation_name) IN ('ASST MANAGER', 'ASSISTANT MANAGER');

UPDATE designations
SET level = 6, is_manager = 1, manager_scope = 'TEAM'
WHERE UPPER(designation_name) = 'MANAGER';

UPDATE designations
SET level = 9, is_manager = 1, manager_scope = 'GLOBAL'
WHERE UPPER(designation_name) = 'CTO';

UPDATE designations
SET level = 10, is_manager = 1, manager_scope = 'GLOBAL'
WHERE UPPER(designation_name) = 'CEO';

UPDATE designations
SET level = 11, is_manager = 1, manager_scope = 'GLOBAL'
WHERE UPPER(designation_name) = 'MD';

/* =========================================================
   REPORTING RULES
   Auto-manager fallback in backend uses these rules recursively:
   Technical staff -> Branch Incharge -> Tech Lead -> CTO -> CEO -> MD
   Technical Branch Incharge -> Tech Lead -> CTO -> CEO -> MD
   Sales staff -> ASM -> CMO / Sales Head -> CEO -> MD
   Head Office staff -> Manager -> CTO -> CEO -> MD
   ========================================================= */

INSERT IGNORE INTO designation_reporting_rules
(child_designation_id, parent_designation_id, same_team_only, same_branch_only, same_zone_only)
SELECT c.id, p.id, 1, 1, 0
FROM designations c
JOIN teams tc ON tc.id = c.team_id
JOIN designations p
JOIN teams tp ON tp.id = p.team_id
WHERE UPPER(tc.team_name) = 'TECHNICAL'
  AND UPPER(tp.team_name) = 'TECHNICAL'
  AND UPPER(c.designation_name) IN (
    'TRAINEE TECHNICAL',
    'JR EXECUTIVE TECHNICAL',
    'EXECUTIVE TECHNICAL',
    'SR EXECUTIVE TECHNICAL'
  )
  AND UPPER(p.designation_name) IN (
    'ASST BRANCH INCHARGE',
    'BRANCH INCHARGE'
  );

INSERT IGNORE INTO designation_reporting_rules
(child_designation_id, parent_designation_id, same_team_only, same_branch_only, same_zone_only)
SELECT c.id, p.id, 1, 0, 1
FROM designations c
JOIN teams tc ON tc.id = c.team_id
JOIN designations p
JOIN teams tp ON tp.id = p.team_id
WHERE UPPER(tc.team_name) = 'TECHNICAL'
  AND UPPER(tp.team_name) = 'TECHNICAL'
  AND UPPER(c.designation_name) IN (
    'ASST BRANCH INCHARGE',
    'BRANCH INCHARGE'
  )
  AND UPPER(p.designation_name) IN (
    'ASST TECH LEAD',
    'TECH LEAD'
  );

INSERT IGNORE INTO designation_reporting_rules
(child_designation_id, parent_designation_id, same_team_only, same_branch_only, same_zone_only)
SELECT c.id, p.id, 0, 0, 0
FROM designations c
JOIN designations p
WHERE UPPER(c.designation_name) IN ('ASST TECH LEAD', 'TECH LEAD')
  AND UPPER(p.designation_name) = 'CTO';

INSERT IGNORE INTO designation_reporting_rules
(child_designation_id, parent_designation_id, same_team_only, same_branch_only, same_zone_only)
SELECT c.id, p.id, 1, 0, 1
FROM designations c
JOIN teams tc ON tc.id = c.team_id
JOIN designations p
JOIN teams tp ON tp.id = p.team_id
WHERE UPPER(tc.team_name) = 'SALES'
  AND UPPER(tp.team_name) = 'SALES'
  AND UPPER(c.designation_name) IN ('BDE', 'BDO', 'BDM')
  AND UPPER(p.designation_name) = 'ASM';

INSERT IGNORE INTO designation_reporting_rules
(child_designation_id, parent_designation_id, same_team_only, same_branch_only, same_zone_only)
SELECT c.id, p.id, 1, 0, 0
FROM designations c
JOIN teams tc ON tc.id = c.team_id
JOIN designations p
JOIN teams tp ON tp.id = p.team_id
WHERE UPPER(tc.team_name) = 'SALES'
  AND UPPER(tp.team_name) = 'SALES'
  AND UPPER(c.designation_name) = 'ASM'
  AND UPPER(p.designation_name) IN ('CMO', 'SALES HEAD');

INSERT IGNORE INTO designation_reporting_rules
(child_designation_id, parent_designation_id, same_team_only, same_branch_only, same_zone_only)
SELECT c.id, p.id, 1, 0, 0
FROM designations c
JOIN teams tc ON tc.id = c.team_id
JOIN designations p
JOIN teams tp ON tp.id = p.team_id
WHERE UPPER(tc.team_name) = 'SALES'
  AND UPPER(tp.team_name) = 'SALES'
  AND UPPER(c.designation_name) IN ('MIS', 'MIS EXECUTIVE', 'VENDOR COORDINATOR', 'SERVICE SUPPORT')
  AND UPPER(p.designation_name) IN ('CMO', 'SALES HEAD');

INSERT IGNORE INTO designation_reporting_rules
(child_designation_id, parent_designation_id, same_team_only, same_branch_only, same_zone_only)
SELECT c.id, p.id, 1, 0, 0
FROM designations c
JOIN designations p ON c.team_id = p.team_id
WHERE (
    UPPER(c.designation_name) LIKE 'TRAINEE %'
    OR UPPER(c.designation_name) LIKE 'JR EXECUTIVE %'
    OR UPPER(c.designation_name) LIKE 'EXECUTIVE %'
    OR UPPER(c.designation_name) LIKE 'SR EXECUTIVE %'
  )
  AND UPPER(p.designation_name) IN ('MANAGER', 'ASST MANAGER', 'ASSISTANT MANAGER');

INSERT IGNORE INTO designation_reporting_rules
(child_designation_id, parent_designation_id, same_team_only, same_branch_only, same_zone_only)
SELECT c.id, p.id, 0, 0, 0
FROM designations c
JOIN designations p
WHERE UPPER(c.designation_name) IN ('MANAGER', 'ASST MANAGER', 'ASSISTANT MANAGER')
  AND UPPER(p.designation_name) = 'CTO';

INSERT IGNORE INTO designation_reporting_rules
(child_designation_id, parent_designation_id, same_team_only, same_branch_only, same_zone_only)
SELECT c.id, p.id, 0, 0, 0
FROM designations c
JOIN designations p
WHERE UPPER(c.designation_name) IN ('CMO', 'SALES HEAD', 'CTO')
  AND UPPER(p.designation_name) IN ('CEO', 'MD');

INSERT IGNORE INTO designation_reporting_rules
(child_designation_id, parent_designation_id, same_team_only, same_branch_only, same_zone_only)
SELECT c.id, p.id, 0, 0, 0
FROM designations c
JOIN designations p
WHERE UPPER(c.designation_name) = 'CEO'
  AND UPPER(p.designation_name) = 'MD';


CREATE TABLE manpower_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    request_number VARCHAR(30) NOT NULL UNIQUE,

    -- EMPLOYEE
    employee_emp_id VARCHAR(20) NOT NULL,
    employee_name VARCHAR(120) NOT NULL,

    zone VARCHAR(50) NOT NULL,
    branch VARCHAR(50) NOT NULL,
    department VARCHAR(100) NOT NULL,
    designation VARCHAR(120) NOT NULL,

    request_type ENUM('New Openings','Replacement') NOT NULL,

    -- 🔥 ROLE BASED (IMPORTANT FOR FILTER)
    requester_emp_id VARCHAR(20) NOT NULL,
    manager_emp_id VARCHAR(20),
    cto_emp_id VARCHAR(20),
    hr_emp_id VARCHAR(20),
    recruiter_emp_id VARCHAR(20),

    -- STATUS
    manager_status ENUM('Pending','Approved','Rejected') DEFAULT 'Pending',
    cto_status ENUM('Pending','Approved','Rejected') DEFAULT 'Pending',
    hr_status ENUM('Pending','Approved','Rejected') DEFAULT 'Pending',
    recruiter_status ENUM('Pending','Received','In Progress','Closed') DEFAULT 'Pending',

    final_status VARCHAR(50) DEFAULT 'Submitted',

    -- EXTRA
    openings SMALLINT DEFAULT 1,
    salary_range INT,
    priority_level ENUM('Low','Medium','High','Urgent') DEFAULT 'Medium',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    /* ================= 🔥 INDEXES ================= */

    -- 🔥 MAIN FILTER (MOST IMPORTANT)
    INDEX idx_role_visibility (requester_emp_id, manager_emp_id, cto_emp_id, hr_emp_id, recruiter_emp_id),

    -- 🔥 SEARCH + FILTER
    INDEX idx_search (request_number, employee_emp_id, employee_name),

    -- 🔥 STATUS FILTER
    INDEX idx_status (final_status),

    -- 🔥 DEPARTMENT FILTER
    INDEX idx_department (department),

    -- 🔥 SORTING
    INDEX idx_created (created_at DESC),

    -- 🔥 COMBINED (VERY FAST API)
    INDEX idx_fast_filter (final_status, department, created_at DESC)

) ENGINE=InnoDB;  

ALTER TABLE manpower_requests
ADD experience_required VARCHAR(50),
ADD key_skills TEXT,
ADD reason_for_requirement TEXT;

ALTER TABLE manpower_requests
ADD COLUMN reporting_manager_emp_id VARCHAR(20),
ADD CONSTRAINT fk_reporting_manager
FOREIGN KEY (reporting_manager_emp_id) REFERENCES employees(emp_id)
ON DELETE SET NULL;

ALTER TABLE manpower_requests
ADD CONSTRAINT fk_mr_requester FOREIGN KEY (requester_emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE,
ADD CONSTRAINT fk_mr_manager FOREIGN KEY (manager_emp_id) REFERENCES employees(emp_id) ON DELETE SET NULL,
ADD CONSTRAINT fk_mr_cto FOREIGN KEY (cto_emp_id) REFERENCES employees(emp_id) ON DELETE SET NULL,
ADD CONSTRAINT fk_mr_hr FOREIGN KEY (hr_emp_id) REFERENCES employees(emp_id) ON DELETE SET NULL,
ADD CONSTRAINT fk_mr_recruiter FOREIGN KEY (recruiter_emp_id) REFERENCES employees(emp_id) ON DELETE SET NULL;

-- sync_manpower_location trigger removed from bootstrap schema because
-- manpower_requests stores text fields directly and does not contain
-- zone_id / branch_id / team_id / designation_id columns consistently.

DELIMITER $$

CREATE TRIGGER enforce_manpower_flow
BEFORE UPDATE ON manpower_requests
FOR EACH ROW
BEGIN
  -- Manager stage first
  IF NEW.manager_status = 'Approved' AND OLD.manager_status <> 'Approved' THEN
    IF OLD.final_status NOT IN ('Submitted', 'Manager Rejected') THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Manager approval must be the first stage';
    END IF;
  END IF;

  -- HR after manager
  IF NEW.hr_status = 'Approved' AND OLD.hr_status <> 'Approved' THEN
    IF OLD.manager_status <> 'Approved' THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Manager approval required before HR';
    END IF;
  END IF;

  -- Management after HR
  IF NEW.cto_status = 'Approved' AND OLD.cto_status <> 'Approved' THEN
    IF OLD.hr_status <> 'Approved' THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'HR approval required before Management';
    END IF;
  END IF;
END$$

DELIMITER ;

DELIMITER $$

CREATE TRIGGER before_update_employee_branches
BEFORE UPDATE ON employee_branches
FOR EACH ROW
BEGIN
  IF NEW.access_type = 'PRIMARY' THEN
    IF (SELECT COUNT(*) 
        FROM employee_branches 
        WHERE emp_id = NEW.emp_id 
          AND access_type = 'PRIMARY'
          AND id != NEW.id) > 0 THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Only one PRIMARY branch allowed';
    END IF;
  END IF;
END$$

DELIMITER ;

CREATE TABLE manpower_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    request_id BIGINT NOT NULL,

    stage VARCHAR(50),
    action_taken VARCHAR(50),

    actor_emp_id VARCHAR(20),
    actor_name VARCHAR(120),

    comments VARCHAR(500),

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    /* 🔥 PERFORMANCE INDEXES */
    INDEX idx_request_logs (request_id, created_at DESC),

    CONSTRAINT fk_logs_request
      FOREIGN KEY (request_id)
      REFERENCES manpower_requests(id)
      ON DELETE CASCADE

) ENGINE=InnoDB;  

CREATE TABLE request_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_type ENUM('UNIFORM', 'BUSINESS_CARD', 'ID_CARD') NOT NULL,
  zone_id INT NOT NULL,
  branch_id INT NOT NULL,
  employee_id VARCHAR(50) NOT NULL,
  employee_name VARCHAR(100) NOT NULL,
  designation VARCHAR(100) DEFAULT NULL,
  department VARCHAR(100) DEFAULT NULL,
  mobile_no VARCHAR(20) DEFAULT NULL,

  shirt_size VARCHAR(20) DEFAULT NULL,
  pant_size VARCHAR(20) DEFAULT NULL,
  tshirt_size VARCHAR(20) DEFAULT NULL,
  blazer_size VARCHAR(20) DEFAULT NULL,
  shoe_size VARCHAR(20) DEFAULT NULL,

  quantity INT NOT NULL DEFAULT 1,
  remarks TEXT DEFAULT NULL,

  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  review_comment TEXT DEFAULT NULL,
  reviewed_by_role VARCHAR(50) DEFAULT NULL,
  reviewed_by_name VARCHAR(100) DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_request_zone
    FOREIGN KEY (zone_id) REFERENCES zones(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_request_branch
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB;

ALTER TABLE request_entries
ADD COLUMN request_code VARCHAR(50) NULL AFTER id;

CREATE UNIQUE INDEX uq_request_entries_request_code
ON request_entries(request_code);

CREATE INDEX idx_request_entries_type_branch_id
ON request_entries(request_type, branch_id, id);

-- CREATE TABLE block_master (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   block_name VARCHAR(150) NOT NULL UNIQUE,
--   is_active TINYINT(1) NOT NULL DEFAULT 1,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB;

-- CREATE TABLE connection_type_master (
--   id INT PRIMARY KEY AUTO_INCREMENT,
--   connection_type_name VARCHAR(100) NOT NULL UNIQUE,
--   is_active TINYINT(1) NOT NULL DEFAULT 1,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB;

-- CREATE TABLE connection_mode_master (
--   id INT PRIMARY KEY AUTO_INCREMENT,
--   connection_mode_name VARCHAR(100) NOT NULL UNIQUE,
--   is_active TINYINT(1) NOT NULL DEFAULT 1,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB;

-- CREATE TABLE plan_master (
--   id INT PRIMARY KEY AUTO_INCREMENT,
--   plan_name VARCHAR(200) NOT NULL UNIQUE,
--   is_active TINYINT(1) NOT NULL DEFAULT 1,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB;

-- CREATE TABLE payment_mode_master (
--   id INT PRIMARY KEY AUTO_INCREMENT,
--   payment_mode_name VARCHAR(100) NOT NULL UNIQUE,
--   is_active TINYINT(1) NOT NULL DEFAULT 1,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB;

-- CREATE TABLE ip_type_master (
--   id INT PRIMARY KEY AUTO_INCREMENT,
--   ip_type_name VARCHAR(100) NOT NULL UNIQUE,
--   is_active TINYINT(1) NOT NULL DEFAULT 1,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB;

-- CREATE TABLE device_mode_master (
--   id INT PRIMARY KEY AUTO_INCREMENT,
--   device_mode_name VARCHAR(100) NOT NULL UNIQUE,
--   is_active TINYINT(1) NOT NULL DEFAULT 1,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB;

-- CREATE TABLE status_master (
--   id INT PRIMARY KEY AUTO_INCREMENT,
--   status_name VARCHAR(100) NOT NULL UNIQUE,
--   is_active TINYINT(1) NOT NULL DEFAULT 1,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB;

-- CREATE TABLE connected_branch_master (
--   id INT PRIMARY KEY AUTO_INCREMENT,
--   connected_branch_name VARCHAR(150) NOT NULL UNIQUE,
--   is_active TINYINT(1) NOT NULL DEFAULT 1,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- ) ENGINE=InnoDB;

-- CREATE TABLE customer_master (
--   id BIGINT PRIMARY KEY AUTO_INCREMENT,

--   zone_id INT NULL,
--   branch_id INT NULL,
--   block_id INT NULL,

--   connection_type_id INT NULL,
--   connection_mode_id INT NULL,
--   plan_id INT NULL,
--   payment_mode_id INT NULL,
--   ip_type_id INT NULL,
--   device_mode_id INT NULL,
--   status_id INT NULL,
--   connected_branch_id INT NULL,

--   zone VARCHAR(100),
--   branch VARCHAR(150),
--   block_name VARCHAR(150),

--   customer_id VARCHAR(100) NOT NULL UNIQUE,
--   customer_name VARCHAR(255) NOT NULL,
--   customer_mail_id VARCHAR(255),

--   connection_type VARCHAR(100),
--   connection_mode VARCHAR(100),
--   planname VARCHAR(200),
--   planamount DECIMAL(10,2),
--   payment_mode VARCHAR(100),

--   mobile_1 VARCHAR(30),
--   mobile_2 VARCHAR(30),

--   lat VARCHAR(50),
--   lng VARCHAR(50),
--   lat_long VARCHAR(100),

--   ip_type VARCHAR(100),
--   ip_address VARCHAR(255),
--   ip_url VARCHAR(255),

--   sm_device VARCHAR(150),
--   pon VARCHAR(100),
--   fiber_distribution_box_no VARCHAR(150),
--   cpe_serial_number VARCHAR(150),
--   cpe_mac VARCHAR(100),
--   signal_value VARCHAR(100),
--   device_mode VARCHAR(100),

--   bridge_ip VARCHAR(255),
--   bridge_ip_url VARCHAR(255),
--   cpe_port VARCHAR(100),
--   cpe_username VARCHAR(150),
--   cpe_password VARCHAR(150),

--   customer_scope VARCHAR(255),
--   connected_branch VARCHAR(150),
--   other_zone_name VARCHAR(150),

--   tower_name VARCHAR(150),
--   ssid VARCHAR(150),
--   ap_ip VARCHAR(255),
--   ap_url VARCHAR(255),

--   nld_name VARCHAR(150),
--   nld_id VARCHAR(100),
--   tower_id VARCHAR(100),
--   olt_ip VARCHAR(255),
--   aaa_server_mode VARCHAR(100),

--   status VARCHAR(100),
--   conn_startdate VARCHAR(50),
--   verified_customer_data VARCHAR(255),

--   user_id VARCHAR(100),
--   user_name VARCHAR(150),

--   branch_mail VARCHAR(255),
--   zone_mail VARCHAR(255),
--   department_mail VARCHAR(255),
--   super_user_mail VARCHAR(255),

--   admin_name VARCHAR(150),

--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

--   CONSTRAINT fk_customer_zone
--     FOREIGN KEY (zone_id) REFERENCES zones(id)
--     ON DELETE SET NULL ON UPDATE CASCADE,

--   CONSTRAINT fk_customer_branch
--     FOREIGN KEY (branch_id) REFERENCES branches(id)
--     ON DELETE SET NULL ON UPDATE CASCADE,

--   CONSTRAINT fk_customer_block
--     FOREIGN KEY (block_id) REFERENCES block_master(id)
--     ON DELETE SET NULL ON UPDATE CASCADE,

--   CONSTRAINT fk_customer_connection_type
--     FOREIGN KEY (connection_type_id) REFERENCES connection_type_master(id)
--     ON DELETE SET NULL ON UPDATE CASCADE,

--   CONSTRAINT fk_customer_connection_mode
--     FOREIGN KEY (connection_mode_id) REFERENCES connection_mode_master(id)
--     ON DELETE SET NULL ON UPDATE CASCADE,

--   CONSTRAINT fk_customer_plan
--     FOREIGN KEY (plan_id) REFERENCES plan_master(id)
--     ON DELETE SET NULL ON UPDATE CASCADE,

--   CONSTRAINT fk_customer_payment_mode
--     FOREIGN KEY (payment_mode_id) REFERENCES payment_mode_master(id)
--     ON DELETE SET NULL ON UPDATE CASCADE,

--   CONSTRAINT fk_customer_ip_type
--     FOREIGN KEY (ip_type_id) REFERENCES ip_type_master(id)
--     ON DELETE SET NULL ON UPDATE CASCADE,

--   CONSTRAINT fk_customer_device_mode
--     FOREIGN KEY (device_mode_id) REFERENCES device_mode_master(id)
--     ON DELETE SET NULL ON UPDATE CASCADE,

--   CONSTRAINT fk_customer_status
--     FOREIGN KEY (status_id) REFERENCES status_master(id)
--     ON DELETE SET NULL ON UPDATE CASCADE,

--   CONSTRAINT fk_customer_connected_branch
--     FOREIGN KEY (connected_branch_id) REFERENCES connected_branch_master(id)
--     ON DELETE SET NULL ON UPDATE CASCADE
-- ) ENGINE=InnoDB;

-- CREATE INDEX idx_customer_name ON customer_master(customer_name);
-- CREATE INDEX idx_customer_id ON customer_master(customer_id);
-- CREATE INDEX idx_zone ON customer_master(zone);
-- CREATE INDEX idx_branch ON customer_master(branch);
-- CREATE INDEX idx_status ON customer_master(status);
-- CREATE INDEX idx_connection_type ON customer_master(connection_type);
-- CREATE INDEX idx_connection_mode ON customer_master(connection_mode);
-- CREATE INDEX idx_planname ON customer_master(planname);
-- CREATE INDEX idx_payment_mode ON customer_master(payment_mode);
-- CREATE INDEX idx_ip_type ON customer_master(ip_type);
-- CREATE INDEX idx_device_mode ON customer_master(device_mode);
-- CREATE INDEX idx_connected_branch ON customer_master(connected_branch);
-- CREATE INDEX idx_mobile_1 ON customer_master(mobile_1);
-- CREATE INDEX idx_customer_mail_id ON customer_master(customer_mail_id);
-- CREATE INDEX idx_zone_branch_status ON customer_master(zone, branch, status);
-- CREATE INDEX idx_customer_name_mobile ON customer_master(customer_name, mobile_1);  

-- DROP INDEX idx_zone ON customer_master;
-- DROP INDEX idx_branch ON customer_master;
-- DROP INDEX idx_status ON customer_master;

-- CREATE INDEX idx_customer_main 
-- ON customer_master(zone, branch, status);

-- ALTER TABLE employees ADD COLUMN deleted_at DATETIME NULL;
-- ALTER TABLE tickets ADD COLUMN deleted_at DATETIME NULL;
-- ALTER TABLE customer_master ADD COLUMN deleted_at DATETIME NULL;

-- -- Only structure note (you must hash in backend)
-- ALTER TABLE employees MODIFY password VARCHAR(255) NOT NULL COMMENT 'Store BCRYPT HASH ONLY'; 

-- CREATE TABLE audit_logs (
--   id BIGINT AUTO_INCREMENT PRIMARY KEY,
--   user_emp_id VARCHAR(20),
--   action VARCHAR(100),
--   table_name VARCHAR(100),
--   record_id VARCHAR(50),
--   old_data JSON,
--   new_data JSON,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

--   INDEX idx_audit_user (user_emp_id),
--   INDEX idx_audit_table (table_name)
-- );


