from fastapi import APIRouter, Query
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime

router = APIRouter(prefix="/insurance", tags=["Insurance Records"])


def load_insurance_records():
    # Load Excel file
    data_path = Path(__file__).resolve().parents[1] / "data" / "medical_records.xlsx"
    df = pd.read_excel(data_path, engine="openpyxl")

    # Expected columns (some might have slight name variations)
    columns = [
        "INV NO.", "Contract", "CLAIM_TYPE", "Gross_AmountNoVat", "Gross Amount",
        "Vat Amount", "Discount", " Discount", "Deductible",
        "Special Discount", "Net Amount", "Pay to", "REFER_IND", "EMER_IND",
        "Treatment Date"
    ]

    # Filter only columns that actually exist in the Excel file
    existing_cols = [c for c in columns if c in df.columns]
    df = df[existing_cols].copy()

    # Rename columns to unified names
    rename_map = {
        "INV NO.": "inv_no",
        "Contract": "company",
        "CLAIM_TYPE": "claim_type",
        "Gross_AmountNoVat": "gross_amount_no_vat",
        "Gross Amount": "gross_amount_no_vat",
        "Vat Amount": "vat_amount",
        " Discount": "discount",
        "Discount": "discount",
        "Deductible": "deductible",
        "Special Discount": "special_discount",
        "Net Amount": "net_amount",
        "Pay to": "pay_to",
        "REFER_IND": "refer_ind",
        "EMER_IND": "emer_ind",
        "Treatment Date": "treatment_date",
    }
    df = df.rename(columns=rename_map)

    # Fix date format for 'treatment_date'
    if "treatment_date" in df.columns:
        td = df["treatment_date"].astype(str).str.strip()

        def fix_date(x):
            x = str(x).strip()
            # Handle numeric Excel dates like 4092025.0 or 04092025
            if x.replace('.', '', 1).isdigit():
                x = x.split('.')[0]
                x = x.zfill(8)
                try:
                    return datetime.strptime(x, "%d%m%Y")
                except Exception:
                    return pd.NaT
            try:
                return pd.to_datetime(x, errors="coerce", dayfirst=True)
            except Exception:
                return pd.NaT

        df["treatment_date"] = td.apply(fix_date)
        df["treatment_date_str"] = df["treatment_date"].dt.strftime("%Y-%m-%d").fillna("")
    else:
        # Add empty columns if date not found
        df["treatment_date"] = pd.NaT
        df["treatment_date_str"] = ""

    # Normalize text columns for search (convert to lowercase and trim spaces)
    search_cols = [
        "inv_no", "company", "claim_type", "gross_amount_no_vat", "vat_amount",
        "discount", "deductible", "special_discount", "net_amount", "pay_to",
        "refer_ind", "emer_ind"
    ]

    for col in search_cols:
        if col in df.columns and pd.api.types.is_object_dtype(df[col]):
            df[f"norm_{col}"] = (
                df[col]
                .astype(str)
                .str.strip()
                .str.lower()
                .str.replace(r"\s+", " ", regex=True)
            )
        else:
            df[f"norm_{col}"] = ""

    # Add placeholder column for AI analysis
    df["ai_analysis"] = "No analysis yet — will be added by AI Agent."

    return df

@router.get("/records")
def get_insurance_records(
    q: str | None = Query(None, description="General search across all fields"),
    company: str | None = Query(None, description="Filter by insurance company name"),
    date: str | None = Query(None, description="Filter by date (YYYY-MM-DD)"),
    claim_type: str | None = Query(None, description="Filter by claim type")
):
    # Load data from Excel
    df = load_insurance_records()

    # Filter by date
    if date and "treatment_date" in df.columns:
        try:
            d = pd.to_datetime(date).date()
            df = df[df["treatment_date"].dt.date == d]
        except Exception:
            pass

    # Filter by insurance company
    if company and "norm_company" in df.columns:
        key = str(company).strip().lower()
        df = df[df["norm_company"].str.contains(key, na=False)]

    # General search across all normalized columns
    if q:
        key = str(q).strip().lower()
        norm_cols = [c for c in df.columns if c.startswith("norm_")]
        mask = np.column_stack([df[c].str.contains(key, na=False) for c in norm_cols]).any(axis=1)
        df = df[mask]

    if claim_type and "norm_claim_type" in df.columns:
        key = str(claim_type).strip().lower()
        df = df[df["norm_claim_type"].str.contains(key, na=False)]

    # statistics
    total_claims = int(len(df))
    total_companies = int(df["company"].nunique()) if total_claims > 0 else 0
    alerts_count = 0

    columns_to_show = [
        "inv_no", "company", "claim_type", "gross_amount_no_vat", "vat_amount",
        "discount", "deductible", "special_discount", "net_amount", "pay_to",
        "refer_ind", "emer_ind", "treatment_date_str", "ai_analysis"
    ]
    out = df[[c for c in columns_to_show if c in df.columns]].rename(
        columns={"treatment_date_str": "treatment_date"}
    )

    return {
        "total_claims": total_claims,
        "total_companies": total_companies,
        "alerts_count": alerts_count,
        "records": out.fillna("").to_dict(orient="records"),
    }