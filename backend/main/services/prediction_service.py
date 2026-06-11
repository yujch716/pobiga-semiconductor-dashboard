"""공정별 이상 감지(분류) 모델을 불러와 예측을 수행하는 서비스 모듈."""
from pathlib import Path

import joblib
import lightgbm as lgb
import pandas as pd

MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "model"


class PredictionInputError(ValueError):
    """요청 입력값이 올바르지 않을 때 발생시키는 예외."""


class ProcessModel:
    """공정 하나에 대한 모델 메타데이터(특성, 위험구간 임계값 등)와 예측 로직을 담당."""

    def __init__(self, *, key, label, features, threshold_low, threshold_high, categorical=None):
        self.key = key
        self.label = label
        self.features = features
        self.threshold_low = threshold_low
        self.threshold_high = threshold_high
        self.categorical = categorical or {}
        self._model = None

    def _load(self):
        raise NotImplementedError

    @property
    def model(self):
        if self._model is None:
            self._model = self._load()
        return self._model

    def predict_bad_prob(self, X: pd.DataFrame) -> float:
        raise NotImplementedError


class LightGBMProcessModel(ProcessModel):
    def __init__(self, *, model_file, **kwargs):
        super().__init__(**kwargs)
        self.model_file = model_file

    def _load(self):
        return lgb.Booster(model_file=str(MODEL_DIR / self.model_file))

    def predict_bad_prob(self, X: pd.DataFrame) -> float:
        return float(self.model.predict(X)[0])


class JoblibProcessModel(ProcessModel):
    def __init__(self, *, model_file, **kwargs):
        super().__init__(**kwargs)
        self.model_file = model_file

    def _load(self):
        return joblib.load(MODEL_DIR / self.model_file)

    def predict_bad_prob(self, X: pd.DataFrame) -> float:
        return float(self.model.predict_proba(X)[:, 1][0])


# 위험구간 임계값(threshold_low/high)은 backend/model/predict_proba/*.ipynb 에서
# 테스트셋 기준으로 산출한 값을 그대로 사용한다.
PROCESS_MODELS: dict[str, ProcessModel] = {
    "oxi": LightGBMProcessModel(
        key="oxi",
        label="산화 (Oxidation)",
        model_file="oxi_lgbm.txt",
        features=["type_dry", "type_wet", "Temp_OXid", "ppm", "Pressure", "Oxid_time", "thickness"],
        threshold_low=0.3,
        threshold_high=0.999816,
    ),
    "photo-softbake": LightGBMProcessModel(
        key="photo-softbake",
        label="포토 (Photo-Softbake)",
        model_file="photo_softbake_lgbm.txt",
        features=[
            "photo_soft_Chamber",
            "resist_target",
            "N2_HMDS",
            "pressure_HMDS",
            "temp_HMDS",
            "temp_HMDS_bake",
            "time_HMDS_bake",
            "spin1",
            "spin2",
            "spin3",
            "photoresist_bake",
            "temp_softbake",
            "time_softbake",
        ],
        threshold_low=0.1,
        threshold_high=0.990784,
    ),
    "photo-litho": LightGBMProcessModel(
        key="photo-litho",
        label="포토 (Photo-Litho)",
        model_file="photo_litho_lgbm.txt",
        features=["UV_type", "Resolution", "Energy_Exposure", "Line_CD"],
        threshold_low=0.3,
        threshold_high=0.873956,
        categorical={"UV_type": ["G", "H", "I"]},
    ),
    "etching": JoblibProcessModel(
        key="etching",
        label="식각 (Etching)",
        model_file="etching_rf.joblib",
        features=["Thin F4", "Thin F3", "Thin F2", "Thin F1", "Temp_Etching", "Selectivity", "Source_Power"],
        threshold_low=0.3,
        threshold_high=0.9925,
    ),
    "ion": JoblibProcessModel(
        key="ion",
        label="이온 (Ion)",
        model_file="ion_gb.joblib",
        features=[
            "Ion_Chamber",
            "Flux60s",
            "Flux90s",
            "Flux160s",
            "Flux480s",
            "Flux840s",
            "input_Energy",
            "Temp_implantation",
            "Furance_Temp",
            "RTA_Temp",
        ],
        threshold_low=0.3,
        threshold_high=0.972209,
    ),
}


def get_process_model(process_key: str) -> ProcessModel:
    model = PROCESS_MODELS.get(process_key)
    if model is None:
        valid = ", ".join(PROCESS_MODELS)
        raise PredictionInputError(f"알 수 없는 공정입니다: '{process_key}' (사용 가능: {valid})")
    return model


def assign_risk_level(bad_prob: float, model: ProcessModel) -> str:
    if bad_prob <= model.threshold_low:
        return "저위험"
    if bad_prob >= model.threshold_high:
        return "고위험"
    return "중위험"


def build_features(model: ProcessModel, payload: dict) -> pd.DataFrame:
    data = dict(payload)

    # 산화 공정: 사용자 입력 'type'(dry/wet)을 학습 시 사용된 원-핫 컬럼으로 변환
    if model.key == "oxi" and "type" in data and "type_dry" not in data and "type_wet" not in data:
        oxi_type = str(data.pop("type")).strip().lower()
        if oxi_type not in ("dry", "wet"):
            raise PredictionInputError("type 값은 'dry' 또는 'wet'이어야 합니다.")
        data["type_dry"] = 1 if oxi_type == "dry" else 0
        data["type_wet"] = 1 if oxi_type == "wet" else 0

    missing = [f for f in model.features if f not in data]
    if missing:
        raise PredictionInputError(f"누락된 입력값이 있습니다: {', '.join(missing)}")

    row = {f: data[f] for f in model.features}
    df = pd.DataFrame([row], columns=model.features)

    numeric_cols = [f for f in model.features if f not in model.categorical]
    try:
        df[numeric_cols] = df[numeric_cols].apply(pd.to_numeric)
    except (ValueError, TypeError) as exc:
        raise PredictionInputError(f"숫자 형식이 아닌 입력값이 있습니다: {exc}") from None

    for col, categories in model.categorical.items():
        value = str(df.at[0, col]).strip()
        if value not in categories:
            raise PredictionInputError(f"'{col}' 값은 {categories} 중 하나여야 합니다.")
        df[col] = pd.Categorical([value], categories=categories)

    return df


def predict(process_key: str, payload: dict) -> dict:
    model = get_process_model(process_key)
    X = build_features(model, payload)

    bad_prob = model.predict_bad_prob(X)
    risk_level = assign_risk_level(bad_prob, model)
    is_normal = risk_level == "저위험"

    return {
        "process": model.key,
        "label": model.label,
        "is_normal": is_normal,
        "result": "정상" if is_normal else "이상",
        "bad_prob": round(bad_prob, 6),
        "bad_prob_percent": round(bad_prob * 100, 2),
        "risk_level": risk_level,
        "thresholds": {
            "low": model.threshold_low,
            "high": model.threshold_high,
        },
    }
