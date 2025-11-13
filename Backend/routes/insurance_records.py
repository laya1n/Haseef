# Backend/routers/insurance.py
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from datetime import datetime
import pandas as pd
import os
import re

router = APIRouter(prefix="/insurance", tags=["Insurance Records"])

# ---------- Config ----------
EXCEL_PATH = os.getenv("INSURANCE_EXCEL_PATH") or os.path.join(
    os.path.dirname(__file__), "..", "data", "medical_records.xlsx"
)
EXCEL_PATH = os.path.abspath(EXCEL_PATH)
# If you want to force the uploaded path locally:
# EXCEL_PATH = "/mnt/data/medical_records.xlsx"

COLUMNS = [
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
    "Treatment Date",
    "Company",
]

RENAME = {
    "INV NO.": "inv_no",
    "Company": "company",
    "Contract": "contract",
    "CLAIM_TYPE": "claim_type",
    "Gross_AmountNoVat": "gross_amount_no_vat",
    "Vat Amount": "vat_amount",
    "Discount": "discount",
    "Deductible": "deductible",
    "Special Discount": "special_discount",
    "Net Amount": "net_amount",
    "Pay to": "pay_to",
    "REFER_IND": "refer_ind",
    "EMER_IND": "emer_ind",
    "Treatment Date": "treatment_date",
    "INCUR_DATE_FROM": "incur_date_from",
    "INCUR_DATE_TO": "incur_date_to",
}

# ---------- Helpers ----------
AR_DIACRITICS = re.compile(r"[\u064B-\u065F\u0610-\u061A]")

def normalize_ar(s: Any) -> str:
    s = "" if s is None else str(s)
    s = s.strip().lower()
    s = AR_DIACRITICS.sub("", s)
    s = s.replace("آ", "ا").replace("أ", "ا").replace("إ", "ا")
    s = s.replace("ى", "ي").replace("ة", "ه")
    s = re.sub(r"\s+", " ", s)
    return s

# english + arabic friendly cleaner -> used to build matching keys
_RE_NON_WORD = re.compile(r"[^a-z0-9\u0600-\u06FF]+", re.IGNORECASE)
_RE_LONG_NUM = re.compile(r"\d{3,}")  # policy/CR long codes
_STOPWORDS = {
    # english/common company boilerplate
    "co", "company", "insurance", "cooperative", "co-operative", "coop",
    "inc", "ltd", "limited", "sa", "ksa",
    # arabic boilerplate (after normalize_ar)
    "شركه", "تعاونيه", "تامين", "تعاوني", "محدوده",
}

def make_key(s: Any) -> str:
    """
    A permissive key: lowercased, Arabic-normalized, drop punctuation & long numbers
    and common boilerplate words, collapse spaces.
    """
    t = normalize_ar(s)
    t = _RE_LONG_NUM.sub(" ", t)         # drop long number blocks
    t = _RE_NON_WORD.sub(" ", t)         # punctuation & separators -> space
    parts = [p for p in t.split() if p and p not in _STOPWORDS]
    return " ".join(parts)

def to_title(s: Any) -> str:
    t = str(s or "").strip()
    return " ".join(w[:1].upper() + w[1:] for w in t.split())

def to_date_yyyy_mm_dd(v) -> Optional[str]:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    d = pd.to_datetime(v, errors="coerce")
    if pd.isna(d):
        return None
    return d.strftime("%Y-%m-%d")

_NUMERIC_COLS = [
    "gross_amount_no_vat", "vat_amount", "discount",
    "deductible", "special_discount", "net_amount"
]

_df_cache: Optional[pd.DataFrame] = None
_last_mtime: Optional[float] = None

