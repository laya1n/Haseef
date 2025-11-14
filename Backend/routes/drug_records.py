from fastapi import APIRouter, Query
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
import re

router = APIRouter(prefix="/drugs", tags=["Drug Records"])


def ar_normalize(text: str) -> str:
    if not isinstance(text, str):
        text = str(text or "")
    text = text.strip().lower()
    text = re.sub(r"[\u064B-\u065F\u0610-\u061A]", "", text)
    text = text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    text = text.replace("ى", "ي").replace("ة", "ه")
    text = re.sub(r"\s+", " ", text)
    return text


def load_drug_records():
    data_path = Path(__file__).resolve().parents[1] / "data" / "medical_records.xlsx"
    df = pd.read_excel(data_path, engine="openpyxl")

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
    existing_cols = [c for c in columns if c in df.columns]
    df = df[existing_cols].copy()

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
        "Treatment Date": "treatment_date",
    }
    df = df.rename(columns=rename_map)

    # ===== معالجة التاريخ =====
    if "treatment_date" in df.columns:
        td = df["treatment_date"].astype(str).str.strip()

        def fix_date(x):
            x = str(x).strip()
            # أرقام مثل 10122024 أو 10122024.0
            if x.replace(".", "", 1).isdigit():
                x = x.split(".")[0]
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
    else:
        df["treatment_date"] = pd.NaT

    df["date"] = df["treatment_date"].dt.strftime("%Y-%m-%d").fillna("")

    # ===== أعمدة البحث المطبّعة =====
    search_cols = [
        "doctor_name",
        "patient_name",
        "service_description",
        "service_code",
        "discount",
        "net_amount",
    ]
    for col in search_cols:
        if col in df.columns:
            df[f"norm_{col}"] = df[col].astype(str).map(ar_normalize)
        else:
            df[f"norm_{col}"] = ""

    # ===== تجهيز قيم رقمية (تفيد لاحقاً في التنبيهات) =====
    numeric_cols = ["quantity", "gross_amount", "vat_amount", "discount", "net_amount"]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # AI placeholder
    df["ai_analysis"] = "No analysis yet — will be added by AI Agent."

    return df


@router.get("/records")
def get_drug_records(
    q: str | None = Query(None, description="General search across all fields"),
    doctor: str | None = Query(None, description="Filter by doctor name"),
    drug: str | None = Query(None, description="Filter by drug/service name"),
    date: str | None = Query(None, description="Filter by date (YYYY-MM-DD)"),
    last_week: bool = Query(False, description="If true, show only last 7 days"),
):
    df = load_drug_records()

    # ===== فلتر آخر أسبوع =====
    if last_week and "treatment_date" in df.columns:
        today = datetime.today().date()
        last7 = today - timedelta(days=7)
        df = df[df["treatment_date"].dt.date.between(last7, today)]

    # ===== فلتر بتاريخ معيّن =====
    if date and "treatment_date" in df.columns:
        try:
            d = pd.to_datetime(date).date()
            df = df[df["treatment_date"].dt.date == d]
        except Exception:
            pass

    # ===== فلتر الطبيب =====
    if doctor and "norm_doctor_name" in df.columns:
        key = ar_normalize(doctor)
        df = df[df["norm_doctor_name"].str.contains(key, na=False)]

    # ===== فلتر الدواء =====
    if drug and "norm_service_description" in df.columns:
        key = ar_normalize(drug)
        df = df[df["norm_service_description"].str.contains(key, na=False)]

    # ===== البحث العام =====
    if q:
        key = ar_normalize(q)
        norm_cols = [c for c in df.columns if c.startswith("norm_")]
        if norm_cols:
            mask = np.column_stack(
                [df[c].str.contains(key, na=False) for c in norm_cols]
            ).any(axis=1)
            df = df[mask]

    # ===== إحصائيات عامة =====
    total_operations = int(len(df))

    # ===== منطق التنبيهات الفعلي =====
    # تعريف قاعدة بسيطة:
    # - كمية كبيرة (>= 10)
    # - أو صافي عالي (>= 5000)
    # - أو خصم عالي (>= 1000)
    alert_mask = pd.Series(False, index=df.index)

    if "quantity" in df.columns:
        alert_mask |= df["quantity"].fillna(0) >= 10
    if "net_amount" in df.columns:
        alert_mask |= df["net_amount"].fillna(0) >= 5000
    if "discount" in df.columns:
        alert_mask |= df["discount"].fillna(0) >= 1000

    df["has_alert"] = alert_mask
    alerts_count = int(alert_mask.sum())

    # ===== أشهر دواء (Top) =====
    top_drug = "—"
    if "service_description" in df.columns:
        if "quantity" in df.columns:
            grp = df.groupby("service_description")["quantity"].sum(numeric_only=True)
            if not grp.empty:
                top_drug = str(grp.sort_values(ascending=False).index[0])
        else:
            counts = df["service_description"].value_counts()
            if not counts.empty:
                top_drug = str(counts.index[0])

    columns_to_show = [
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
        "ai_analysis",
        "has_alert",  # 👈 جديد: فلاغ للتنبيه في كل سجل
    ]
    existing_cols = [c for c in columns_to_show if c in df.columns]
    out = df[existing_cols]

    return {
        "total_operations": total_operations,
        "top_drug": top_drug,
        "alerts_count": alerts_count,  # 👈 الآن محسوبة فعلياً
        "records": out.fillna("").to_dict(orient="records"),
    }


# ===== Endpoint مساعد للـ Dropdowns (أطباء + أدوية) =====
@router.get("/filters")
def get_drug_filters():
    """
    يرجّع قائمة الأطباء + الأدوية المميزة لاستخدامها في القوائم المنسدلة في الفرونت.
    """
    df = load_drug_records()

    doctors: list[str] = []
    drugs: list[str] = []

    if "doctor_name" in df.columns:
        doctors = (
            df["doctor_name"]
            .astype(str)
            .replace("nan", np.nan)
            .dropna()
            .drop_duplicates()
            .tolist()
        )

    if "service_description" in df.columns:
        drugs = (
            df["service_description"]
            .astype(str)
            .replace("nan", np.nan)
            .dropna()
            .drop_duplicates()
            .tolist()
        )

    # ترتيب أبجدي مبسّط
    doctors = sorted(doctors, key=lambda x: ar_normalize(x))
    drugs = sorted(drugs, key=lambda x: ar_normalize(x))

    return {
        "doctors": doctors,
        "drugs": drugs,
        "total_doctors": len(doctors),
        "total_drugs": len(drugs),
    }

