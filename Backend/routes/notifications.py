# Backend/notifications.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Literal, Optional
from uuid import uuid4
from datetime import datetime, timedelta
import asyncio
import json

router = APIRouter(prefix="/notifications", tags=["Notifications"])

# ===========================
#      النماذج Model
# ===========================

Kind = Literal["طبي", "تأمين", "دواء"]
Severity = Literal["طارئ", "تنبيه", "معلومة"]


class Notification(BaseModel):
    id: str
    title: str
    body: str
    kind: Kind
    severity: Severity
    time: str  # صيغة للعرض فقط "YYYY-MM-DD HH:MM"
    read: bool = False


class MarkReadPayload(BaseModel):
    read: bool


# ===========================
#   قاعدة بيانات بسيطة في الذاكرة
#   (تكفي للهكاثون / الديمو)
# ===========================

NOTIFICATIONS: List[Notification] = []


def _now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def seed_demo_notifications() -> None:
    """إشعارات تجريبية لعرض الفكرة في الواجهة."""
    global NOTIFICATIONS
    if NOTIFICATIONS:
        # تم التهيئة من قبل
        return

    base_time = datetime.now()

    demo = [
        Notification(
            id=str(uuid4()),
            title="نمط صرف دوائي غير منطقي",
            body=(
                "تم رصد تكرار وصف دواء Omeprazole بجرعات متشابهة "
                "لحالات تشخيص مختلفة. يُرجى مراجعة التشخيص والتأكد من "
                "توافق الوصفة مع البروتوكول العلاجي المعتمد."
            ),
            kind="دواء",
            severity="طارئ",
            time=(base_time - timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M"),
            read=False,
        ),
        Notification(
            id=str(uuid4()),
            title="مطالبات تأمين متكررة لفحص MRI",
            body=(
                "لاحظ حصيف تكرار مطالبات لفحص MRI للعمود الفقري خلال فترة قصيرة "
                "مع تشخيصات عامة (ألم مزمن). يُرجى مراجعة المبررات الطبية قبل اعتماد التعويض."
            ),
            kind="تأمين",
            severity="تنبيه",
            time=(base_time - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M"),
            read=False,
        ),
        Notification(
            id=str(uuid4()),
            title="تحسن في نمط وصف المضادات الحيوية",
            body=(
                "سجّل حصيف انخفاضًا في وصف المضادات الحيوية واسعة الطيف خلال آخر ٧ أيام "
                "مقارنة بالفترة السابقة. لا توجد أنماط عالية الخطورة حاليًا."
            ),
            kind="طبي",
            severity="معلومة",
            time=(base_time - timedelta(days=1)).strftime("%Y-%m-%d %H:%M"),
            read=True,
        ),
    ]

    NOTIFICATIONS = demo


# تهيئة البيانات عند استيراد الموديول
seed_demo_notifications()


# ===========================
#       REST Endpoints
# ===========================

@router.get("", response_model=List[Notification])
async def list_notifications(
    kind: Optional[Kind] = None,
    severity: Optional[Severity] = None,
    q: Optional[str] = None,
):
    """
    جلب قائمة الإشعارات مع فلاتر اختيارية:
    - kind: طبي / تأمين / دواء
    - severity: طارئ / تنبيه / معلومة
    - q: بحث نصي في العنوان أو المحتوى
    """
    data = NOTIFICATIONS

    if kind:
        data = [n for n in data if n.kind == kind]

    if severity:
        data = [n for n in data if n.severity == severity]

    if q:
        q_lower = q.lower()
        data = [
            n
            for n in data
            if q_lower in n.title.lower() or q_lower in n.body.lower()
        ]

    # نعيد مرتبة من الأحدث إلى الأقدم
    data = sorted(data, key=lambda n: n.time, reverse=True)
    return data


@router.post("/mark-all-read")
async def mark_all_read():
    """تعليم جميع الإشعارات كمقروءة."""
    for n in NOTIFICATIONS:
        n.read = True
    return {"status": "ok", "updated": len(NOTIFICATIONS)}


@router.post("/{noti_id}/mark-read")
async def mark_read(
    noti_id: str,
    payload: MarkReadPayload,
):
    """
    تغيير حالة إشعار واحد (read / unread).
    يستخدمه الفرونت عند الضغط على زر الصح.
    """
    for n in NOTIFICATIONS:
        if n.id == noti_id:
            n.read = payload.read
            return {"status": "ok", "id": noti_id, "read": n.read}

    raise HTTPException(status_code=404, detail="الإشعار غير موجود")


@router.delete("")
async def delete_all():
    """مسح جميع الإشعارات (للديمو أو إعادة الضبط)."""
    count = len(NOTIFICATIONS)
    NOTIFICATIONS.clear()
    return {"status": "ok", "deleted": count}


@router.delete("/{noti_id}")
async def delete_one(noti_id: str):
    """مسح إشعار واحد."""
    global NOTIFICATIONS
    before = len(NOTIFICATIONS)
    NOTIFICATIONS = [n for n in NOTIFICATIONS if n.id != noti_id]
    after = len(NOTIFICATIONS)

    if before == after:
        raise HTTPException(status_code=404, detail="الإشعار غير موجود")

    return {"status": "ok", "deleted": noti_id}


# ===========================
#      SSE Stream Endpoint
# ===========================

async def _notifications_event_generator(request: Request):
    """
    مولّد لبث الإشعارات الجديدة باستخدام Server-Sent Events (SSE).

    الفكرة:
    - نتتبع آخر عدد من الإشعارات.
    - كلما زاد العدد نرسل آخر إشعار كـ JSON.
    - في المشروع الفعلي يمكنك استبدال هذا بجلب من
      الذكاء الاصطناعي أو من الـ Agent.
    """
    last_len = len(NOTIFICATIONS)

    # عند أول اتصال يمكن إرسال آخر إشعار موجود (اختياري)
    if NOTIFICATIONS:
        last = NOTIFICATIONS[0]
        payload = json.dumps(last.dict(), ensure_ascii=False)
        yield f"data: {payload}\n\n"

    while True:
        # إغلاق عند قطع الاتصال من الفرونت
        if await request.is_disconnected():
            break

        current_len = len(NOTIFICATIONS)
        if current_len > last_len:
            # تم إضافة إشعارات جديدة
            new_items = NOTIFICATIONS[last_len:current_len]
            for n in new_items:
                payload = json.dumps(n.dict(), ensure_ascii=False)
                yield f"data: {payload}\n\n"
            last_len = current_len

        # مهلة صغيرة لتخفيف الضغط
        await asyncio.sleep(2)


@router.get("/stream")
async def notifications_stream(request: Request):
    """
    endpoint: /api/notifications/stream

    يستخدمه الـ EventSource في الفرونت لاستقبال الإشعارات في الوقت الفعلي.
    """
    return StreamingResponse(
        _notifications_event_generator(request),
        media_type="text/event-stream",
    )


# ===========================
#  دالة مساعدة: تستخدمونها من الAgent
#  لإضافة إشعار جديد من الذكاء الاصطناعي
# ===========================

def push_notification(
    *,
    title: str,
    body: str,
    kind: Kind,
    severity: Severity,
    mark_unread: bool = True,
) -> Notification:
    """
    يمكن استدعاؤها من أي جزء في الباك-اند (مثل Agent أو مهمة تحليل)
    لإضافة إشعار جديد إلى القائمة، وسيظهر تلقائيًا في الفرونت
    + عبر الـ SSE.
    """
    n = Notification(
        id=str(uuid4()),
        title=title,
        body=body,
        kind=kind,
        severity=severity,
        time=_now_str(),
        read=not mark_unread,
    )
    NOTIFICATIONS.insert(0, n)
    return n
