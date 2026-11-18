import re
import shutil
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import parse_qs, urlparse

from backend.performance import MAX_WAV_BYTES, SAMPLE_RATE

class ReferenceUnavailable(RuntimeError):
    pass

def youtube_id(value):
    url = urlparse(value)
    if url.scheme != "https":
        raise ValueError("Enter an HTTPS YouTube video link.")
    parts = url.path.strip("/").split("/")
    video_id = None
    if url.hostname == "youtu.be":
        video_id = parts[0]
    elif url.hostname in ("youtube.com", "www.youtube.com", "m.youtube.com"):
        if parts[0] == "watch":
            video_id = parse_qs(url.query).get("v", [None])[0]
        elif parts[0] in ("shorts", "live", "embed") and len(parts) > 1:
            video_id = parts[1]
    if not video_id or not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
        raise ValueError("Enter a valid YouTube video link.")
    return video_id

def reference_excerpt(video_id, start, duration):
    if not shutil.which("ffmpeg"):
        raise ReferenceUnavailable("Audio comparison needs FFmpeg installed on the backend.")
    try:
        resolved = subprocess.run(
            [
                sys.executable, "-m", "yt_dlp", "--ignore-config", "--no-playlist",
                "--no-warnings", "--socket-timeout", "15", "--retries", "1",
                "--js-runtimes", "node", "-f", "bestaudio", "--get-url",
                "--", f"https://www.youtube.com/watch?v={video_id}",
            ],
            capture_output=True, text=True, timeout=45, check=True,
        )
        media_url = resolved.stdout.strip()
        host = urlparse(media_url).hostname or ""
        if urlparse(media_url).scheme != "https" or not host.endswith(".googlevideo.com"):
            raise ReferenceUnavailable("This reference did not provide a supported audio stream.")
        with TemporaryDirectory() as directory:
            output = Path(directory) / "reference.wav"
            subprocess.run(
                [
                    "ffmpeg", "-nostdin", "-loglevel", "error", "-y",
                    "-rw_timeout", "15000000", "-ss", str(start), "-i", media_url,
                    "-t", str(duration), "-vn", "-ac", "1", "-ar", str(SAMPLE_RATE),
                    "-c:a", "pcm_s16le", "-fs", str(MAX_WAV_BYTES), str(output),
                ],
                capture_output=True, timeout=90, check=True,
            )
            return output.read_bytes()
    except (subprocess.SubprocessError, OSError) as error:
        raise ReferenceUnavailable(
            "Could not retrieve this YouTube excerpt. Check your connection and try a public, accessible performance."
        ) from error
