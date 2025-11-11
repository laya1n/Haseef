from fastapi import APIRouter, Query
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime

router = APIRouter(prefix="/drugs", tags=["Drug Records"])


def load_drug_records():
    # Load Excel file
    data_path = Path(__file__).resolve().parents[1] / "data" / "medical_records.xlsx"
    df = pd.read_excel(data_path, engine="openpyxl")

    # Columns to use (check that they exist)
    columns = [
        "Name", "Patient Name", "ServiceCode", "ServiceDescription",
        "QTY", "Item_Unit_Price", "Gross Amount", "VAT Amount",
        "Discount", "Net Amount", "Treatment Date"
    ]
    existing_cols = [c for c in columns if c in df.columns]
    df = df[existing_cols].copy()

    # Rename columns for consistent naming
    rename_map = {
        "Name": "doctor_name",
        "Patient Name": "patient_name",
        "ServiceCode": "service_code",
        "ServiceDescription": "service_description",
        "QTY": "quantity",
        "Item_Unit_Price": "item_unit_price",
        "Gross Amount": "gross_amount",
        "VAT Amount": "vat_amount",
        "Discount": "discount",
        "Net Amount": "net_amount",
        "Treatment Date": "treatment_date"
    }
    df = df.rename(columns=rename_map)

    # Fix date format
    if "treatment_date" in df.columns:
        td = df["treatment_date"].astype(str).str.strip()

        def fix_date(x):
            x = str(x).strip()
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
        df["treatment_date"] = pd.NaT
        df["treatment_date_str"] = ""

    # Normalize text columns for search
    search_cols = [
        "doctor_name", "patient_name", "service_description",
        "service_code", "discount", "net_amount"
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

    # Placeholder for AI analysis
    df["ai_analysis"] = "No analysis yet — will be added by AI Agent."
    return df


@router.get("/records")
def get_drug_records(
    q: str | None = Query(None, description="General search across all fields"),
    doctor: str | None = Query(None, description="Filter by doctor name"),
    drug: str | None = Query(None, description="Filter by drug/service name"),
    date: str | None = Query(None, description="Filter by date (YYYY-MM-DD)")
):
    df = load_drug_records()

    # Filter by date
    if date and "treatment_date" in df.columns:
        try:
            d = pd.to_datetime(date).date()
            df = df[df["treatment_date"].dt.date == d]
        except Exception:
            pass

    # Filter by doctor name
    if doctor and "norm_doctor_name" in df.columns:
        key = str(doctor).strip().lower()
        df = df[df["norm_doctor_name"].str.contains(key, na=False)]

    # Filter by drug/service name
    if drug and "norm_service_description" in df.columns:
        key = str(drug).strip().lower()
        df = df[df["norm_service_description"].str.contains(key, na=False)]

    # General search across all normalized fields
    if q:
        key = str(q).strip().lower()
        norm_cols = [c for c in df.columns if c.startswith("norm_")]
        mask = np.column_stack([df[c].str.contains(key, na=False) for c in norm_cols]).any(axis=1)
        df = df[mask]

    # Summary statistics
    total_operations = int(len(df))
    unique_doctors = int(df["doctor_name"].nunique()) if "doctor_name" in df.columns else 0
    alerts_count = 0

    # Prepare output
    columns_to_show = [
        "doctor_name", "patient_name", "service_code", "service_description",
        "quantity", "item_unit_price", "gross_amount", "vat_amount",
        "discount", "net_amount", "treatment_date_str", "ai_analysis"
    ]

    existing_cols = [c for c in columns_to_show if c in df.columns]
    out = df[existing_cols].rename(columns={"treatment_date_str": "treatment_date"})


    return {
        "total_operations": total_operations,
        "unique_doctors": unique_doctors,
        "alerts_count": alerts_count,
        "records": out.fillna("").to_dict(orient="records"),
    }