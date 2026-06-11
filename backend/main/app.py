import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from .extensions import db
from .models import ModelingMerged, WaferInspection
from .routes.predict import predict_bp
from .routes.inspections import inspections_bp

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "modeling_merged.db")

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
CORS(app)

db.init_app(app)
app.register_blueprint(predict_bp)
app.register_blueprint(inspections_bp)

with app.app_context():
    db.create_all()

@app.get("/")
def index():
    return 'Server Open'


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/records")
def list_records():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    is_low_yield = request.args.get("is_low_yield", type=int)

    query = ModelingMerged.query
    if is_low_yield is not None:
        query = query.filter_by(is_low_yield=is_low_yield)

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "items": [item.to_dict() for item in pagination.items],
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total": pagination.total,
        "pages": pagination.pages,
    })


@app.get("/api/records/<int:record_id>")
def get_record(record_id):
    record = db.get_or_404(ModelingMerged, record_id)
    return jsonify(record.to_dict())


@app.get("/api/alerts")
def list_alerts():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    pagination = (
        ModelingMerged.query.filter_by(is_low_yield=1)
        .order_by(ModelingMerged.id.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    return jsonify({
        "items": [item.to_dict() for item in pagination.items],
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total": pagination.total,
        "pages": pagination.pages,
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