def load_df() -> pd.DataFrame:
    global _df_cache, _last_mtime
    mtime = os.path.getmtime(EXCEL_PATH) if os.path.exists(EXCEL_PATH) else None
    if _df_cache is not None and mtime == _last_mtime:
        return _df_cache

    df = pd.read_excel(EXCEL_PATH, engine="openpyxl")
    keep = [c for c in COLUMNS if c in df.columns]
    df = df[keep].copy()
    df.rename(columns=RENAME, inplace=True)

    if "company" not in df.columns:
        df["company"] = df.get("contract", "")

    if "treatment_date" not in df.columns:
        df["treatment_date"] = df.get("incur_date_from")
        nulls = df["treatment_date"].isna()
        if "incur_date_to" in df.columns:
            df.loc[nulls, "treatment_date"] = df.loc[nulls, "incur_date_to"]
    df["treatment_date"] = df["treatment_date"].apply(to_date_yyyy_mm_dd)

    for col in ["inv_no", "company", "contract", "claim_type", "pay_to",
                "refer_ind", "emer_ind"]:
        if col not in df.columns:
            df[col] = ""

    for col in _NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # ---- prebuilt matching keys (fast + robust) ----
    df["company_key"]  = df["company"].apply(make_key)
    df["claim_key"]    = df["claim_type"].apply(make_key)
    df["pay_key"]      = df["pay_to"].apply(make_key)
    df["contract_key"] = df["contract"].apply(make_key)

    _df_cache = df
    _last_mtime = mtime
    return _df_cache

def filter_records(
    df: pd.DataFrame,
    q: str = "",
    company: str = "",
    claim_type: str = "",
    date: str = "",
) -> pd.DataFrame:
    out = df

    if company:
        key = make_key(company)
        if key:
            out = out[
                out["company_key"].str.contains(key, na=False)
                | out["company_key"].str.startswith(key, na=False)
                | out["contract_key"].str.contains(key, na=False)
            ]

    if claim_type:
        key = make_key(claim_type)
        if key:
            out = out[
                out["claim_key"].str.contains(key, na=False)
                | out["claim_key"].str.startswith(key, na=False)
            ]

    if date:
        out = out[out["treatment_date"] == date]

    if q:
        key = make_key(q)
        if key:
            out = out[
                out["company_key"].str.contains(key, na=False)
                | out["claim_key"].str.contains(key, na=False)
                | out["pay_key"].str.contains(key, na=False)
                | out["contract_key"].str.contains(key, na=False)
                | out["inv_no"].astype(str).str.contains(key, na=False)
            ]

    return out

def as_api_rows(df: pd.DataFrame) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for _, r in df.iterrows():
        rows.append({
            "inv_no": str(r.get("inv_no", "") or ""),
            "company": to_title(r.get("company", "")),
            "claim_type": to_title(r.get("claim_type", "")),
            "gross_amount_no_vat": float(r["gross_amount_no_vat"]) if pd.notna(r.get("gross_amount_no_vat")) else None,
            "vat_amount": float(r["vat_amount"]) if pd.notna(r.get("vat_amount")) else None,
            "discount": float(r["discount"]) if pd.notna(r.get("discount")) else None,
            "deductible": float(r["deductible"]) if pd.notna(r.get("deductible")) else None,
            "special_discount": float(r["special_discount"]) if pd.notna(r.get("special_discount")) else None,
            "net_amount": float(r["net_amount"]) if pd.notna(r.get("net_amount")) else None,
            "pay_to": to_title(r.get("pay_to", "")),
            "refer_ind": (str(r.get("refer_ind", "")).strip() or "").upper(),
            "emer_ind": (str(r.get("emer_ind", "")).strip() or "").upper(),
            "treatment_date": r.get("treatment_date", None),
        })
    return rows

@router.get("/records")
def get_records(
    q: str = Query("", description="Free text over company/claim_type/pay_to/inv_no"),
    company: str = Query("", description="Company loose match (Arabic/English)"),
    claim_type: str = Query("", description="Claim type loose match"),
    date: str = Query("", description="Exact Gregorian date YYYY-MM-DD"),
):
    df = load_df()
    filtered = filter_records(df, q=q, company=company, claim_type=claim_type, date=date)

    recs = as_api_rows(filtered)
    alerts = sum(1 for r in recs if (r.get("emer_ind") == "Y") or (r.get("refer_ind") == "Y"))
    companies = {r.get("company", "").strip() for r in recs if r.get("company")}
    payload = {
        "total_claims": len(recs),
        "total_companies": len(companies),
        "alerts_count": alerts,
        "records": recs,
    }
    return JSONResponse(payload)
