import { useInkraLocale, type InkraTranslate } from '../i18n/index.js';
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import type { AudioHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { Button } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { SelectRoot, SelectTrigger, SelectValue, SelectPortal, SelectContent, SelectViewport, SelectItem, SelectItemText, SelectItemIndicator } from '../select/Select.js';
import { Slider } from '../slider/index.js';

const pausePaths = [
  { d: 'M 15 3 H 18 A 1 1 0 0 1 19 4 V 20 A 1 1 0 0 1 18 21 H 15 A 1 1 0 0 1 14 20 V 4 A 1 1 0 0 1 15 3 Z' },
  { d: 'M 6 3 H 9 A 1 1 0 0 1 10 4 V 20 A 1 1 0 0 1 9 21 H 6 A 1 1 0 0 1 5 20 V 4 A 1 1 0 0 1 6 3 Z' },
] as const;
const playPaths = [{ d: 'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z' }] as const;
const volumePaths = [
  { d: 'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z' },
  { d: 'M16 9a5 5 0 0 1 0 6' },
  { d: 'M19.364 18.364a9 9 0 0 0 0-12.728' },
] as const;
const mutePaths = [
  { d: 'M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z' },
  { d: 'm16.5 14.5 5-5' },
  { d: 'm16.5 9.5 5 5' },
] as const;

export type AudioPlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'blocked' | 'error';

export interface AudioPlayerState {
  status: AudioPlayerStatus;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  canPlay: boolean;
  error: MediaError | null;
}

export interface AudioPlayerControls {
  audio: HTMLAudioElement | null;
  state: AudioPlayerState;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  focus: () => void;
}

export interface AudioPlayerLabels {
  controls?: string;
  audio?: string;
  play?: string;
  pause?: string;
  mute?: string;
  unmute?: string;
  seek?: string;
  volume?: string;
  rate?: string;
  loading?: string;
  blocked?: string;
  error?: string;
  time?: (current: number, duration: number) => string;
}

export interface AudioPlayerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onError' | 'onChange' | 'onVolumeChange'> {
  src?: string;
  preload?: AudioHTMLAttributes<HTMLAudioElement>['preload'];
  autoPlay?: boolean;
  crossOrigin?: AudioHTMLAttributes<HTMLAudioElement>['crossOrigin'];
  defaultVolume?: number;
  volume?: number;
  defaultMuted?: boolean;
  muted?: boolean;
  defaultPlaybackRate?: number;
  playbackRate?: number;
  onVolumeChange?: (volume: number) => void;
  onMutedChange?: (muted: boolean) => void;
  onPlaybackRateChange?: (rate: number) => void;
  onTimeChange?: (currentTime: number) => void;
  onStateChange?: (state: AudioPlayerState) => void;
  onError?: (error: MediaError | DOMException | null) => void;
  labels?: AudioPlayerLabels;
  renderControls?: (controls: AudioPlayerControls) => ReactNode;
  audioProps?: Omit<AudioHTMLAttributes<HTMLAudioElement>, 'src' | 'controls' | 'autoPlay' | 'preload' | 'volume' | 'muted' | 'playbackRate' | 'onError'>;
}

const DEFAULT_LABELS = (t: InkraTranslate): Required<Omit<AudioPlayerLabels, 'time'>> => ({
  controls: t('audio.controls'), audio: t('audio.label'), play: t('audio.play'), pause: t('audio.pause'), mute: t('audio.mute'), unmute: t('audio.unmute'), seek: t('audio.seek'), volume: t('audio.volume'), rate: t('audio.rate'), loading: t('audio.loading'), blocked: t('audio.blocked'), error: t('audio.error'),
});

const rates = [0.75, 1, 1.25, 1.5, 2];

function clamp(value: number, min: number, max: number) { return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min; }
function formatTime(value: number) { if (!Number.isFinite(value) || value < 0) return '0:00'; const seconds = Math.floor(value); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }

