export const DEFAULT_COLOR_VALUE = '#4b96aaff';

export interface ColorChannels {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

export type ColorValue = `#${string}`;

const HEX_COLOR = /^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;

function expandHex(value: string): string {
  return value.length <= 4
    ? [...value].map(character => `${character}${character}`).join('')
    : value;
}

export function parseColorValue(input: string): ColorChannels | null {
  const value = input.trim();
  const match = HEX_COLOR.exec(value);
  if (!match) return null;
  const expanded = expandHex(match[1]);
  const opaque = expanded.length === 6;
  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16),
    alpha: opaque ? 255 : Number.parseInt(expanded.slice(6, 8), 16),
  };
}

function channelToHex(channel: number): string {
  return Math.min(255, Math.max(0, Math.round(channel))).toString(16).padStart(2, '0');
}

export function formatColorValue(channels: ColorChannels): ColorValue {
  return `#${channelToHex(channels.red)}${channelToHex(channels.green)}${channelToHex(channels.blue)}${channelToHex(channels.alpha)}`;
}

export function normalizeColorValue(input: string): ColorValue | null {
  const channels = parseColorValue(input);
  return channels ? formatColorValue(channels) : null;
}

export function colorRgbValue(input: string): `#${string}` | null {
  const channels = parseColorValue(input);
  return channels ? `#${channelToHex(channels.red)}${channelToHex(channels.green)}${channelToHex(channels.blue)}` : null;
}

export function colorAlphaPercent(input: string): number {
  const channels = parseColorValue(input) ?? parseColorValue(DEFAULT_COLOR_VALUE)!;
  return Math.round(channels.alpha / 255 * 100);
}

export function withColorAlpha(input: string, percentage: number): ColorValue | null {
  const channels = parseColorValue(input);
  if (!channels) return null;
  return formatColorValue({
    ...channels,
    alpha: Math.round(Math.min(100, Math.max(0, percentage)) / 100 * 255),
  });
}

export function withColorRgb(input: string, rgb: string): ColorValue | null {
  const current = parseColorValue(input);
  const next = parseColorValue(rgb);
  if (!current || !next) return null;
  return formatColorValue({ ...next, alpha: current.alpha });
}
