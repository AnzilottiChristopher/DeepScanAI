// Mock data for local testing without Supabase
export const mockPatients = [
  {
    id: 1,
    patient_id: "P001",
    age: 45,
    gender: "Female",
    diagnosis: "Hypertension",
    medications: "Lisinopril, Hydrochlorothiazide",
    admission_date: "2024-01-15",
    discharge_date: "2024-01-18",
    created_at: "2024-01-15T10:00:00Z"
  },
  {
    id: 2,
    patient_id: "P002",
    age: 62,
    gender: "Male",
    diagnosis: "Diabetes Type 2",
    medications: "Metformin, Insulin",
    admission_date: "2024-01-20",
    discharge_date: "2024-01-25",
    created_at: "2024-01-20T14:30:00Z"
  },
  {
    id: 3,
    patient_id: "P003",
    age: 38,
    gender: "Female",
    diagnosis: "Pneumonia",
    medications: "Amoxicillin, Albuterol",
    admission_date: "2024-02-01",
    discharge_date: "2024-02-05",
    created_at: "2024-02-01T09:15:00Z"
  },
  {
    id: 4,
    patient_id: "P004",
    age: 55,
    gender: "Male",
    diagnosis: "Heart Disease",
    medications: "Atorvastatin, Metoprolol",
    admission_date: "2024-02-10",
    discharge_date: "2024-02-15",
    created_at: "2024-02-10T11:45:00Z"
  },
  {
    id: 5,
    patient_id: "P005",
    age: 29,
    gender: "Female",
    diagnosis: "Anxiety",
    medications: "Sertraline, Lorazepam",
    admission_date: "2024-02-20",
    discharge_date: "2024-02-22",
    created_at: "2024-02-20T16:20:00Z"
  }
];

export const mockInventory = [
  {
    id: 1,
    drug_name: "Lisinopril",
    quantity: 15,
    unit_cost: 12.50,
    expiry_date: "2025-06-30",
    supplier: "PharmaCorp",
    category: "Cardiovascular",
    created_at: "2024-01-01T00:00:00Z"
  },
  {
    id: 2,
    drug_name: "Metformin",
    quantity: 250,
    unit_cost: 8.75,
    expiry_date: "2025-12-31",
    supplier: "MediSupply",
    category: "Diabetes",
    created_at: "2024-01-01T00:00:00Z"
  },
  {
    id: 3,
    drug_name: "Amoxicillin",
    quantity: 80,
    unit_cost: 15.20,
    expiry_date: "2024-08-15",
    supplier: "PharmaCorp",
    category: "Antibiotics",
    created_at: "2024-01-01T00:00:00Z"
  },
  {
    id: 4,
    drug_name: "Insulin",
    quantity: 5,
    unit_cost: 45.00,
    expiry_date: "2024-12-31",
    supplier: "DiabetesCare",
    category: "Diabetes",
    created_at: "2024-01-01T00:00:00Z"
  },
  {
    id: 5,
    drug_name: "Atorvastatin",
    quantity: 120,
    unit_cost: 22.30,
    expiry_date: "2025-03-15",
    supplier: "CardioMeds",
    category: "Cardiovascular",
    created_at: "2024-01-01T00:00:00Z"
  },
  {
    id: 6,
    drug_name: "Hydrochlorothiazide",
    quantity: 8,
    unit_cost: 9.80,
    expiry_date: "2024-10-30",
    supplier: "PharmaCorp",
    category: "Cardiovascular",
    created_at: "2024-01-01T00:00:00Z"
  },
  {
    id: 7,
    drug_name: "Albuterol",
    quantity: 35,
    unit_cost: 18.50,
    expiry_date: "2025-01-20",
    supplier: "RespiratoryCare",
    category: "Respiratory",
    created_at: "2024-01-01T00:00:00Z"
  },
  {
    id: 8,
    drug_name: "Sertraline",
    quantity: 90,
    unit_cost: 16.75,
    expiry_date: "2025-09-10",
    supplier: "MentalHealthMeds",
    category: "Mental Health",
    created_at: "2024-01-01T00:00:00Z"
  }
];

export const mockStats = {
  patients: mockPatients.length,
  inventory: mockInventory.length,
  predictions: 12,
  alerts: 3
};