export const AudioPlayer = forwardRef<AudioPlayerControls, AudioPlayerProps>(function AudioPlayer(
  { src, preload = 'metadata', autoPlay = false, crossOrigin, className, defaultMuted = false, defaultPlaybackRate = 1, defaultVolume = 1, volume, muted, playbackRate, onVolumeChange, onMutedChange, onPlaybackRateChange, onTimeChange, onStateChange, onError, labels, renderControls, audioProps, ...props },
  forwardedRef,
) {
  const { t } = useInkraLocale();
  const id = useId();
  const audioRef = useRef<HTMLAudioElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const sourceVersionRef = useRef(0);
  const requestedSourceRef = useRef(src);
  requestedSourceRef.current = src;
  const [state, setState] = useState<AudioPlayerState>({ status: src ? 'loading' : 'idle', currentTime: 0, duration: 0, buffered: 0, volume: clamp(volume ?? defaultVolume, 0, 1), muted: muted ?? defaultMuted, playbackRate: clamp(playbackRate ?? defaultPlaybackRate, 0.25, 4), canPlay: false, error: null });
  const stateRef = useRef(state);
  stateRef.current = state;
  const controlledRef = useRef({ volume, muted, playbackRate });
  controlledRef.current = { volume, muted, playbackRate };
  const callbacksRef = useRef({ onVolumeChange, onMutedChange, onPlaybackRateChange, onTimeChange, onStateChange, onError });
  callbacksRef.current = { onVolumeChange, onMutedChange, onPlaybackRateChange, onTimeChange, onStateChange, onError };
  const mergedLabels = { ...DEFAULT_LABELS(t), ...labels };
  const update = useCallback((patch: Partial<AudioPlayerState>) => {
    const current = stateRef.current;
    const changed = (Object.keys(patch) as (keyof AudioPlayerState)[]).some(key => !Object.is(current[key], patch[key]));
    const next = changed ? { ...current, ...patch } : current;
    if (changed) {
      stateRef.current = next;
      setState(next);
    }
    // Native events remain observable without rendering identical media snapshots.
    callbacksRef.current.onStateChange?.(next);
  }, []);
  const sync = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const buffered = audio.duration > 0 && audio.buffered.length ? audio.buffered.end(audio.buffered.length - 1) / audio.duration : 0;
    update({ currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0, duration: Number.isFinite(audio.duration) ? audio.duration : 0, buffered: clamp(buffered, 0, 1), volume: audio.volume, muted: audio.muted, playbackRate: audio.playbackRate, canPlay: audio.readyState >= 3 });
  }, [update]);
  const applyControlledSettings = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const controlled = controlledRef.current;
    if (controlled.volume !== undefined) {
      const value = clamp(controlled.volume, 0, 1);
      if (audio.volume !== value) audio.volume = value;
    }
    if (controlled.muted !== undefined && audio.muted !== controlled.muted) audio.muted = controlled.muted;
    if (controlled.playbackRate !== undefined) {
      const value = clamp(controlled.playbackRate, 0.25, 4);
      if (audio.defaultPlaybackRate !== value) audio.defaultPlaybackRate = value;
      if (audio.playbackRate !== value) audio.playbackRate = value;
    }
  }, []);
  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    const sourceVersion = sourceVersionRef.current;
    try {
      await audio.play();
    } catch (error) {
      // Loading another source or unmounting can reject an earlier play request.
      if (audioRef.current !== audio || sourceVersionRef.current !== sourceVersion) return;
      update({ status: 'blocked' });
      callbacksRef.current.onError?.(error instanceof DOMException ? error : null);
    }
  }, [update]);
  const pause = useCallback(() => { audioRef.current?.pause(); }, []);
  const togglePlay = useCallback(async () => { const audio = audioRef.current; if (!audio) return; if (audio.paused) await play(); else pause(); }, [pause, play]);
  const seek = useCallback((time: number) => { const audio = audioRef.current; if (!audio || !Number.isFinite(time)) return; audio.currentTime = clamp(time, 0, Number.isFinite(audio.duration) ? audio.duration : Math.max(0, time)); sync(); callbacksRef.current.onTimeChange?.(audio.currentTime); }, [sync]);
  const setVolume = useCallback((next: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const value = clamp(next, 0, 1);
    const current = controlledRef.current.volume ?? stateRef.current.volume;
    if (value === current) return;
    if (controlledRef.current.volume === undefined) { audio.volume = value; sync(); }
    callbacksRef.current.onVolumeChange?.(value);
  }, [sync]);
  const setMuted = useCallback((next: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    const current = controlledRef.current.muted ?? stateRef.current.muted;
    if (next === current) return;
    if (controlledRef.current.muted === undefined) { audio.muted = next; sync(); }
    callbacksRef.current.onMutedChange?.(next);
  }, [sync]);
  const setPlaybackRate = useCallback((next: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const value = clamp(next, 0.25, 4);
    const current = controlledRef.current.playbackRate ?? stateRef.current.playbackRate;
    if (value === current) return;
    if (controlledRef.current.playbackRate === undefined) { audio.defaultPlaybackRate = value; audio.playbackRate = value; sync(); }
    callbacksRef.current.onPlaybackRateChange?.(value);
  }, [sync]);
  const focus = useCallback(() => { rootRef.current?.querySelector<HTMLElement>('[data-audio-player-control]')?.focus(); }, []);
  const controls: AudioPlayerControls = { audio: audioRef.current, state, play, pause, togglePlay, seek, setVolume, setMuted, setPlaybackRate, focus };
  useImperativeHandle(forwardedRef, () => controls, [state, play, pause, togglePlay, seek, setVolume, setMuted, setPlaybackRate, focus]);

  useEffect(() => {
    sourceVersionRef.current += 1;
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    try { audio.currentTime = 0; } catch { /* Empty media has no seekable timeline. */ }
    if (!src) audio.removeAttribute('src');
    update({ status: src ? 'loading' : 'idle', currentTime: 0, duration: 0, buffered: 0, canPlay: false, error: null });
    const current = stateRef.current;
    audio.volume = clamp(controlledRef.current.volume ?? current.volume, 0, 1);
    audio.muted = controlledRef.current.muted ?? current.muted;
    const rate = clamp(controlledRef.current.playbackRate ?? current.playbackRate, 0.25, 4);
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
    audio.load();
  }, [src, update]);
  useEffect(() => { applyControlledSettings(); sync(); }, [applyControlledSettings, muted, playbackRate, sync, volume]);
  useEffect(() => { const audio = audioRef.current; if (!audio) return; const hasSource = () => Boolean(requestedSourceRef.current || audio.getAttribute('src')); const handlers: Partial<Record<keyof HTMLMediaElementEventMap, EventListener>> = {
    loadstart: () => update({ status: hasSource() ? 'loading' : 'idle', error: null, canPlay: false }), loadedmetadata: () => { applyControlledSettings(); sync(); update({ status: 'ready' }); }, canplay: () => { sync(); update({ canPlay: true, status: audio.paused ? 'paused' : 'playing' }); }, play: () => update({ status: 'playing' }), pause: () => update({ status: hasSource() ? (audio.ended ? 'ended' : 'paused') : 'idle' }), playing: () => update({ status: 'playing', canPlay: true }), waiting: () => update({ status: 'buffering' }), progress: sync, timeupdate: () => { sync(); callbacksRef.current.onTimeChange?.(audio.currentTime); }, ratechange: () => { const previous = stateRef.current.playbackRate; applyControlledSettings(); sync(); if (controlledRef.current.playbackRate === undefined && previous !== audio.playbackRate) callbacksRef.current.onPlaybackRateChange?.(audio.playbackRate); }, volumechange: () => { const previous = stateRef.current; applyControlledSettings(); sync(); if (controlledRef.current.volume === undefined && previous.volume !== audio.volume) callbacksRef.current.onVolumeChange?.(audio.volume); if (controlledRef.current.muted === undefined && previous.muted !== audio.muted) callbacksRef.current.onMutedChange?.(audio.muted); }, ended: () => update({ status: 'ended', currentTime: audio.duration || audio.currentTime }), error: () => { if (!hasSource()) { update({ status: 'idle', error: null, canPlay: false }); return; } const error = audio.error; update({ status: 'error', error }); callbacksRef.current.onError?.(error); }, abort: () => update({ status: 'idle' }), emptied: () => { if (!hasSource()) update({ status: 'idle', currentTime: 0, duration: 0, buffered: 0, canPlay: false, error: null }); }, };
    Object.entries(handlers).forEach(([name, handler]) => audio.addEventListener(name, handler!));
    return () => Object.entries(handlers).forEach(([name, handler]) => audio.removeEventListener(name, handler!));
  }, [applyControlledSettings, sync, update]);

  const playLabel = state.status === 'playing' ? mergedLabels.pause : mergedLabels.play;
  const defaultControls = <div className="inkra-audio-player__controls" role="group" aria-label={mergedLabels.controls}>
    <Button data-audio-player-control data-tooltip={playLabel} type="button" size="icon-sm" variant="outline" aria-label={playLabel} onClick={() => void togglePlay()}><PencilIcon paths={state.status === 'playing' ? pausePaths : playPaths} size={20} sourceSize={24} /></Button>
    <div className="inkra-audio-player__seek"><Slider data-audio-player-control min={0} max={state.duration || 0} step={0.01} value={[state.currentTime]} onValueChange={values => seek(values[0] ?? 0)} disabled={!state.duration} aria-label={mergedLabels.seek} getValueLabel={value => labels?.time?.(value, state.duration) ?? `${formatTime(value)} / ${formatTime(state.duration)}`} size="sm" variant="inset" /></div>
    <PencilText as="span" className="inkra-audio-player__time" aria-live="off">{labels?.time?.(state.currentTime, state.duration) ?? `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`}</PencilText>
    <div className="inkra-audio-player__settings">
      <Button data-audio-player-control data-tooltip={state.muted ? mergedLabels.unmute : mergedLabels.mute} type="button" size="icon-sm" variant="ghost" aria-label={state.muted ? mergedLabels.unmute : mergedLabels.mute} onClick={() => setMuted(!state.muted)}><PencilIcon paths={state.muted ? mutePaths : volumePaths} size={20} sourceSize={24} /></Button>
      <div className="inkra-audio-player__volume"><Slider data-audio-player-control min={0} max={1} step={0.01} value={[state.muted ? 0 : state.volume]} onValueChange={values => { setMuted(false); setVolume(values[0] ?? 0); }} aria-label={mergedLabels.volume} getValueLabel={value => `${Math.round(value * 100)}%`} size="sm" variant="inset" /></div>
      <SelectRoot value={String(state.playbackRate)} onValueChange={value => setPlaybackRate(Number(value))}>
        <SelectTrigger data-audio-player-control aria-label={mergedLabels.rate} fullWidth={false} size="sm"><SelectValue /></SelectTrigger>
        <SelectPortal><SelectContent position="popper" sideOffset={4}><SelectViewport>{rates.map(rate => <SelectItem key={rate} value={String(rate)}><SelectItemText>{`${rate}x`}</SelectItemText><SelectItemIndicator /></SelectItem>)}</SelectViewport></SelectContent></SelectPortal>
      </SelectRoot>
    </div>
  </div>;
  return <PencilSurface ref={rootRef} {...props} className={['inkra-audio-player', className].filter(Boolean).join(' ')} variant="paper" radius={8} data-status={state.status} data-audio-player-id={id}>
    <audio {...audioProps} ref={audioRef} aria-label={audioProps?.['aria-label'] ?? mergedLabels.audio} autoPlay={autoPlay} crossOrigin={crossOrigin} muted={state.muted} preload={preload} src={src} />
    {state.status === 'blocked' && <PencilText as="p" className="inkra-audio-player__message" role="status">{mergedLabels.blocked}</PencilText>}
    {state.status === 'error' && <PencilText as="p" className="inkra-audio-player__message" role="alert">{mergedLabels.error}</PencilText>}
    {renderControls ? renderControls(controls) : defaultControls}
  </PencilSurface>;
});

