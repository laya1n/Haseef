# Backend/routes/medical_records.py
from fastapi import APIRouter, Query
import pandas as pd
from datetime import datetime, timedelta

router = APIRouter(prefix="/medical", tags=["Medical Records"])

# load from excel sheet
def load_medical_records():
    df = pd.read_excel("Backend/data/medical_records.xlsx", engine="openpyxl")
    df["Treatment Date"] = df["Treatment Date"].astype(str)
    # columns to show
    columns = [
        "Name",
        "Patient Name",
        "Treatment Date",
        "ICD10CODE",
        "Chief Complaint",
        "SignificantSignes",
        "CLAIM_TYPE",
        "REFER_IND",
        "EMER_IND",
        "Contract",
    ]

    # check if a column exists
    df = df[[col for col in columns if col in df.columns]]

    # column names
    df.columns = [
        "doctor_name",
        "patient_name",
        "treatment_date",
        "ICD10CODE",
        "chief_complaint",
        "significant_signs",
        "claim_type",
        "refer_ind",
        "emer_ind",
        "contract",
    ]
    #cleans spaces and lower cases to improve search
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].astype(str).str.strip().str.lower()

    #this is temp
    df["ai_analysis"] = "No analysis yet — will be added by AI Agent."

    return df

@router.get("/records")
def get_medical_records(
    doctor: str = Query(None, description="Search by doctor name"),
    last_week: bool = Query(False, description="Filter by last week"),
):
    df = load_medical_records()

    # search by doctor name
    if doctor:
        doctor = doctor.strip().lower()
        df = df[df["doctor_name"].str.contains(doctor, na=False)]

    # filter for last week
    if last_week:
        df["treatment_date"] = pd.to_datetime(df["treatment_date"], errors="coerce")
        one_week_ago = datetime.now() - timedelta(days=7)
        df = df[df["treatment_date"] >= one_week_ago]

    total_records = len(df)
    total_doctors = df["doctor_name"].nunique()
    alerts_count = 0  # placeholder until AI agent adds logic

    return {
        "total_records": total_records,
        "total_doctors": total_doctors,
        "alerts_count": alerts_count,
        "records": df.fillna("").to_dict(orient="records"),
    }