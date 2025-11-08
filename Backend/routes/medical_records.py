from fastapi import APIRouter
import pandas as pd

router = APIRouter(prefix="/medical", tags=["Medical Records"])

# load from excel sheet
def load_medical_records():
    df = pd.read_excel("Backend/data/medical_records.xlsx", engine="openpyxl")

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

    #this is temp
    df["ai_analysis"] = "No analysis yet — will be added by AI Agent."

    return df

@router.get("/records")
def get_medical_records():
    df = load_medical_records()
    return df.fillna("").to_dict(orient="records")