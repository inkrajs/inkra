import { __iconData as pauseIcon } from 'lucide-react/dist/esm/icons/pause.mjs';
import { __iconData as playIcon } from 'lucide-react/dist/esm/icons/play.mjs';
import { __iconData as volumeIcon } from 'lucide-react/dist/esm/icons/volume-2.mjs';
import { __iconData as muteIcon } from 'lucide-react/dist/esm/icons/volume-x.mjs';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import type { PencilIconPath } from '../PencilIcon.js';
import { PencilText } from '../PencilText.js';
import { Select } from '../select/index.js';
import { Slider } from '../slider/index.js';

type LucideNode = readonly [string, Record<string, string>];

function number(attributes: Record<string, string>, name: string): number {
  const value = Number(attributes[name]);
  return Number.isFinite(value) ? value : 0;
}

function iconPaths(nodes: readonly LucideNode[]): readonly PencilIconPath[] {
  return nodes.flatMap(([tag, attributes]) => {
    if (tag === 'path' && attributes.d) return [{ d: attributes.d }];
    if (tag === 'line') return [{ d: `M${number(attributes, 'x1')} ${number(attributes, 'y1')}L${number(attributes, 'x2')} ${number(attributes, 'y2')}` }];
    if (tag === 'rect') {
      const x = number(attributes, 'x');
      const y = number(attributes, 'y');
      const width = number(attributes, 'width');
      const height = number(attributes, 'height');
      const radius = Math.min(number(attributes, 'rx'), width / 2, height / 2);
      return [{ d: radius
        ? `M${x + radius} ${y}H${x + width - radius}Q${x + width} ${y} ${x + width} ${y + radius}V${y + height - radius}Q${x + width} ${y + height} ${x + width - radius} ${y + height}H${x + radius}Q${x} ${y + height} ${x} ${y + height - radius}V${y + radius}Q${x} ${y} ${x + radius} ${y}Z`
        : `M${x} ${y}H${x + width}V${y + height}H${x}Z` }];
    }
    return [];
  });
}

const playPaths = iconPaths(playIcon.node);
const pausePaths = iconPaths(pauseIcon.node);
const volumePaths = iconPaths(volumeIcon.node);
const mutePaths = iconPaths(muteIcon.node);
const rates = [0.75, 1, 1.25, 1.5, 2];

export interface VideoResourceLabels {
  controls: string;
  play: string;
  pause: string;
  seek: string;
  mute: string;
  unmute: string;
  volume: string;
  rate: string;
  playbackError: string;
  time: (current: number, duration: number) => string;
}

export interface VideoResourceProps {
  src: string;
  poster?: string;
  alt: string;
  labels?: Partial<VideoResourceLabels>;
  onError?: () => void;
  onLoad?: () => void;
}

