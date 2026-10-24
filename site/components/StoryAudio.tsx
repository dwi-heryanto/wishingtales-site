"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { audioUrl, formatAudioTime } from "@/lib/audio";

type Props = {
  slug: string;
  title: string;
  /** Duration recorded in content/audio.json; the file's metadata overrides it. */
  seconds: number;
  cover?: string;
};

const RATES = [1, 1.25, 0.75, 1.5];
const POSITION_PREFIX = "wt:audio:";
const RATE_KEY = "wt:audio:rate";

function readNumber(key: string): number | null {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function StoryAudio({ slug, title, seconds, cover }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(seconds);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState(false);
  const positionKey = POSITION_PREFIX + slug;

  const persist = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      // Do not remember the first few seconds (nothing to resume) or the last ones (done).
      if (audio.currentTime > 3 && audio.currentTime < audio.duration - 5) {
        localStorage.setItem(positionKey, String(Math.floor(audio.currentTime)));
      }
    } catch {
      // Private mode or a disabled store: playback still works, resume does not.
    }
  }, [positionKey]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const savedRate = readNumber(RATE_KEY);
    if (savedRate !== null && RATES.includes(savedRate)) {
      audio.playbackRate = savedRate;
      setRate(savedRate);
    }

    const onLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
      const saved = readNumber(positionKey);
      if (saved !== null && saved > 3 && saved < audio.duration - 10) {
        audio.currentTime = saved;
        setCurrent(saved);
      }
    };
    const onTime = () => setCurrent(audio.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      persist();
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
      try {
        localStorage.removeItem(positionKey);
      } catch {
        // ignore
      }
    };
    const onError = () => {
      setFailed(true);
      setPlaying(false);
    };
    const onPageHide = () => persist();

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    window.addEventListener("pagehide", onPageHide);
    // Metadata can arrive before this effect runs; read it once either way.
    if (audio.readyState >= 1) onLoaded();

    const timer = window.setInterval(() => {
      if (!audio.paused) persist();
    }, 5000);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(timer);
      persist();
      audio.pause();
    };
  }, [persist, positionKey]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: "WishingTales",
        album: title,
        artwork: cover
          ? [{ src: new URL(cover, window.location.origin).toString(), sizes: "512x768", type: "image/jpeg" }]
          : [],
      });
      const audio = audioRef.current;
      if (!audio) return;
      navigator.mediaSession.setActionHandler("play", () => void audio.play());
      navigator.mediaSession.setActionHandler("pause", () => audio.pause());
      navigator.mediaSession.setActionHandler("seekbackward", () => {
        audio.currentTime = Math.max(0, audio.currentTime - 15);
      });
      navigator.mediaSession.setActionHandler("seekforward", () => {
        audio.currentTime = Math.min(audio.duration || seconds, audio.currentTime + 15);
      });
      return () => {
        for (const action of ["play", "pause", "seekbackward", "seekforward"] as const) {
          navigator.mediaSession.setActionHandler(action, null);
        }
      };
    } catch {
      // A browser without lock-screen controls still gets the in-page player.
      return;
    }
  }, [cover, seconds, title]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setFailed(true);
      }
    } else {
      audio.pause();
    }
  };

  const skip = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const end = audio.duration || seconds;
    audio.currentTime = Math.max(0, Math.min(end, audio.currentTime + delta));
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  };

  const cycleRate = () => {
    const audio = audioRef.current;
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    if (audio) audio.playbackRate = next;
    setRate(next);
    try {
      localStorage.setItem(RATE_KEY, String(next));
    } catch {
      // ignore
    }
  };

  return (
    <section className="story-audio" aria-labelledby={"audio-title-" + slug}>
      <audio ref={audioRef} src={audioUrl(slug)} preload="metadata" />
      {/*
       * Without JavaScript the custom controls are inert, so hide them and leave a native
       * audio element: the story can still be heard, just without resume or speed.
       */}
      <noscript>
        <style>{".story-audio__ui{display:none}"}</style>
        <audio controls preload="metadata" src={audioUrl(slug)} />
      </noscript>

      <div className="story-audio__ui">
        <div className="story-audio__lead">
          <button
            type="button"
            className="story-audio__play"
            onClick={() => void toggle()}
            aria-label={playing ? "Pause narration" : "Play narration"}
          >
            <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
          </button>
          <div>
            <p className="story-audio__title" id={"audio-title-" + slug}>
              Listen to this story
            </p>
            <p className="story-audio__hint">Narrated · {formatAudioTime(duration)}</p>
          </div>
        </div>

        <input
          className="story-audio__seek"
          type="range"
          min={0}
          max={Math.max(1, duration)}
          step={1}
          value={Math.min(current, Math.max(1, duration))}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Seek through the narration"
        />

        <div className="story-audio__row">
          <span className="story-audio__time">{formatAudioTime(current)}</span>
          <div className="story-audio__buttons">
            <button type="button" className="story-audio__small" onClick={() => skip(-15)}>
              −15s
            </button>
            <button type="button" className="story-audio__small" onClick={() => skip(15)}>
              +15s
            </button>
            <button
              type="button"
              className="story-audio__small"
              onClick={cycleRate}
              aria-label={"Playback speed " + rate + " times"}
            >
              {rate}×
            </button>
          </div>
          <span className="story-audio__time">{formatAudioTime(duration)}</span>
        </div>

        {failed ? (
          <p className="story-audio__error" role="status">
            The audio could not load. You can still read the story below.
          </p>
        ) : null}
      </div>
    </section>
  );
}
