FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc g++ curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /uploads

EXPOSE 8002

CMD ["gunicorn", "app.main:create_app()", "--bind", "0.0.0.0:8002", "--workers", "2", "--timeout", "120"]
