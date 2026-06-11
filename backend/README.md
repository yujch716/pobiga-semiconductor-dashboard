# Backend

## 실행 환경

이 프로젝트는 두 가지 실행 환경을 사용합니다.

### `.venv` (Python 3.14)
- `/api/records`, `/api/alerts` 등 DB 조회 라우트용으로 사용 가능합니다.
- `pip install -r requirements.txt`

### anaconda `bigdata` 환경 (Python 3.10, scikit-learn 1.2.x) — 예측 API 필수
`/api/predict/*` (이상 감지 예측 API)는 **반드시 `bigdata` conda 환경**에서 실행해야 합니다.

`model/etching_rf.joblib`, `model/ion_gb.joblib`은 scikit-learn 1.2.x로 학습/저장된 피클 파일이라
최신 scikit-learn(1.3+, `Tree` 노드 dtype 변경)에서는 로드 시
`ValueError: node array from the pickle has an incompatible dtype` 에러가 발생합니다.
모델을 재학습하지 않고 그대로 사용하기 위해, 모델을 학습한 환경과 동일한 `bigdata` conda 환경을
사용합니다.

```bash
cd backend
~/miniconda3/envs/bigdata/bin/pip install flask-cors flask-sqlalchemy  # 최초 1회
~/miniconda3/envs/bigdata/bin/python -m flask --app main.app run --debug
```

## 예측 API

- `GET /api/predict/processes` — 공정별로 입력해야 하는 인자(features) 목록 조회
- `POST /api/predict/<process>` — 공정 데이터(JSON)를 입력받아 정상/이상 여부, 위험구간(저위험/중위험/고위험), 불량 확률(%)을 반환

지원하는 `<process>`: `oxi`, `photo-softbake`, `photo-litho`, `etching`, `ion`
