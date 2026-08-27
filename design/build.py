#!/usr/bin/env python3
"""Assemble .dc.html artboards from _shell.css + *.body.html fragments."""
import pathlib, sys
here = pathlib.Path(__file__).parent
css = (here / "_shell.css").read_text()
TPL = """<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
%s
%s
  </style>
</helmet>
%s
</x-dc>
</body>
</html>
"""

import re
NAV_ITEMS = [
    ("dashboard",   "Dashboard",   "M3 12h7V3H3v9Zm11 9h7v-9h-7v9ZM3 21h7v-6H3v6Zm11-12h7V3h-7v6Z"),
    ("timesheet",   "Timesheet",   "M7 3v3m10-3v3M3.5 9.5h17M4.5 5.5h15v15h-15z"),
    ("talent",      "Talent",      "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8a8 8 0 0 1 16 0"),
    ("workload",    "Workload",    "M4 20V9m5 11V4m5 16v-7m5 7V7"),
    ("feasibility", "Feasibility", "M12 3 3 8v8l9 5 9-5V8l-9-5Zm0 5v9"),
    ("budget",      "Budget",      "M3 7h18v12H3zM3 11h18M7 15h4"),
]
def sidebar(active, hide):
    rows = []
    for key, label, d in NAV_ITEMS:
        if key in hide: continue
        cls = ' class="on"' if key == active else ""
        rows.append(
            f'      <a href="#"{cls}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" '
            f'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" '
            f'aria-hidden="true"><path d="{d}"></path></svg>{label}</a>')
    admin = ""
    if "admin" not in hide:
        on = ' class="on"' if active == "admin" else ""
        admin = ('\n      <div class="sep"></div>\n'
                 f'      <a href="#"{on}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" '
                 'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">'
                 '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3m0 14v3M2 12h3m14 0h3"></path>'
                 '</svg>Admin</a>')
    return ('  <aside class="side">\n'
            '    <div class="brand">\n'
            '      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
            '<rect x="2" y="2" width="20" height="20" rx="5" fill="#e4002b"></rect>'
            '<path d="M7 8.5h10M12 8.5V16" stroke="#fff" stroke-width="1.9" stroke-linecap="round"></path></svg>\n'
            '      <b>TANIA</b>\n'
            '    </div>\n'
            '    <nav class="nav">\n' + "\n".join(rows) + admin + '\n    </nav>\n  </aside>')
def expand_nav(text):
    def rep(m):
        active = re.search(r'active="([^"]*)"', m.group(0)).group(1)
        hm = re.search(r'hide="([^"]*)"', m.group(0))
        return sidebar(active, set(hm.group(1).split()) if hm else set())
    return re.sub(r'<!--NAV [^>]*-->', rep, text)

n = 0
for frag in sorted(here.glob("*.body.html")):
    name = frag.name.replace(".body.html", "")
    extra_p = here / f"{name}.css"
    extra = extra_p.read_text() if extra_p.exists() else ""
    out = here / f"{name}.dc.html"
    out.write_text(TPL % (css, extra, expand_nav(frag.read_text().rstrip())))
    print(f"  {out.name}  ({out.stat().st_size:,} bytes)")
    n += 1
print(f"{n} artboards built")
