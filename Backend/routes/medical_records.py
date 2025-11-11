# Backend/routes/medical_records.py
from fastapi import APIRouter, Query
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime

router = APIRouter(prefix="/medical", tags=["Medical Records"])


def load_medical_records():
    data_path = Path(__file__).resolve().parents[1] / "data" / "medical_records.xlsx"
    df = pd.read_excel(data_path, engine="openpyxl")

    # columns in to show
    columns = [
        "Name", "Patient Name", "Treatment Date", "ICD10CODE",
        "Chief Complaint", "SignificantSignes", "CLAIM_TYPE",
        "REFER_IND", "EMER_IND", "Contract",
    ]
    df = df[[c for c in columns if c in df.columns]].copy()

    # renaming columns
    df.columns = [
        "doctor_name", "patient_name", "treatment_date", "ICD10CODE",
        "chief_complaint", "significant_signs", "claim_type",
        "refer_ind", "emer_ind", "contract",
    ]

    #  formatting date
    td = df["treatment_date"].astype(str).str.strip()
    print("🧾 Raw treatment_date values (first 10):", td.head(10).tolist())

    def fix_date(x):
        """يتعامل مع كل الصيغ الممكنة: 4092025.0 أو 04092025 أو 4/9/2025"""
        x = str(x).strip()

        # لو كانت رقم عشري من الإكسل (زي 4092025.0)
        if x.replace('.', '', 1).isdigit():
            # نحذف الجزء العشري (".0")
            x = x.split('.')[0]
            # نكمل الأصفار للنمط الصحيح (مثلاً 4092025 → 04092025)
            x = x.zfill(8)
            try:
                return datetime.strptime(x, "%d%m%Y")
            except Exception:
                return pd.NaT

        # إذا كانت بصيغ ثانية زي 04/09/2025 أو 4-9-2025
        try:
            return pd.to_datetime(x, errors="coerce", dayfirst=True)
        except Exception:
            return pd.NaT

    df["treatment_date"] = td.apply(fix_date)
    df["treatment_date_str"] = df["treatment_date"].dt.strftime("%Y-%m-%d").fillna("")

    # تجهيز أعمدة البحث (نصوص موحدة lowercase)
    search_cols = [
        "doctor_name", "patient_name", "ICD10CODE", "chief_complaint",
        "significant_signs", "claim_type", "refer_ind", "emer_ind", "contract",
    ]
    for col in search_cols:
        df[f"norm_{col}"] = (
            df[col]
            .astype(str)
            .str.strip()
            .str.lower()
            .str.replace(r"\s+", " ", regex=True)
        )

    df["ai_analysis"] = "No analysis yet — will be added by AI Agent."
    return df


@router.get("/records")
def get_medical_records(
    q: str | None = Query(None, description="General search across all fields"),
    doctor: str | None = Query(None, description="Filter by doctor name"),
    patient: str | None = Query(None, description="Filter by patient name"),
    date: str | None = Query(None, description="Filter by date (YYYY-MM-DD)")
):
    df = load_medical_records()

    # date filter
    if date:
        try:
            d = pd.to_datetime(date).date()
            df = df[df["treatment_date"].dt.date == d]
        except Exception:
            pass

    # doctor filter
    if doctor and "norm_doctor_name" in df.columns:
        key = str(doctor).strip().lower()
        df = df[df["norm_doctor_name"].str.contains(key, na=False)]

    # patient filter
    if patient and "norm_patient_name" in df.columns:
        key = str(patient).strip().lower()
        df = df[df["norm_patient_name"].str.contains(key, na=False)]

    # general search
    if q:
        key = str(q).strip().lower()
        norm_cols = [c for c in df.columns if c.startswith("norm_")]
        mask = np.column_stack([df[c].str.contains(key, na=False) for c in norm_cols]).any(axis=1)
        df = df[mask]

    # statics
    total_records = int(len(df))
    total_doctors = int(df["doctor_name"].nunique()) if total_records > 0 else 0
    alerts_count = 0

    out = df[[
        "doctor_name", "patient_name", "treatment_date_str", "ICD10CODE",
        "chief_complaint", "significant_signs", "claim_type",
        "refer_ind", "emer_ind", "contract", "ai_analysis",
    ]].rename(columns={"treatment_date_str": "treatment_date"})

    return {
        "total_records": total_records,
        "total_doctors": total_doctors,
        "alerts_count": alerts_count,
        "records": out.fillna("").to_dict(orient="records"),
    }