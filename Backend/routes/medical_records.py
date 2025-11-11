# Backend/routes/medical_records.py
from fastapi import APIRouter, Query
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime

router = APIRouter(prefix="/medical", tags=["Medical Records"])

# ========================== Helpers ==========================

def fix_title_spacing(s: str) -> str:
    """Dr.Ahmed -> Dr. Ahmed | د.احمد -> د. احمد"""
    s = str(s or "").strip()
    s = pd.Series([s]).str.replace(r'(^|\s)(dr)\.(?=[A-Za-z\u0600-\u06FF])', r'\1Dr. ', regex=True, case=False)[0]
    s = pd.Series([s]).str.replace(r'(^|\s)(د)\.(?=[A-Za-z\u0600-\u06FF])', r'\1د. ', regex=True)[0]
    return s

DROP_TITLES = {"dr", "dr.", "doctor", "د", "د.", "دكتور", "الدكتور"}

def strip_titles(s: str) -> str:
    """يحذف الألقاب من بداية الاسم فقط"""
    parts = str(s or "").strip().split()
    while parts and parts[0].lower() in DROP_TITLES:
        parts.pop(0)
    return " ".join(parts)

def ar_en_normalize(s: str) -> str:
    """تطبيع عربي/إنجليزي ومسافات موحّدة"""
    s = fix_title_spacing(s)
    s = str(s or "").lower().strip()
    # إزالة التشكيل
    s = pd.Series([s]).str.replace(r"[\u064B-\u065F\u0610-\u061A]", "", regex=True)[0]
    # أشكال الألف/التاء المربوطة/الياء
    s = (s
         .replace("آ", "ا").replace("أ", "ا").replace("إ", "ا")
         .replace("ى", "ي").replace("ة", "ه"))
    # شرطات غريبة
    s = s.replace("‐", "-").replace("–", "-").replace("—", "-")
    # مسافات
    s = " ".join(s.split())
    return s

def norm_no_titles(s: str) -> str:
    return ar_en_normalize(strip_titles(s))

def first_icd(code: str) -> str:
    """يرجع أول كود ICD من الخانة (قبل الفواصل/الأقواس/الأسطر)"""
    s = str(code or "")
    s = s.split("\n")[0]
    for sep in ["|", ";", ",", "،"]:
        s = s.split(sep)[0]
    if "(" in s:
        s = s.split("(")[0]
    return s.strip()

# ========================== Data Loader ==========================

def load_medical_records():
    data_path = Path(__file__).resolve().parents[1] / "data" / "medical_records.xlsx"
    df = pd.read_excel(data_path, engine="openpyxl")

    # أعمدة العرض
    columns = [
        "Name", "Patient Name", "Treatment Date", "ICD10CODE",
        "Chief Complaint", "SignificantSignes", "CLAIM_TYPE",
        "REFER_IND", "EMER_IND", "Contract",
        # قد يوجد تخصص في Unnamed: 42
        "Unnamed: 42"
    ]
    df = df[[c for c in columns if c in df.columns]].copy()

    # إعادة تسمية
    rename_map = {
        "Name": "doctor_name",
        "Patient Name": "patient_name",
        "Treatment Date": "treatment_date",
        "ICD10CODE": "ICD10CODE",
        "Chief Complaint": "chief_complaint",
        "SignificantSignes": "significant_signs",
        "CLAIM_TYPE": "claim_type",
        "REFER_IND": "refer_ind",
        "EMER_IND": "emer_ind",
        "Contract": "contract",
        "Unnamed: 42": "specialty"
    }
    df.rename(columns=rename_map, inplace=True)

    # التاريخ (4092025.0 / 04092025 / 4/9/2025 ...)
    td = df["treatment_date"].astype(str).str.strip()

    def fix_date(x):
        x = str(x).strip()
        # رقم من اكسل (4092025 أو 4092025.0)
        if x.replace('.', '', 1).isdigit():
            x = x.split('.')[0].zfill(8)  # 04092025
            try:
                return datetime.strptime(x, "%d%m%Y")
            except Exception:
                pass
        # صيغ أخرى
        try:
            return pd.to_datetime(x, errors="coerce", dayfirst=True)
        except Exception:
            return pd.NaT

    df["treatment_date"] = td.apply(fix_date)
    df["treatment_date_str"] = df["treatment_date"].dt.strftime("%Y-%m-%d").fillna("")

    # أعمدة مطبّعة للبحث
    base_cols = [
        "doctor_name", "patient_name", "ICD10CODE", "chief_complaint",
        "significant_signs", "claim_type", "refer_ind", "emer_ind",
        "contract", "specialty"
    ]
    for col in base_cols:
        df[f"norm_{col}"] = df[col].astype(str).map(ar_en_normalize)

    # إصدارات بدون ألقاب + أول كود ICD
    df["norm_doctor_no_title"]  = df["doctor_name"].astype(str).map(norm_no_titles)
    df["norm_patient_no_title"] = df["patient_name"].astype(str).map(ar_en_normalize)
    df["icd_first"]      = df["ICD10CODE"].map(first_icd)
    df["norm_icd_first"] = df["icd_first"].map(ar_en_normalize)

    # Placeholder لـ AI
    df["ai_analysis"] = "No analysis yet — will be added by AI Agent."
    return df

