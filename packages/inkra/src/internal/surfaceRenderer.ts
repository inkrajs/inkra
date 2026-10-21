import { pencilPaper } from './paper.js';
import { pencilStroke } from './stroke.js';
import { drawPencilWash } from './wash.js';

export type PencilSurfaceVariant =
  | 'paper'
  | 'action'
  | 'quiet'
  | 'badge'
  | 'outline'
  | 'danger'
  | 'ghost'
  | 'selection'
  | 'wash'
  | 'full';

export interface PencilSurfaceTheme {
  paper: string;
  dark: boolean;
  ink: string;
  wash: string;
}

interface SurfaceStyle {
  radius: number;
  width: number;
  passes: number;
  strength?: number;
  themeStrength?: {
    light: number;
    dark: number;
  };
}

export const PENCIL_ACTION_WASH = Object.freeze({
  lightStrength: 0.2,
  darkStrength: 0.12,
});

export const PENCIL_QUIET_WASH = Object.freeze({
  lightStrength: 0.12,
  darkStrength: 0.08,
});

const surfaceStyles: Record<'paper' | 'action' | 'quiet' | 'badge' | 'outline' | 'danger', SurfaceStyle> = {
  paper: { radius: 8, width: 1.2, passes: 3 },
  action: {
    radius: 7,
    width: 1.35,
    passes: 3,
    themeStrength: { light: PENCIL_ACTION_WASH.lightStrength, dark: PENCIL_ACTION_WASH.darkStrength },
  },
  quiet: {
    radius: 7,
    width: 0.75,
    passes: 2,
    themeStrength: { light: PENCIL_QUIET_WASH.lightStrength, dark: PENCIL_QUIET_WASH.darkStrength },
  },
  badge: { radius: 6, width: 0.9, passes: 2, strength: 0.25 },
  outline: { radius: 7, width: 1.2, passes: 3 },
  danger: { radius: 7, width: 0.75, passes: 2, strength: 0.18 },
};

export const PENCIL_FILL_WASH = Object.freeze({
  angle: -35,
  spacing: 1.8,
  roughness: 3.5,
  inset: 2,
  edgeReach: 0,
});

export const PENCIL_SELECTION_WASH = Object.freeze({
  ...PENCIL_FILL_WASH,
  lightStrength: PENCIL_ACTION_WASH.lightStrength,
  darkStrength: PENCIL_ACTION_WASH.darkStrength,
  radius: 8,
});

function outline(width: number, height: number, radius: number, seed: number) {
  const left = 2.5;
  const top = 2.5;
  const right = width - 2.5;
  const bottom = height - 2.5;
  const points: Array<readonly [number, number]> = [];

  for (let corner = 0; corner < 4; corner += 1) {
    const variation = radius === 0 ? 0 : ((seed >>> (corner * 4)) & 7) * 0.12;
    const resolvedRadius = Math.min(radius + variation, (right - left) / 2, (bottom - top) / 2);
    const centerX = corner < 2 ? right - resolvedRadius : left + resolvedRadius;
    const centerY = corner === 0 || corner === 3 ? top + resolvedRadius : bottom - resolvedRadius;
    for (let step = 0; step <= 6; step += 1) {
      const angle = (corner - 1 + step / 6) * Math.PI / 2;
      points.push([
        centerX + Math.cos(angle) * resolvedRadius,
        centerY + Math.sin(angle) * resolvedRadius,
      ]);
    }
  }

  return points;
}

function paperPattern(
  context: CanvasRenderingContext2D,
  color: string,
  dark: boolean,
  dpr: number,
): CanvasPattern | string {
  const pattern = context.createPattern(pencilPaper(color, dark, dpr), 'repeat');
  if (!pattern) return color;
  if (typeof pattern.setTransform === 'function' && typeof DOMMatrix !== 'undefined') {
    pattern.setTransform(new DOMMatrix().scale(1 / dpr));
  }
  return pattern;
}

