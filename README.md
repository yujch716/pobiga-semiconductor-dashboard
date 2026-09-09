# 반도체 공정 대시보드

반도체 제조 공정(산화, 포토 소프트베이크/리소, 식각, 이온주입)의 공정 데이터를 입력받아
불량 여부와 위험구간을 예측하고, 이상 이력을 확인할 수 있는 웹 대시보드입니다.

## 구성

| 디렉토리 | 설명 |
| --- | --- |
| [`front/`](front) | React + TypeScript + Vite 기반 프론트엔드 |
| [`backend/`](backend) | Flask 기반 백엔드 API 서버 |

## 주요 기능

- **대시보드**: 공정별 주요 지표 및 현황 조회
- **예측**: 공정 파라미터를 입력하면 정상/이상 여부, 위험구간(저/중/고위험), 불량 확률(%)을 반환
- **알림/이력**: 이상으로 판정된 웨이퍼/로트 이력 조회 및 읽음 처리

## 기술 스택

- **Frontend**: React 19, TypeScript, Vite, React Router, Tailwind CSS, Radix UI, Recharts
- **Backend**: Flask, Flask-SQLAlchemy, scikit-learn, LightGBM
- **DB**: SQLite

## 시작하기

### 프론트엔드

```bash
cd front
yarn install
yarn dev
```

### 백엔드

`/api/predict/*` 예측 API는 모델이 학습된 scikit-learn 1.2.x 버전에 맞춘 실행 환경이 필요합니다.
자세한 실행 방법과 API 목록은 [`backend/README.md`](backend/README.md)를 참고하세요.

```bash
cd backend
pip install -r requirements.txt
python -m flask --app main.app run --debug
```

## API 개요

| Endpoint | 설명 |
| --- | --- |
| `GET /api/health` | 서버 상태 확인 |
| `GET /api/records` | 공정 데이터 목록 조회 |
| `GET /api/alerts` | 불량(저수율) 데이터 목록 조회 |
| `GET /api/predict/processes` | 공정별 필요 입력 인자 목록 조회 |
| `POST /api/predict/<process>` | 공정 데이터 입력 → 불량 여부/위험구간/불량 확률 예측 |
| `GET /api/inspections` | 판정 이력 목록 조회 |
| `POST /api/inspections` | 판정 이력 생성 |
| `GET /api/inspections/unread-count` | 읽지 않은 이력 개수 조회 |
| `POST /api/inspections/mark-read` | 이력 읽음 처리 |

지원 공정(`<process>`): `oxi`, `photo-softbake`, `photo-litho`, `etching`, `ion`