FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8003

CMD ["gunicorn", "app.main:create_app()", "--bind", "0.0.0.0:8003", "--workers", "2", "--timeout", "60"]
