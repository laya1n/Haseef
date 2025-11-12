from fastapi import APIRouter, Query
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
import re

router = APIRouter(prefix="/medical", tags=["Medical Records"])

# ================= Normalization helpers =================

_AR_DIACRITICS = r"[\u064B-\u065F\u0610-\u061A]"
_ICD_RE = re.compile(r"([A-Za-z]\d{1,2}(?:\.\d+)?)")  # E11 أو E03.9

TITLES = {
    "dr", "dr.", "doctor", "prof", "prof.", "mr", "mrs", "ms",
    "د", "د.", "دكتور", "الدكتور", "أ.", "أ.د", "بروف", "البروف", "أستاذ",
}

def _strip_titles_str(txt: str) -> str:
    s = str(txt or "").strip()
    s = re.sub(r"[\\\/]+", " ", s)         # \ أو / → مسافة
    s = re.sub(r"[.,;:_]+", " ", s)        # فواصل كنهايات كلمات
    parts = re.split(r"\s+", s)
    out = [p for p in parts if p and p.lower().strip(".") not in TITLES]
    return " ".join(out).strip()

def _strip_titles_series(s: pd.Series) -> pd.Series:
    s = s.astype(str).str.strip()
    s = s.str.replace(r"[\\\/]+", " ", regex=True)
    s = s.str.replace(r"[.,;:_]+", " ", regex=True)
    parts = s.str.split(r"\s+", regex=True)
    # إزالة الألقاب عنصرًا عنصرًا
    return parts.apply(lambda lst: " ".join([p for p in lst if p and p.lower().strip(".") not in TITLES]).strip())

def _norm_common(x):
    """
    يطبّع النص عربيًا وإنجليزيًا ويحوّل الفواصل/الشرطات/الـ slash إلى مسافات.
    يدعم str و Series.
    """
    if isinstance(x, pd.Series):
        s = x.astype(str).str.strip().str.lower()
        s = s.str.replace(_AR_DIACRITICS, "", regex=True)
        s = s.str.replace("[آأإ]", "ا", regex=True)
        s = s.str.replace("ى", "ي", regex=True)
        s = s.str.replace("ة", "ه", regex=True)
        s = s.str.replace(r"[‐–—]+", "-", regex=True)
        s = s.str.replace(r"[\\\/|]+", " ", regex=True)         # \ / | → مسافة
        s = s.str.replace(r"[(),.;:]+", " ", regex=True)
        s = s.str.replace(r"\s+", " ", regex=True).str.strip()
        return s
    else:
        s = str(x or "").strip().lower()
        s = re.sub(_AR_DIACRITICS, "", s)
        s = s.replace("آ","ا").replace("أ","ا").replace("إ","ا").replace("ى","ي").replace("ة","ه")
        s = re.sub(r"[‐–—]+", "-", s)
        s = re.sub(r"[\\\/|]+", " ", s)
        s = re.sub(r"[(),.;:]+", " ", s)
        s = re.sub(r"\s+", " ", s).strip()
        return s

def _norm_name(x, drop_titles: bool = True):
    if isinstance(x, pd.Series):
        s = _strip_titles_series(x) if drop_titles else x.astype(str)
        return _norm_common(s)
    else:
        base = _strip_titles_str(x) if drop_titles else str(x or "")
        return _norm_common(base)

def _norm_icd_str(txt: str) -> str:
    if not txt:
        return ""
    m = _ICD_RE.search(str(txt))
    return m.group(1).upper() if m else _norm_common(str(txt)).upper()

def _norm_icd_series(s: pd.Series) -> pd.Series:
    return s.astype(str).apply(_norm_icd_str)

def _icd_root_str(txt: str) -> str:
    code = _norm_icd_str(txt)
    return code.split(".")[0] if code else ""

def _icd_root_series(s: pd.Series) -> pd.Series:
    return _norm_icd_series(s).str.split(".").str[0]

def _to_datetime_any(x: str):
    """يتعامل مع: أرقام إكسل، ddmmyyyy, yyyymmdd, 4/9/2025, 04-09-2025, ..."""
    s = str(x).strip()
    if not s or s.lower() in ("nan","none"):
        return pd.NaT
    # أرقام إكسل نصية مثل 4092025 أو 4092025.0
    if re.fullmatch(r"\d+(?:\.\d+)?", s):
        s2 = s.split(".")[0].zfill(8)
        for fmt in ("%d%m%Y", "%Y%m%d"):
            try:
                return datetime.strptime(s2, fmt)
            except Exception:
                pass
    try:
        return pd.to_datetime(s, errors="coerce", dayfirst=True)
    except Exception:
        return pd.NaT

