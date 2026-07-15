#!/bin/bash
# Rebuild the single-file "Bunny Solitaire.html" from index.html + css/ + js/.
# Run after any change to the dev files: ./build.sh
cd "$(dirname "$0")"
python3 - <<'EOF'
import re, pathlib
root = pathlib.Path('.')
html = (root/'index.html').read_text()
css  = (root/'css/styles.css').read_text()
js   = ''.join((root/f'js/{n}.js').read_text() + '\n' for n in ['engine','sprites','game'])
html = html.replace('<link rel="stylesheet" href="css/styles.css" />', '<style>\n'+css+'\n</style>')
html = re.sub(r'  <script src="js/engine\.js"></script>\n  <script src="js/sprites\.js"></script>\n  <script src="js/game\.js"></script>', '<script>\n'+js+'\n</script>', html)
assert 'src="js/' not in html and 'css/styles' not in html, 'inlining failed'
(root/'Bunny Solitaire.html').write_text(html)
print('rebuilt Bunny Solitaire.html:', (root/'Bunny Solitaire.html').stat().st_size, 'bytes')
EOF
