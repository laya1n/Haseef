# Backend/routes/medical_records.py
from fastapi import APIRouter, Query
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta

router = APIRouter(prefix="/medical", tags=["Medical Records"])

def _excel_date_to_datetime(s):
    """يحوّل رقم تاريخ إكسل إلى datetime"""
    try:
        return pd.to_datetime("1899-12-30") + pd.to_timedelta(float(s), unit="D")
    except Exception:
        return pd.NaT

def load_medical_records():
    data_path = Path(__file__).resolve().parents[1] / "data" / "medical_records.xlsx"
    df = pd.read_excel(data_path, engine="openpyxl")

    # اجمع الأعمدة المطلوبة إن وجدت
    columns = [
        "Name", "Patient Name", "Treatment Date", "ICD10CODE",
        "Chief Complaint", "SignificantSignes", "CLAIM_TYPE",
        "REFER_IND", "EMER_IND", "Contract",
    ]
    df = df[[c for c in columns if c in df.columns]].copy()

    # أعيدي التسمية إلى أسماء موحّدة
    df.columns = [
        "doctor_name","patient_name","treatment_date","ICD10CODE",
        "chief_complaint","significant_signs","claim_type",
        "refer_ind","emer_ind","contract",
    ]

    # ✅ إصلاح التاريخ: رقم إكسل أو نص
    td = df["treatment_date"]
    if np.issubdtype(td.dtype, np.number):
        df["treatment_date"] = td.apply(_excel_date_to_datetime)
    else:
        df["treatment_date"] = pd.to_datetime(td, errors="coerce", dayfirst=True, infer_datetime_format=True)

    # صيغة موحّدة للعرض والـAPI
    df["treatment_date_str"] = df["treatment_date"].dt.strftime("%Y-%m-%d").fillna("")

    # أعمدة مساعدة للبحث (منخفضة الحروف ومُنظّفة)
    for col in ["doctor_name","patient_name","ICD10CODE","chief_complaint"]:
        if col in df.columns:
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
    doctor: str | None = Query(None, description="Search by doctor name (normalized)"),
    last_week: bool = Query(False, description="Filter by last week"),
    date: str | None = Query(None, description="Exact date YYYY-MM-DD"),
):
    df = load_medical_records()

    # فلتر الطبيب (على العمود الموحّد norm_doctor_name)
    if doctor:
        key = str(doctor).strip().lower()
        df = df[df["norm_doctor_name"].str.contains(key, na=False)]

    # فلتر تاريخ محدد
    if date:
        try:
            d = pd.to_datetime(date).date()
            df = df[df["treatment_date"].dt.date == d]
        except Exception:
            pass

    # فلتر الأسبوع الأخير (يتجاهل إن تم تحديد تاريخ صريح)
    if last_week and not date:
        one_week_ago = pd.Timestamp.now().normalize() - pd.Timedelta(days=7)
        df = df[df["treatment_date"] >= one_week_ago]

    total_records = int(len(df))
    total_doctors = int(df["norm_doctor_name"].nunique())
    alerts_count = 0

    # أعيدي فقط الأعمدة المعروضة
    out = df[[
        "doctor_name","patient_name","treatment_date_str","ICD10CODE",
        "chief_complaint","significant_signs","claim_type",
        "refer_ind","emer_ind","contract","ai_analysis",
    ]].rename(columns={"treatment_date_str": "treatment_date"})

    return {
        "total_records": total_records,
        "total_doctors": total_doctors,
        "alerts_count": alerts_count,
        "records": out.fillna("").to_dict(orient="records"),
    }
