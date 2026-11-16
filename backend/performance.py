import wave
from io import BytesIO

import librosa
import numpy as np

SAMPLE_RATE = 22050
MAX_SECONDS = 60
MAX_WAV_BYTES = SAMPLE_RATE * MAX_SECONDS * 2 + 4096
HOP_LENGTH = 1024

def read_excerpt(data, label):
    try:
        with wave.open(BytesIO(data), "rb") as audio:
            if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) != (1, 2, SAMPLE_RATE):
                raise ValueError(f"{label} must be a mono 22.05 kHz WAV.")
            frames = audio.getnframes()
            if not 2 * SAMPLE_RATE <= frames <= MAX_SECONDS * SAMPLE_RATE:
                raise ValueError(f"{label} must be between 2 and 60 seconds.")
            pcm = audio.readframes(frames)
            if len(pcm) != frames * 2:
                raise ValueError(f"{label} is incomplete.")
    except (wave.Error, EOFError, OSError) as error:
        raise ValueError(f"{label} could not be read as audio.") from error

    samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768
    if np.max(np.abs(samples)) < 0.001:
        raise ValueError(f"{label} is too quiet to compare.")
    samples, _ = librosa.effects.trim(samples, top_db=35)
    if samples.size < 2 * SAMPLE_RATE:
        raise ValueError(f"{label} needs at least 2 seconds of audible playing.")
    return samples

def chroma(samples):
    return librosa.feature.chroma_stft(
        y=samples, sr=SAMPLE_RATE, hop_length=HOP_LENGTH, tuning=0, norm=2
    )

def compare_performances(take_bytes, reference_bytes):
    take = read_excerpt(take_bytes, "Your recording")
    reference = read_excerpt(reference_bytes, "The reference excerpt")
    take_chroma = chroma(take)
    reference_chroma = chroma(reference)
    similarity = np.clip(take_chroma.T @ reference_chroma, 0, 1)
    _, path = librosa.sequence.dtw(C=1 - similarity)
    pitch_similarity = float(similarity[path[:, 0], path[:, 1]].mean())

    take_seconds = take.size / SAMPLE_RATE
    reference_seconds = reference.size / SAMPLE_RATE
    ratio = take_seconds / reference_seconds
    if ratio > 1.10:
        pacing = "Your take lasted longer. Try matching the reference pulse for a short phrase."
    elif ratio < 0.90:
        pacing = "Your take finished sooner. Try leaving more time for sustained notes and rests."
    else:
        pacing = "The excerpts were close in length. Listen back for differences in where each phrase speeds up or slows down."

    if pitch_similarity < 0.65:
        pitch_feedback = "The pitch patterns differed in the aligned audio. Check that both excerpts start at the same passage, then compare a few notes at a time."
    else:
        pitch_feedback = "The recordings shared much of their pitch pattern. Listen back to individual shifts and sustained notes to check intonation by ear."

    return {
        "take_seconds": round(take_seconds, 1),
        "reference_seconds": round(reference_seconds, 1),
        "pacing": pacing,
        "pitch_feedback": pitch_feedback,
        "lessons": [
            lesson
            for needed, lesson in [
                (ratio > 1.10 or ratio < 0.90, {
                    "title": "Counting rhythm with a metronome",
                    "teacher": "Violin Tutor Pro",
                    "video_id": "Oxf2Qai3d_0",
                    "reason": "Use this lesson to practice matching a steady pulse.",
                }),
                (pitch_similarity < 0.65, {
                    "title": "Playing in tune · single stops",
                    "teacher": "Julia Bushkova · ViolinClass",
                    "video_id": "bK8ku-VG6g4",
                    "reason": "After confirming the excerpts match, use this lesson to work on pitch placement.",
                }),
            ] if needed
        ],
    }
