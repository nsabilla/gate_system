-- Master Table for PFS Forging Processes
CREATE TABLE IF NOT EXISTS master_pfs_forging_process (
    id SERIAL PRIMARY KEY,
    process_name VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Data
INSERT INTO master_pfs_forging_process (process_name) VALUES
('Cutting'),
('Heating'),
('Forging'),
('Pierching & Trimming'),
('Heat Treatment'),
('Shot Blasting'),
('Turning 1 #OP-1'),
('Turning 2 #OP-2'),
('Broaching'),
('Stamping'),
('Packing + Anti Rust'),
('Delivery')
ON CONFLICT (process_name) DO NOTHING;
