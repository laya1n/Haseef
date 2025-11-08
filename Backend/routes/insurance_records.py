from fastapi import APIRouter, Query
import pandas as pd
from datetime import datetime, timedelta

router = APIRouter(prefix="/insurance", tags=["Insurance Records"])

# 🧾 Load from Excel
def load_insurance_records():
    df = pd.read_excel("Backend/data/medical_records.xlsx", engine="openpyxl")

    # columns to show
    columns = [
        "INV NO.",
        "Contract",
        "CLAIM_TYPE",
        "Gross_AmountNoVat",
        "Vat Amount",
        "Discount",
        "Deductible",
        "Special Discount",
        "Net Amount",
        "Pay to",
        "REFER_IND",
        "EMER_IND",
        "INCUR_DATE_FROM",
        "INCUR_DATE_TO",
    ]

    # show only columns mentioned
    df = df[[col for col in columns if col in df.columns]]

    # rename columns
    df.columns = [
        "inv_no",
        "contract",
        "claim_type",
        "gross_amount_no_vat",
        "vat_amount",
        "discount",
        "deductible",
        "special_discount",
        "net_amount",
        "pay_to",
        "refer_ind",
        "emer_ind",
        "incur_date_from",
        "incur_date_to",
    ][: len(df.columns)]

    # clean text to improve search
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].astype(str).str.strip().str.lower()

    # temp
    df["ai_analysis"] = "No analysis yet — will be added by AI Agent."

    return df



@router.get("/records")
def get_insurance_records(
    company: str = Query(None, description="Search by insurance company"),
    status: str = Query(None, description="Filter by claim status"),
    last_week: bool = Query(False, description="Filter by last week"),
):
    df = load_insurance_records()

    # search by insurance company
    if company:
        company = company.strip().lower()
        df = df[df["contract"].str.contains(company, na=False)]

    # filters last week
    if last_week:
        df["incur_date_from"] = pd.to_datetime(df["incur_date_from"], errors="coerce")
        one_week_ago = datetime.now() - timedelta(days=7)
        df = df[df["incur_date_from"] >= one_week_ago]

    total_claims = len(df)
    total_companies = df["contract"].nunique() if "contract" in df.columns else 0
    alerts_count = 0  # placeholder

    return {
        "total_claims": total_claims,
        "total_companies": total_companies,
        "alerts_count": alerts_count,
        "records": df.fillna("").to_dict(orient="records"),
    }
