FROM python:3.12-slim

WORKDIR /app

# System deps for Prophet (cmdstanpy) and CatBoost
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libgomp1 make \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    python -c "import cmdstanpy; cmdstanpy.install_cmdstan()" && \
    rm -rf /tmp/tmp* /root/.cmdstan/cmdstan-*/examples

COPY . .

EXPOSE 8003

CMD ["gunicorn", "app.main:create_app()", "--bind", "0.0.0.0:8003", "--workers", "2", "--timeout", "120"]
