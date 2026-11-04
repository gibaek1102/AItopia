# AItopia (static site)

- `index.html` — English version (for the Midjiwan pre-release). `index_ko.html` — Korean version.
- Each file is the whole game (no server). The Solaris weights are embedded in the page.
- Deploy: put this folder on GitHub Pages / Cloudflare Pages / Vercel. `CNAME` already says aitopia.ericlee.dev; the domain admin adds a CNAME for `aitopia` in the DNS of ericlee.dev.

## Rebuild from a new Terranion/Jupiter HTML
    python3 tools/build.py new_build.html out_dir
It removes the fan/marble tribes, adds Pass & Play, the "not official" notice, the AItopia name and the embedded Solaris, then writes `out_dir/index.html` (EN) and `out_dir/index_ko.html` (KO).
Strings that are new in the source need an entry in `tools/tr_dict.json` (the build stops and lists them).
New Solaris weights: replace `tools/solaris_net.json` and rebuild.

## Checks (need playwright)
    node tools/replay_cmp.js $(pwd)/index.html 11 18 crazy   # same seed, all 16 tribes: compare the digest with the original build
    UI=en node tools/test_pp.js $(pwd)/index.html             # Pass & Play, 3 humans + 1 bot
    UI=en node tools/test2.js   $(pwd)/index.html             # single-player regression, reload, win/loss rules
    UI=en node tools/test_sol2.js $(pwd)/index.html 6 crazy   # Solaris plays real games
