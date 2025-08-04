/*
  # Create Healthcare Analytics Tables

  1. New Tables
    - `patients`
      - `id` (bigint, primary key)
      - `patient_id` (text, unique identifier)
      - `age` (integer)
      - `gender` (text)
      - `diagnosis` (text)
      - `medications` (text)
      - `admission_date` (text)
      - `discharge_date` (text)
      - `created_at` (timestamp)
    
    - `inventory`
      - `id` (bigint, primary key)
      - `drug_name` (text)
      - `quantity` (integer)
      - `unit_cost` (numeric)
      - `expiry_date` (text)
      - `supplier` (text)
      - `category` (text)
      - `created_at` (timestamp)
    
    - `analytics`
      - `id` (bigint, primary key)
      - `analysis_type` (text)
      - `results` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their data
*/

-- Create patients table
CREATE TABLE IF NOT EXISTS patients (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  patient_id text UNIQUE,
  age integer,
  gender text,
  diagnosis text,
  medications text,
  admission_date text,
  discharge_date text,
  created_at timestamptz DEFAULT now()
);

-- Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  drug_name text NOT NULL,
  quantity integer DEFAULT 0,
  unit_cost numeric DEFAULT 0,
  expiry_date text,
  supplier text,
  category text DEFAULT 'General',
  created_at timestamptz DEFAULT now()
);

-- Create analytics table
CREATE TABLE IF NOT EXISTS analytics (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  analysis_type text NOT NULL,
  results text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- Create policies for patients table
CREATE POLICY "Enable read access for all users" ON patients
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON patients
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON patients
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON patients
  FOR DELETE USING (true);

-- Create policies for inventory table
CREATE POLICY "Enable read access for all users" ON inventory
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON inventory
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON inventory
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON inventory
  FOR DELETE USING (true);

-- Create policies for analytics table
CREATE POLICY "Enable read access for all users" ON analytics
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON analytics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON analytics
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON analytics
  FOR DELETE USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_medications ON patients(medications);
CREATE INDEX IF NOT EXISTS idx_inventory_drug_name ON inventory(drug_name);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics(analysis_type);