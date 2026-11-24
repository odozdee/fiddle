FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    JAVA_TOOL_OPTIONS="-Djava.awt.headless=true"

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl python3 python3-venv ffmpeg fonts-dejavu-core \
    && curl -fL --retry 3 \
    https://github.com/Audiveris/audiveris/releases/download/5.7.0/Audiveris-5.7.0-ubuntu24.04-x86_64.deb \
    -o /tmp/audiveris.deb \
    && apt-get install -y --no-install-recommends /tmp/audiveris.deb \
    && rm /tmp/audiveris.deb \
    && rm -rf /var/lib/apt/lists/* \
    && test -x /opt/audiveris/bin/Audiveris

WORKDIR /app

COPY requirements.txt ./
RUN python3 -m venv /opt/venv \
    && pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

CMD ["sh", "-c", "exec uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
