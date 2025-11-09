# Backend/routes/drug_records.py
from fastapi import APIRouter, Query
import pandas as pd
from datetime import datetime, timedelta

router = APIRouter(prefix="/drugs", tags=["Drug Records"])

def load_drug_records():
    df = pd.read_excel("Backend/data/medical_records.xlsx", engine="openpyxl")

    # Columns we want to display
    columns = [
        "Name",
        "Patient Name",
        "ServiceCode",
        "ServiceDescription",
        "QTY",
        "Item_Unit_Price",
        "Gross Amount",
        "VAT Amount",
        "Discount",
        "Net Amount",
        "Treatment Date",
    ]

    # Use only existing columns
    df = df[[col for col in columns if col in df.columns]]

    # Rename for frontend consistency
    df.columns = [
        "doctor_name",
        "patient_name",
        "service_code",
        "service_description",
        "quantity",
        "item_unit_price",
        "gross_amount",
        "vat_amount",
        "discount",
        "net_amount",
        "date",
    ][: len(df.columns)]

    # Clean strings (strip + lowercase)
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].astype(str).str.strip().str.lower()

    # Placeholder for AI analysis
    df["ai_analysis"] = "No analysis yet — will be added by AI Agent."

    return df


@router.get("/records")
def get_drug_records(
    last_week: bool = Query(False, description="Filter by last week"),
):
    df = load_drug_records()

    if last_week and "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        one_week_ago = datetime.now() - timedelta(days=7)
        df = df[df["date"] >= one_week_ago]

    
    total_operations = len(df)
    top_drug = (
        df["service_description"].mode()[0]
        if "service_description" in df.columns and not df["service_description"].empty
        else "-"
    )
    alerts_count = 0

    return {
        "total_operations": total_operations,
        "top_drug": top_drug,
        "alerts_count": alerts_count,
        "records": df.fillna("").to_dict(orient="records"),
    }