# ================= Load =================

def load_medical_records() -> pd.DataFrame:
    data_path = Path(__file__).resolve().parents[1] / "data" / "medical_records.xlsx"
    df = pd.read_excel(data_path, engine="openpyxl")

    columns = [
        "Name", "Patient Name", "Treatment Date", "ICD10CODE",
        "Chief Complaint", "SignificantSignes", "CLAIM_TYPE",
        "REFER_IND", "EMER_IND", "Contract",
    ]
    df = df[[c for c in columns if c in df.columns]].copy()

    df.columns = [
        "doctor_name", "patient_name", "treatment_date", "ICD10CODE",
        "chief_complaint", "significant_signs", "claim_type",
        "refer_ind", "emer_ind", "contract",
    ]

    # التواريخ
    td = df["treatment_date"].astype(str).str.strip()
    df["treatment_date"] = td.apply(_to_datetime_any)
    df["treatment_date_str"] = df["treatment_date"].dt.strftime("%Y-%m-%d").fillna("")

    # أعمدة مطبّعة للأسماء
    df["norm_doctor_name_raw"] = _norm_common(df["doctor_name"])
    df["norm_doctor_name"]     = _norm_name(df["doctor_name"], drop_titles=True)
    df["norm_patient_name"]    = _norm_name(df["patient_name"], drop_titles=True)

    # أشكال ICD
    df["icd_code"]       = _norm_icd_series(df["ICD10CODE"])    # مثال: E11 أو E03.9
    df["icd_root"]       = _icd_root_series(df["ICD10CODE"])    # مثال: E11
    df["norm_ICD10CODE"] = _norm_common(df["ICD10CODE"])        # fallback نصي

    # باقي الحقول النصية
    for col in ["chief_complaint", "significant_signs", "claim_type", "refer_ind", "emer_ind", "contract"]:
        df[f"norm_{col}"] = _norm_common(df[col])

    df["ai_analysis"] = "No analysis yet — will be added by AI Agent."
    return df

# ================= Route =================

@router.get("/records")
def get_medical_records(
    q: str | None = Query(None, description="General search across all fields"),
    doctor: str | None = Query(None, description="Filter by doctor name"),
    patient: str | None = Query(None, description="Filter by patient name"),
    date: str | None = Query(None, description="Filter by date (YYYY-MM-DD)"),
    icd: str | None = Query(None, description="Filter by ICD10 code"),
):
    df = load_medical_records()

    # التاريخ (يوم واحد)
    if date:
        try:
            d = pd.to_datetime(date).date()
            df = df[df["treatment_date"].dt.date == d]
        except Exception:
            pass

    # فلترة الدكتور: طابق على المطبّع مع وبدون ألقاب
    if doctor:
        k = _norm_name(doctor, drop_titles=True)
        mask = (
            df["norm_doctor_name"].str.contains(k, na=False) |
            df["norm_doctor_name_raw"].str.contains(k, na=False)
        )
        df = df[mask]

    # فلترة المريض
    if patient:
        k = _norm_name(patient, drop_titles=True)
        df = df[df["norm_patient_name"].str.contains(k, na=False)]

    # فلترة ICD (E11 أو E11.9 أو نص يحوي الكود)
    if icd:
        key_code = _norm_icd_str(icd)             # E11 أو E11.9
        key_root = key_code.split(".")[0] if key_code else ""
        k_any = _norm_common(icd)
        mask_icd = (
            df["icd_code"].str.contains(key_code, na=False) |
            df["icd_root"].str.contains(key_root, na=False) |
            df["norm_ICD10CODE"].str.contains(k_any, na=False)
        )
        df = df[mask_icd]

    # البحث العام عبر كل الأعمدة المطبّعة + أشكال ICD
    if q:
        k = _norm_common(q)
        k_icd = _norm_icd_str(q)
        cols = [c for c in df.columns if c.startswith("norm_")]
        stacks = [df[c].str.contains(k, na=False) for c in cols]
        if k_icd:
            stacks += [
                df["icd_code"].str.contains(k_icd, na=False),
                df["icd_root"].str.contains(k_icd.split(".")[0], na=False),
            ]
        mask = np.column_stack(stacks).any(axis=1)
        df = df[mask]

    total_records = int(len(df))
    total_doctors = int(df["doctor_name"].nunique()) if total_records > 0 else 0
    alerts_count = int(((df["emer_ind"].astype(str).str.upper() == "Y") |
                        (df["refer_ind"].astype(str).str.upper() == "Y")).sum())

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
