# Backend/routers/medical.py
from fastapi import APIRouter, Query
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
import os
import re

router = APIRouter(prefix="/medical", tags=["Medical Records"])

# ========================= Normalization helpers =========================

_AR_DIACRITICS = r"[\u064B-\u065F\u0610-\u061A]"  # التشكيل العربي
_AR_NUMS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
_ICD_RE = re.compile(r"([A-Za-z]\d{1,2}(?:\.\d+)?)")  # أمثلة: E11 أو E03.9

TITLES = {
    "dr", "dr.", "doctor", "prof", "prof.", "mr", "mrs", "ms",
    "د", "د.", "دكتور", "الدكتور", "أ.", "أ.د", "بروف", "البروف", "أستاذ",
}

def _strip_titles_str(txt: str) -> str:
    s = str(txt or "").strip()
    s = re.sub(r"[\\\/]+", " ", s)          # \ أو / → مسافة
    s = re.sub(r"[.,;:_]+", " ", s)         # فواصل تعتبر فواصل كلمات
    parts = re.split(r"\s+", s)
    out = [p for p in parts if p and p.lower().strip(".") not in TITLES]
    return " ".join(out).strip()

def _strip_titles_series(s: pd.Series) -> pd.Series:
    s = s.astype(str).str.strip()
    s = s.str.replace(r"[\\\/]+", " ", regex=True)
    s = s.str.replace(r"[.,;:_]+", " ", regex=True)
    parts = s.str.split(r"\s+", regex=True)
    return parts.apply(
        lambda lst: " ".join([p for p in lst if p and p.lower().strip(".") not in TITLES]).strip()
    )

def _norm_common(x):
    """
    تطبيع عام: يحوّل الأرقام العربية/الفارسية، يزيل التشكيل،
    يوحد همزات/ألفات، يحول \ / | إلى مسافة، وينظف المسافات.
    يدعم str و Series.
    """
    def _norm_one(s: str) -> str:
        s = s.translate(_AR_NUMS)
        s = re.sub(_AR_DIACRITICS, "", s)
        s = s.replace("آ", "ا").replace("أ", "ا").replace("إ", "ا").replace("ى", "ي").replace("ة", "ه")
        s = re.sub(r"[‐–—]+", "-", s)         # شرطات مختلفة → -
        s = re.sub(r"[\\\/|]+", " ", s)       # \ / | → مسافة
        s = re.sub(r"[(),.;:]+", " ", s)      # رموز → مسافة
        s = re.sub(r"\s+", " ", s).strip()
        return s.lower()

    if isinstance(x, pd.Series):
        return x.astype(str).str.strip().apply(_norm_one)
    return _norm_one(str(x or "").strip())

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
    """
    يدعم:
      - سيريال إكسل (مثل 45567) = أيام منذ 1899-12-30
      - نصوص أرقام مثل ddmmyyyy أو yyyymmdd
      - صيغ شائعة: 4/9/2025 أو 04-09-2025
    """
    s = str(x).strip()
    if not s or s.lower() in ("nan", "none"):
        return pd.NaT

    # Excel serial: 3-5 digits كافية للسنوات الحديثة
    if re.fullmatch(r"\d{3,5}", s):
        try:
            n = int(s)
            return pd.Timestamp("1899-12-30") + pd.to_timedelta(n, unit="D")
        except Exception:
            pass

    # أرقام خام مثل 04092025 أو 20250904 (وقد تكون 04092025.0)
    if re.fullmatch(r"\d+(?:\.\d+)?", s):
        s2 = s.split(".")[0].zfill(8)
        for fmt in ("%d%m%Y", "%Y%m%d"):
            try:
                return datetime.strptime(s2, fmt)
            except Exception:
                pass

    return pd.to_datetime(s, errors="coerce", dayfirst=True)

# =============================== Load ===============================

def _resolve_data_path() -> Path:
    """
    يقرأ المسار من متغير البيئة MEDICAL_XLSX إن وُجد،
    وإلا يستخدم Backend/data/medical_records.xlsx بالنسبة لملف الراوتر.
    """
    env = os.getenv("MEDICAL_XLSX")
    if env:
        return Path(env).expanduser().resolve()
    return Path(__file__).resolve().parents[1] / "data" / "medical_records.xlsx"

def load_medical_records() -> pd.DataFrame:
    data_path = _resolve_data_path()
    df = pd.read_excel(data_path, engine="openpyxl")

    # الأعمدة المطلوبة فقط
    columns = [
        "Name", "Patient Name", "Treatment Date", "ICD10CODE",
        "Chief Complaint", "SignificantSignes", "CLAIM_TYPE",
        "REFER_IND", "EMER_IND", "Contract",
    ]
    df = df[[c for c in columns if c in df.columns]].copy()

    # إعادة التسمية
    df.columns = [
        "doctor_name", "patient_name", "treatment_date", "ICD10CODE",
        "chief_complaint", "significant_signs", "claim_type",
        "refer_ind", "emer_ind", "contract",
    ]

    # التواريخ (+ نص YYYY-MM-DD)
    td = df["treatment_date"].astype(str).str.strip()
    df["treatment_date"] = td.apply(_to_datetime_any)
    df["treatment_date_str"] = df["treatment_date"].dt.strftime("%Y-%m-%d").fillna("")

    # أشكال الأسماء المطبّعة
    df["norm_doctor_name_raw"] = _norm_common(df["doctor_name"])              # مع الألقاب
    df["norm_doctor_name"]     = _norm_name(df["doctor_name"], True)          # بدون ألقاب
    df["norm_patient_name"]    = _norm_name(df["patient_name"], True)

    # أشكال ICD
    df["icd_code"]       = _norm_icd_series(df["ICD10CODE"])                  # مثال: E11 أو E03.9
    df["icd_root"]       = _icd_root_series(df["ICD10CODE"])                  # مثال: E11
    df["norm_ICD10CODE"] = _norm_common(df["ICD10CODE"])                      # fallback نصي

    # باقي الحقول النصية للتطبيع العام
    for col in ["chief_complaint", "significant_signs", "claim_type", "refer_ind", "emer_ind", "contract"]:
        df[f"norm_{col}"] = _norm_common(df[col])

    # حقل تحليلات AI (placeholder)
    df["ai_analysis"] = "No analysis yet — will be added by AI Agent."

    return df