const defaultLabels: VideoResourceLabels = {
  controls: 'Video controls',
  play: 'Play video',
  pause: 'Pause video',
  seek: 'Seek video',
  mute: 'Mute video',
  unmute: 'Unmute video',
  volume: 'Video volume',
  rate: 'Playback speed',
  playbackError: 'Video playback could not start.',
  time: (current, duration) => `${formatTime(current)} / ${formatTime(duration)}`,
};

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function VideoResource({ alt, labels: overrides, onError, onLoad, poster, src }: VideoResourceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sourceRef = useRef(src);
  sourceRef.current = src;
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const playRequestRef = useRef(0);
  const callbacksRef = useRef({ onError, onLoad });
  callbacksRef.current = { onError, onLoad };
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMutedState] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [playbackError, setPlaybackError] = useState(false);
  const labels = { ...defaultLabels, ...overrides };

  const sync = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setPlaying(!video.paused && !video.ended);
    setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    setVolumeState(video.volume);
    setMutedState(video.muted);
    setPlaybackRateState(video.playbackRate);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      playRequestRef.current += 1;
      videoRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const handlers: Partial<Record<keyof HTMLMediaElementEventMap, EventListener>> = {
      loadedmetadata: () => { sync(); callbacksRef.current.onLoad?.(); },
      durationchange: sync,
      timeupdate: sync,
      play: sync,
      pause: sync,
      ended: sync,
      volumechange: sync,
      ratechange: sync,
      emptied: sync,
      error: () => { sync(); callbacksRef.current.onError?.(); },
    };
    Object.entries(handlers).forEach(([name, handler]) => video.addEventListener(name, handler!));
    return () => Object.entries(handlers).forEach(([name, handler]) => video.removeEventListener(name, handler!));
  }, [sync]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    generationRef.current += 1;
    playRequestRef.current += 1;
    video.pause();
    try { video.currentTime = 0; } catch { /* A source may not have a timeline yet. */ }
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError(false);
    video.load();
    return () => { video.pause(); };
  }, [src]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) { playRequestRef.current += 1; video.pause(); return; }
    const generation = generationRef.current;
    const source = sourceRef.current;
    const request = ++playRequestRef.current;
    setPlaybackError(false);
    try {
      await video.play();
      if (!mountedRef.current || generation !== generationRef.current || source !== sourceRef.current || request !== playRequestRef.current) return;
      sync();
    } catch {
      if (!mountedRef.current || generation !== generationRef.current || source !== sourceRef.current || request !== playRequestRef.current) return;
      setPlaybackError(true);
      sync();
    }
  };

  const seek = (next: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(next)) return;
    video.currentTime = clamp(next, 0, Number.isFinite(video.duration) ? video.duration : Math.max(0, next));
    sync();
  };

  const setVolume = (next: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = clamp(next, 0, 1);
    if (video.muted && video.volume > 0) video.muted = false;
    sync();
  };

  const setMuted = (next: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = next;
    sync();
  };

  const setRate = (next: number) => {
    const video = videoRef.current;
    if (!video) return;
    const rate = clamp(next, 0.25, 4);
    video.defaultPlaybackRate = rate;
    video.playbackRate = rate;
    sync();
  };

  return <div className="inkra-image-viewer__video-resource">
    <video
      aria-label={alt}
      className="inkra-image-viewer__video-media"
      controls={false}
      playsInline
      poster={poster}
      preload="metadata"
      ref={videoRef}
      src={src}
    />
    <div aria-label={labels.controls} className="inkra-image-viewer__video-controls" role="group">
      {playbackError ? <PencilText as="p" className="inkra-image-viewer__video-error" role="alert">{labels.playbackError}</PencilText> : null}
      <Button aria-label={playing ? labels.pause : labels.play} className="inkra-image-viewer__video-play" onClick={() => void togglePlay()} size="icon-sm" variant="outline">
        <PencilIcon decorative paths={playing ? pausePaths : playPaths} size={22} sourceSize={24} />
      </Button>
      <div className="inkra-image-viewer__video-seek">
        <Slider aria-label={labels.seek} disabled={!duration} getValueLabel={value => labels.time(value, duration)}
          max={duration || 0} min={0} onValueChange={values => seek(values[0] ?? 0)} size="sm" step={0.01} value={[currentTime]} variant="inset" />
      </div>
      <PencilText aria-live="off" as="span" className="inkra-image-viewer__video-time" dir="auto">{labels.time(currentTime, duration)}</PencilText>
      <div className="inkra-image-viewer__video-settings">
        <Button aria-label={muted ? labels.unmute : labels.mute} className="inkra-image-viewer__video-mute" onClick={() => setMuted(!muted)} size="icon-sm" variant="ghost">
          <PencilIcon decorative paths={muted ? mutePaths : volumePaths} size={22} sourceSize={24} />
        </Button>
        <div className="inkra-image-viewer__video-volume">
          <Slider aria-label={labels.volume} getValueLabel={value => `${Math.round(value * 100)}%`} max={1} min={0}
            onValueChange={values => setVolume(values[0] ?? 0)} size="sm" step={0.01} value={[muted ? 0 : volume]} variant="inset" />
        </div>
        <Select.Root onValueChange={value => setRate(Number(value))} value={String(playbackRate)}>
          <Select.Trigger aria-label={labels.rate} fullWidth={false} size="sm"><Select.Value /></Select.Trigger>
          <Select.Portal><Select.Content position="popper" sideOffset={4}><Select.Viewport>
            {rates.map(rate => <Select.Item key={rate} value={String(rate)}><Select.ItemText>{`${rate}x`}</Select.ItemText><Select.ItemIndicator /></Select.Item>)}
          </Select.Viewport></Select.Content></Select.Portal>
        </Select.Root>
      </div>
    </div>
  </div>;
}
