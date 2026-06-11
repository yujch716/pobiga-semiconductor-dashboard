from flask import Blueprint, jsonify, request

from ..services.prediction_service import PROCESS_MODELS, PredictionInputError, predict

predict_bp = Blueprint("predict", __name__, url_prefix="/api/predict")


@predict_bp.get("/processes")
def list_processes():
    """공정별로 입력해야 하는 인자(features) 목록을 안내."""
    return jsonify({
        key: {
            "label": model.label,
            "features": model.features,
            "categorical": model.categorical,
        }
        for key, model in PROCESS_MODELS.items()
    })


@predict_bp.post("/<process_key>")
def predict_process(process_key):
    """공정 데이터(X 인자)를 입력받아 정상/이상 여부와 위험구간을 응답."""
    payload = request.get_json(silent=True) or {}

    try:
        result = predict(process_key, payload)
    except PredictionInputError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify(result)
