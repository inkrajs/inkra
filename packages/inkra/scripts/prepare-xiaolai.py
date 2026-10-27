"""Rebuild the bundled font from Xiaolai SC v3.120 (fonttools + brotli).

Usage: python prepare-xiaolai.py /path/to/XiaolaiSC-Regular.ttf
Retains every mapped character; uncommon characters load a separate WOFF2.
"""
from pathlib import Path
import sys
from fontTools import subset
from fontTools.ttLib import TTFont

source = Path(sys.argv[1])
destination = Path(__file__).resolve().parent.parent / 'src/assets'
all_chars = set(TTFont(source).getBestCmap())
common = set(range(0x250)) | set(range(0x2000, 0x2070)) | set(range(0x3000, 0x3040)) | set(range(0xff00, 0xfff0))
for lead in range(0xa1, 0xf8):
    for trail in range(0xa1, 0xff):
        try:
            common.add(ord(bytes([lead, trail]).decode('gb2312')))
        except UnicodeDecodeError:
            pass
common &= all_chars
extended = all_chars - common
def ranges(chars):
    groups = []
    for value in sorted(chars):
        if groups and value == groups[-1][1] + 1:
            groups[-1][1] = value
        else:
            groups.append([value, value])
    return ','.join('U+%X' % a if a == b else 'U+%X-%X' % (a, b) for a, b in groups)
faces = []
for suffix, chars in [('', common), ('-extended', extended)]:
    font = TTFont(source)
    options = subset.Options()
    options.layout_features = ['*']
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=chars)
    subsetter.subset(font)
    font.flavor = 'woff2'
    name = 'ui-hand-xiaolai' + suffix + '.woff2'
    font.save(destination / name)
    faces.append('@font-face {\n  font-family: "Inkra Xiaolai";\n  font-style: normal;\n  font-weight: 400;\n  font-display: swap;\n  src: url("./' + name + '") format("woff2");\n  unicode-range: ' + ranges(chars) + ';\n}')
    print(name, len(chars), (destination / name).stat().st_size, flush=True)
(destination / 'xiaolai.css').write_text('\n\n'.join(faces) + '\n')