# =============================== Route ===============================

@router.get("/records")
def get_medical_records(
    q: str | None = Query(None, description="General search across all fields"),
    doctor: str | None = Query(None, description="Filter by doctor name"),
    patient: str | None = Query(None, description="Filter by patient name"),
    date: str | None = Query(None, description="Filter by date (YYYY-MM-DD)"),
    icd: str | None = Query(None, description="Filter by ICD10 code"),
    page: int = Query(1, ge=1, description="Page number (optional)"),
    page_size: int = Query(500, ge=1, le=5000, description="Page size (optional)"),
):
    """
    فلترة مرنة:
      - التاريخ يوم واحد.
      - الطبيب/المريض: تطابق تام → يبدأ بـ → يحتوي (على أشكال مطبّعة مع/بدون ألقاب).
      - ICD: كود كامل أو الجذر، مع startswith/contains.
      - q: بحث عام عبر جميع الحقول المطبّعة + ICD.
    يعاد total_records/total_doctors/alerts_count وفق النتائج بعد الفلاتر (قبل الترقيم).
    """
    df = load_medical_records()

    # --- التاريخ ---
    if date:
        try:
            d = pd.to_datetime(date).date()
            df = df[df["treatment_date"].dt.date == d]
        except Exception:
            pass

    # --- الطبيب: exact → startswith → contains (على شكلين: raw & no titles)
    if doctor:
        k = _norm_name(doctor, drop_titles=True)
        exact = (df["norm_doctor_name"] == k) | (df["norm_doctor_name_raw"] == k)
        starts = df["norm_doctor_name"].str.startswith(k, na=False)
        contains = (
            df["norm_doctor_name"].str.contains(k, na=False) |
            df["norm_doctor_name_raw"].str.contains(k, na=False)
        )
        df = df[ exact | starts | contains ]

    # --- المريض: exact → startswith → contains
    if patient:
        k = _norm_name(patient, drop_titles=True)
        exact = (df["norm_patient_name"] == k)
        starts = df["norm_patient_name"].str.startswith(k, na=False)
        contains = df["norm_patient_name"].str.contains(k, na=False)
        df = df[ exact | starts | contains ]

    # --- ICD: يدعم الجذر والكامل وstartswith وcontains على fallback
    if icd:
        key_code = _norm_icd_str(icd)                 # E11 أو E11.9
        key_root = key_code.split(".")[0] if key_code else ""
        k_any = _norm_common(icd)
        mask_icd = (
            (df["icd_code"] == key_code) |
            df["icd_code"].str.startswith(key_code, na=False) |
            (df["icd_root"] == key_root) |
            df["icd_root"].str.startswith(key_root, na=False) |
            df["norm_ICD10CODE"].str.contains(k_any, na=False)
        )
        df = df[mask_icd]

    # --- q: بحث عام عبر كل الأعمدة المطبّعة + أشكال ICD
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
        mask = np.column_stack(stacks).any(axis=1) if stacks else np.array([], dtype=bool)
        df = df[mask]

    # --- إحصاءات قبل الترقيم ---
    total_after_filters = int(len(df))
    total_doctors = int(df["doctor_name"].nunique()) if total_after_filters > 0 else 0
    alerts_count = int(
        ((df["emer_ind"].astype(str).str.upper() == "Y") |
         (df["refer_ind"].astype(str).str.upper() == "Y")).sum()
    )

    # --- ترتيب ثابت + معرّف ---
    df = df.sort_values(["treatment_date"], ascending=[False]).reset_index(drop=True)
    df["id"] = np.arange(1, len(df) + 1, dtype=int)

    # --- ترقيم صفحات (اختياري) ---
    start = (page - 1) * page_size
    end = start + page_size
    df_page = df.iloc[start:end].copy()

    # --- الإخراج ---
    out_cols = [
        "id",
        "doctor_name", "patient_name", "treatment_date_str", "ICD10CODE",
        "chief_complaint", "significant_signs", "claim_type",
        "refer_ind", "emer_ind", "contract", "ai_analysis",
    ]
    out = df_page[out_cols].rename(columns={"treatment_date_str": "treatment_date"})

    return {
        "total_records": total_after_filters,
        "total_doctors": total_doctors,
        "alerts_count": alerts_count,
        "records": out.fillna("").to_dict(orient="records"),
    }

