FROM python:3.11-slim

WORKDIR /app

# libgl is needed by Pillow/torchvision when decoding some image formats;
# everything else is the standard slim build chain.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libgomp1 libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# torch + torchvision: pulled from the official PyTorch CUDA 12.1 index so the
# wheels carry their own CUDA runtime. The host only needs the NVIDIA driver
# + nvidia-container-toolkit; no system CUDA install. cu121 wheels run fine
# on Turing (sm_75 / GTX 1660 Super) and Ampere alike.
#
# `--no-cache-dir` matters here: torch is ~700MB and pip's cache would double
# the layer size for no benefit inside a final image.
RUN pip install --no-cache-dir \
    torch==2.4.1 torchvision==0.19.1 \
    --index-url https://download.pytorch.org/whl/cu121

COPY . .

EXPOSE 8005

CMD ["gunicorn", "app.main:create_app()", "--bind", "0.0.0.0:8005", "--workers", "1", "--timeout", "300"]
