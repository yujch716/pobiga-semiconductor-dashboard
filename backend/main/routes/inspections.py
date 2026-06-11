from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import WaferInspection

inspections_bp = Blueprint("inspections", __name__, url_prefix="/api/inspections")


@inspections_bp.post("/")
def create_inspection():
    payload = request.get_json(silent=True) or {}

    inspection = WaferInspection(
        lot_num=payload.get("lot_num"),
        wafer_num=payload.get("wafer_num"),
        wafer_count=payload.get("wafer_count", 1),
        applied_to_all=payload.get("applied_to_all", False),
        process=payload.get("process"),
        process_label=payload.get("process_label"),
        risk_level=payload.get("risk_level"),
        bad_prob_percent=payload.get("bad_prob_percent"),
        result_type=payload.get("result_type"),
    )
    db.session.add(inspection)
    db.session.commit()

    return jsonify(inspection.to_dict()), 201


@inspections_bp.get("/")
def list_inspections():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    pagination = (
        WaferInspection.query.order_by(WaferInspection.id.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    return jsonify({
        "items": [item.to_dict() for item in pagination.items],
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total": pagination.total,
        "pages": pagination.pages,
    })


@inspections_bp.get("/unread-count")
def unread_count():
    count = WaferInspection.query.filter_by(is_read=False).count()
    return jsonify({"count": count})


@inspections_bp.post("/mark-read")
def mark_read():
    updated = (
        WaferInspection.query.filter_by(is_read=False)
        .update({"is_read": True})
    )
    db.session.commit()
    return jsonify({"updated": updated})
