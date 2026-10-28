import { PencilText } from '../PencilText.js';
import { sampleMorphGlyph } from './morph-motion.js';
import type { MorphMotion } from './morph-motion.js';
import type { RollingToken } from './rolling.js';

export function MorphValue({ tokens, motion, progress }: {
  tokens: RollingToken[];
  motion: MorphMotion | null;
  progress: number;
}) {
  return <span className="inkra-number-ticker__morph" dir="ltr" data-transition={motion?.kind ?? 'idle'}
    style={motion ? { width: `${progress >= 1 ? motion.targetWidth : motion.width}ch` } : undefined}>
    {motion ? motion.glyphs.filter(glyph => progress < 1 || glyph.target).map(glyph => {
      const state = sampleMorphGlyph(glyph, progress);
      return <span key={glyph.id} className="inkra-number-ticker__morph-glyph" data-token-id={glyph.id}
        data-place={glyph.referenceKey} data-digit={glyph.digit || undefined} data-face={glyph.target ? 'to' : 'from'}
        style={{ position: 'absolute', left: '100%', width: `${glyph.width}ch`,
          transform: `translate(${state.x / glyph.width * 100}%, ${state.y * 100}%)`, opacity: state.opacity }}>
        <PencilText seed={`ticker-${glyph.id}-${glyph.text}`}>{glyph.text}</PencilText>
      </span>;
    }) : tokens.map(token => <span key={`settled-${token.key}`} className="inkra-number-ticker__morph-glyph"
      data-token-id={`settled-${token.key}`} data-place={token.key} data-digit={token.digit || undefined} data-face="to"
      style={token.digit ? { width: '1ch' } : undefined}>
      <PencilText seed={`ticker-settled-${token.key}-${token.text}`}>{token.text}</PencilText>
    </span>)}
  </span>;
}