# ========================== Route ==========================

@router.get("/records")
def get_medical_records(
    q: str | None = Query(None, description="General search across all fields"),
    doctor: str | None = Query(None, description="Filter by doctor name"),
    patient: str | None = Query(None, description="Filter by patient name"),
    icd: str | None = Query(None, description="Filter by first ICD10 code"),
    specialty: str | None = Query(None, description="Filter by specialty"),
    date: str | None = Query(None, description="Exact date (YYYY-MM-DD)"),
    date_from: str | None = Query(None, description="From date (YYYY-MM-DD)"),
    date_to: str | None = Query(None, description="To date (YYYY-MM-DD)"),
):
    df = load_medical_records()

    # --- التاريخ ---
    if date:
        try:
            d = pd.to_datetime(date).date()
            df = df[df["treatment_date"].dt.date == d]
        except Exception:
            pass
    else:
        start = pd.to_datetime(date_from, errors="coerce") if date_from else None
        end   = pd.to_datetime(date_to, errors="coerce") if date_to else None
        if start is not None:
            df = df[df["treatment_date"] >= start]
        if end is not None:
            df = df[df["treatment_date"] <= end]

    # --- الطبيب ---
    if doctor:
        key = norm_no_titles(doctor)
        if key:
            m1 = df["norm_doctor_no_title"].str.contains(key, na=False)
            m2 = df["norm_doctor_name"].str.contains(ar_en_normalize(doctor), na=False)
            df = df[m1 | m2]

    # --- المريض ---
    if patient:
        key = ar_en_normalize(patient)
        if key:
            df = df[df["norm_patient_no_title"].str.contains(key, na=False) |
                    df["norm_patient_name"].str.contains(key, na=False)]

    # --- التخصص (إن وجد) ---
    if specialty and "norm_specialty" in df.columns:
        key = ar_en_normalize(specialty)
        df = df[df["norm_specialty"].str.contains(key, na=False)]

    # --- ICD10 (الكود الأول فقط) ---
    if icd:
        key = ar_en_normalize(first_icd(icd))
        if key:
            df = df[df["norm_icd_first"].str.contains(key, na=False)]

    # --- بحث عام ---
    if q:
        key = ar_en_normalize(q)
        norm_cols = [c for c in df.columns if c.startswith("norm_")]
        if norm_cols:
            mask = np.column_stack([df[c].str.contains(key, na=False) for c in norm_cols]).any(axis=1)
            df = df[mask]

    # --- إحصاءات ---
    total_records = int(len(df))
    total_doctors = int(df["doctor_name"].nunique()) if total_records > 0 else 0
    alerts_count = int(((df["emer_ind"].astype(str).str.upper() == "Y") |
                        (df["refer_ind"].astype(str).str.upper() == "Y")).sum())

    # --- ناتج الإرجاع ---
    out_cols = [
        "doctor_name", "patient_name", "treatment_date_str", "ICD10CODE",
        "chief_complaint", "significant_signs", "claim_type",
        "refer_ind", "emer_ind", "contract", "ai_analysis",
    ]
    if "specialty" in df.columns:
        out_cols.append("specialty")

    out = df[out_cols].rename(columns={"treatment_date_str": "treatment_date"})

    return {
        "total_records": total_records,
        "total_doctors": total_doctors,
        "alerts_count": alerts_count,
        "records": out.fillna("").to_dict(orient="records"),
    }

