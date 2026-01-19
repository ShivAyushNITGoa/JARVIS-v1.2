FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port (Hugging Face uses 7860)
EXPOSE 7860

# Run
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]