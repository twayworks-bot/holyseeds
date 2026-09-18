# Use official lightweight Python base image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DATA_DIR=/app/data

# Set work directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY catalog_app.py .
COPY coolify_api.py .
COPY database.py .
COPY static/ static/

# Prepare persistent data volume directory for SQLite DB and uploaded assets
RUN mkdir -p /app/data/uploads
VOLUME ["/app/data"]

# Expose the application port
EXPOSE 5000

# Add the specific container health check requested by the user
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=5s \
    CMD python -c "import requests; requests.get('http://localhost:5000/api/status')"

# Run the FastAPI server using Uvicorn on port 5000
CMD ["uvicorn", "catalog_app:app", "--host", "0.0.0.0", "--port", "5000"]
