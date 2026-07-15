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
# index.html carries a ?v=N cache-buster on these tags (bump it on every
# deploy — GitHub Pages/browsers cache css/js for 10 min, so without a
# version bump players can be stuck on stale styles/scripts after a push).
# The regex tolerates that suffix so build.sh keeps working regardless of N.
html = re.sub(r'<link rel="stylesheet" href="css/styles\.css(\?v=\d+)?" />', '<style>\n'+css+'\n</style>', html)
html = re.sub(r'  <script src="js/engine\.js(\?v=\d+)?"></script>\n  <script src="js/sprites\.js(\?v=\d+)?"></script>\n  <script src="js/game\.js(\?v=\d+)?"></script>', '<script>\n'+js+'\n</script>', html)
assert 'src="js/' not in html and 'css/styles' not in html, 'inlining failed'
(root/'Bunny Solitaire.html').write_text(html)
print('rebuilt Bunny Solitaire.html:', (root/'Bunny Solitaire.html').stat().st_size, 'bytes')
EOF
