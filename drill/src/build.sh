#!/bin/sh
# Build publish.html: head + app div + each js in its own script tag
cd "$(dirname "$0")"
{ cat head.html; echo '<div class="wrap" id="app"></div>'; if [ -f evidence-links.json ]; then echo '<script>window.DrillEvidenceLinks='; cat evidence-links.json; echo '</script>'; fi; for f in "$@"; do echo '<script>'; cat "$f"; echo; echo '</script>'; done; } > publish.html
