FROM python:3.11-slim
RUN apt-get update && apt-get install -y tesseract-ocr libgl1 libglib2.0-0 git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY requirements-ocr.txt .
ARG ENABLE_STRUCTURED_OCR=true
RUN if [ "$ENABLE_STRUCTURED_OCR" = "true" ]; then pip install --no-cache-dir -r requirements-ocr.txt; fi
RUN git clone https://github.com/junyanz/pytorch-CycleGAN-and-pix2pix.git /opt/pytorch-cyclegan-and-pix2pix \
    && git -C /opt/pytorch-cyclegan-and-pix2pix checkout --detach 2a7afba2895d52556dd5dfe07e8555ef657ced6f
ENV CGAN_REPO_DIR=/opt/pytorch-cyclegan-and-pix2pix
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