export function drawPencilSurface(
  canvas: HTMLCanvasElement,
  borderCanvas: HTMLCanvasElement | null,
  width: number,
  height: number,
  variant: PencilSurfaceVariant,
  seed: number,
  dpr: number,
  theme: PencilSurfaceTheme,
  radius?: number,
): Array<readonly [number, number]> | undefined {
  const bleed = variant === 'wash' ? 12 : 0;
  canvas.width = Math.ceil((width + bleed * 2) * dpr);
  canvas.height = Math.ceil((height + bleed * 2) * dpr);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  context.setTransform(
    canvas.width / (width + bleed * 2),
    0,
    0,
    canvas.height / (height + bleed * 2),
    0,
    0,
  );

  if (variant === 'wash') {
    if (borderCanvas) {
      borderCanvas.width = canvas.width;
      borderCanvas.height = canvas.height;
    }
    context.translate(bleed, bleed);
    drawPencilWash(context, { x: 0, y: 0, width, height }, theme.wash, seed, {
      strength: 1,
      spacing: 1.8,
      roughness: 3.5,
      inset: 2,
      radius: 8,
      edgeReach: 8,
      dpr,
    });
    return undefined;
  }

  if (variant === 'selection') {
    if (borderCanvas) {
      borderCanvas.width = canvas.width;
      borderCanvas.height = canvas.height;
    }
    drawPencilWash(context, { x: 0, y: 0, width, height }, theme.wash, seed, {
      strength: theme.dark ? PENCIL_SELECTION_WASH.darkStrength : PENCIL_SELECTION_WASH.lightStrength,
      spacing: PENCIL_SELECTION_WASH.spacing,
      roughness: PENCIL_SELECTION_WASH.roughness,
      inset: PENCIL_SELECTION_WASH.inset,
      radius: PENCIL_SELECTION_WASH.radius,
      edgeReach: PENCIL_SELECTION_WASH.edgeReach,
      angle: PENCIL_SELECTION_WASH.angle,
      dpr,
    });
    return undefined;
  }

  if (variant === 'ghost') {
    if (borderCanvas) {
      borderCanvas.width = canvas.width;
      borderCanvas.height = canvas.height;
    }
    return undefined;
  }

  if (variant === 'full') {
    if (borderCanvas) {
      borderCanvas.width = canvas.width;
      borderCanvas.height = canvas.height;
    }
    context.fillStyle = paperPattern(context, theme.paper, theme.dark, dpr);
    context.fillRect(0, 0, width, height);
    return undefined;
  }

  const style = surfaceStyles[variant];
  const strength = style.themeStrength
    ? (theme.dark ? style.themeStrength.dark : style.themeStrength.light)
    : style.strength;
  const resolvedRadius = radius !== undefined && Number.isFinite(radius) ? Math.max(0, Math.min(radius, 8)) : style.radius;
  const points = outline(width, height, resolvedRadius, seed);
  if (variant !== 'outline') {
    context.save();
    context.beginPath();
    context.moveTo(...points[0]);
    for (const point of points.slice(1)) context.lineTo(...point);
    context.closePath();
    context.clip();
    context.fillStyle = paperPattern(context, theme.paper, theme.dark, dpr);
    context.fillRect(0, 0, width, height);

    if (strength) {
      drawPencilWash(context, { x: 0, y: 0, width, height }, theme.wash, seed, {
        ...PENCIL_FILL_WASH,
        strength,
        radius: resolvedRadius,
        dpr,
      });
    }
    context.restore();
  }

  let borderContext = context;
  if (borderCanvas) {
    borderCanvas.width = canvas.width;
    borderCanvas.height = canvas.height;
    const separateContext = borderCanvas.getContext('2d');
    if (separateContext) {
      separateContext.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      borderContext = separateContext;
    }
  }
  pencilStroke(borderContext, points, theme.ink, style.width, seed, 0.6, style.passes, true, {
    variation: 0.82,
    breaks: variant === 'paper' ? 0.2 : 0.25,
    grain: 0.7,
    gain: variant === 'action' ? 2.5 : 2.1,
    step: 0.8,
  });
  return points;
}
