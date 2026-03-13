ALTER TABLE application
MODIFY COLUMN position_type ENUM('Full-time', 'Part-time', 'Contractor', 'Internship') NOT NULL;
