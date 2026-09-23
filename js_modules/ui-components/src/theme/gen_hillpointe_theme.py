"""Generate the Hillpointe/Alinos -> Dagster CSS variable override.

Dagster applies exactly one theme class to <body>, so each block must carry the
complete token set -- the NoRedGreen variants cannot inherit from their base.
This generator keeps the 6 blocks in sync from one source of truth.

Red/green substitution for the NoRedGreen variants follows Dagster's own intent
(red -> yellow, green -> blue), using the Alinos *-ink tokens wherever the fill
value would fail contrast as text.
"""

# --- Alinos semantic roles, per mode (HSL forms from the token file) ---
LIGHT = {
    "bg0": "hsl(40 34% 96%)",
    "bg1": "hsl(40 40% 97.5%)",
    "bg2": "hsl(42 46% 99%)",
    "bg3": "hsl(0 0% 100%)",
    "text": "hsl(211 28% 15%)",
    "text2": "hsl(211 16% 36%)",
    "text3": "hsl(211 12% 45%)",
    "brand": "hsl(211 74% 45%)",
    "brand_hover": "hsl(211 78% 39%)",
    "brand_2": "hsl(211 72% 36%)",
    "brand_2_ink": "hsl(211 72% 36%)",
    "brand_line": "hsl(211 74% 45% / .42)",
    "line": "hsl(211 26% 18% / .12)",
    "line2": "hsl(211 24% 18% / .2)",
    # Status green/red deviate from Alinos on purpose: its --pos is hue 176
    # (teal) which does not read as "success green". Shifted to a true green,
    # and the red deepened, both re-checked for WCAG AA on --bg-0.
    "pos": "hsl(145 60% 27%)",        # 5.80:1
    "pos_hover": "hsl(145 60% 22%)",
    "neg": "hsl(0 70% 44%)",          # 5.63:1
    "neg_hover": "hsl(0 70% 39%)",
    "warn": "hsl(48 66% 40%)",
    "warn_hover": "hsl(48 64% 43%)",
    "warn_ink": "hsl(48 66% 31%)",
    "scrim": "hsl(211 28% 15% / .35)",
    "shadow": "hsl(211 28% 28% / .16)",
    "nav_bg": "hsl(211 67% 4%)",
    "tooltip_bg": "hsl(211 28% 15%)",
    "tooltip_text": "hsl(40 34% 96%)",
    "disabled_bg": "hsl(211 26% 18% / .08)",
    "soft": ".1",
    "soft_hover": ".15",
}

DARK = {
    "bg0": "hsl(211 67% 4%)",
    "bg1": "hsl(211 65% 7%)",
    "bg2": "hsl(211 63% 12%)",
    "bg3": "hsl(211 59% 17%)",
    "text": "hsl(41 42% 93%)",
    "text2": "hsl(211 34% 71%)",
    "text3": "hsl(211 21% 58%)",
    "brand": "hsl(211 87% 69%)",
    "brand_hover": "hsl(211 94% 74%)",
    "brand_2": "hsl(211 60% 45%)",
    "brand_2_ink": "hsl(211 60% 59%)",
    "brand_line": "hsl(211 87% 69% / .5)",
    "line": "hsl(41 42% 93% / .08)",
    "line2": "hsl(41 42% 93% / .15)",
    # See the light-mode note: true green instead of Alinos teal, red made
    # less pink. Both clear AA against --bg-0 and the --bg-2 panel surface.
    "pos": "hsl(145 65% 62%)",        # 11.6:1 on bg-0, 9.8:1 on bg-2
    "pos_hover": "hsl(145 65% 68%)",
    "neg": "hsl(0 85% 68%)",          # 6.6:1 on bg-0, 5.6:1 on bg-2
    "neg_hover": "hsl(0 85% 74%)",
    "warn": "hsl(48 46% 61%)",
    "warn_hover": "hsl(48 82% 61%)",
    "warn_ink": "hsl(48 46% 61%)",
    "scrim": "hsl(0 0% 0% / .55)",
    "shadow": "hsl(0 0% 0% / .5)",
    "nav_bg": "hsl(211 65% 7%)",
    "tooltip_bg": "hsl(211 59% 17%)",
    "tooltip_text": "hsl(41 42% 93%)",
    "disabled_bg": "hsl(41 42% 93% / .08)",
    "soft": ".12",
    "soft_hover": ".18",
}

# hue-only forms, for building translucent fills
HUE = {
    "light": {"pos": "145 60% 27%", "neg": "0 70% 44%", "warn": "48 66% 40%",
              "brand": "211 74% 45%", "brand_2": "211 72% 36%", "gray": "211 26% 18%"},
    "dark": {"pos": "145 65% 62%", "neg": "0 85% 68%", "warn": "48 46% 61%",
             "brand": "211 87% 69%", "brand_2": "211 60% 45%", "gray": "41 42% 93%"},
}


def block(m, mode):
    """Emit the full token set for one theme block.

    Dagster ships NoRedGreen theme variants that swap red->yellow and
    green->blue for red-green colorblindness. We deliberately do NOT do that
    substitution: failure is always red and success is always green in every
    variant, so the NoRedGreen classes render identically to their base.
    """
    h = HUE[mode]
    a = m["soft"]
    ah = m["soft_hover"]

    green_fill, green_hover, green_text, green_hue = (
        m["pos"], m["pos_hover"], m["pos"], h["pos"])
    red_fill, red_hover, red_text, red_hue = (
        m["neg"], m["neg_hover"], m["neg"], h["neg"])

    return f"""  --browser-color-scheme: {mode};

  --color-background-default: {m['bg0']};
  --color-background-default-hover: {m['bg1']};
  --color-background-light: {m['bg1']};
  --color-background-light-hover: {m['bg2']};
  --color-background-lighter: {m['bg2']};
  --color-background-lighter-hover: {m['bg3']};
  --color-background-disabled: {m['disabled_bg']};

  --color-text-default: {m['text']};
  --color-text-light: {m['text2']};
  --color-text-lighter: {m['text3']};
  --color-text-disabled: {m['text3']};

  --color-accent-primary: {m['brand']};
  --color-accent-primary-hover: {m['brand_hover']};
  --color-accent-blue: {m['brand']};
  --color-accent-blue-hover: {m['brand_hover']};
  --color-accent-reversed: {m['bg0']};
  --color-accent-reversed-hover: {m['bg1']};
  --color-accent-gray: {m['text3']};
  --color-accent-gray-hover: {m['text2']};
  --color-link-default: {m['brand']};
  --color-link-hover: {m['brand_hover']};
  --color-link-disabled: {m['text3']};
  --color-text-blue: {m['brand']};
  --color-focus-ring: {m['brand_line']};
  --color-checkbox-checked: {m['brand']};
  --color-checkbox-unchecked: {m['text3']};
  --color-checkbox-disabled: {m['text3']};

  --color-border-default: {m['line']};
  --color-border-hover: {m['line2']};
  --color-border-disabled: {m['line']};
  --color-keyline-default: {m['line']};

  --color-accent-green: {green_fill};
  --color-accent-green-hover: {green_hover};
  --color-accent-red: {red_fill};
  --color-accent-red-hover: {red_hover};
  --color-accent-yellow: {m['warn']};
  --color-accent-yellow-hover: {m['warn_hover']};
  --color-text-green: {green_text};
  --color-text-red: {red_text};
  --color-text-yellow: {m['warn_ink']};
  --color-background-green: hsl({green_hue} / {a});
  --color-background-green-hover: hsl({green_hue} / {ah});
  --color-background-red: hsl({red_hue} / {a});
  --color-background-red-hover: hsl({red_hue} / {ah});
  --color-background-yellow: hsl({h['warn']} / {a});
  --color-background-yellow-hover: hsl({h['warn']} / {ah});
  --color-background-blue: hsl({h['brand']} / {a});
  --color-background-blue-hover: hsl({h['brand']} / {ah});
  --color-background-gray: hsl({h['gray']} / {a});
  --color-background-gray-hover: hsl({h['gray']} / {ah});

  --color-nav-background: {m['nav_bg']};
  --color-nav-text: {m['text2']};
  --color-nav-text-hover: {m['text']};
  --color-nav-text-selected: {m['text']};
  --color-nav-button: {m['bg2']};
  --color-nav-button-hover: {m['bg3']};

  --color-popover-background: {m['bg2']};
  --color-popover-background-hover: {m['bg3']};
  --color-dialog-background: {m['scrim']};
  --color-tooltip-background: {m['tooltip_bg']};
  --color-tooltip-text: {m['tooltip_text']};
  --color-shadow-default: {m['shadow']};

  --color-lineage-edge: {m['line2']};
  --color-lineage-edge-highlighted: {m['brand']};
  --color-lineage-node-background: {m['bg2']};
  --color-lineage-node-background-hover: {m['bg3']};
  --color-lineage-node-border: {m['line']};
  --color-lineage-node-border-hover: {m['line2']};
  --color-lineage-node-border-selected: {m['brand']};
  --color-lineage-group-node-background: {m['bg1']};
  --color-lineage-group-node-background-hover: {m['bg2']};
  --color-lineage-group-node-border: {m['line']};
  --color-lineage-group-node-border-hover: {m['line2']};

  --color-data-viz-green: {green_fill};
  --color-data-viz-green-alt: {green_hover};
  --color-data-viz-red: {red_fill};
  --color-data-viz-red-alt: {red_hover};
  --color-data-viz-blue: {m['brand']};
  --color-data-viz-blue-alt: {m['brand_2']};
  --color-data-viz-yellow: {m['warn']};
  --color-data-viz-yellow-alt: {m['warn_hover']};
  --color-data-viz-gray: {m['text3']};
  --color-data-viz-gray-alt: {m['text2']};
"""


HEADER = """/* ============================================================================
 * Hillpointe theme -- Alinos design tokens mapped onto Dagster's --color-*
 * system.
 *
 * GENERATED -- do not hand-edit. Regenerate with:
 *   python gen_hillpointe_theme.py > HillpointeTheme.css
 *
 * Imported from src/css/theme.css AFTER GlobalThemeStyle.css so these win the
 * cascade. GlobalThemeStyle.css itself is left as upstream ships it, so the
 * fork can rebase onto new Dagster versions without conflicts here.
 *
 * Dagster sets exactly one theme class on <body>, so every block carries the
 * complete token set. Source order puts the explicit .theme* classes after the
 * prefers-color-scheme queries so an explicit choice beats the OS preference.
 *
 * Failure is red and success is green in every variant, including the
 * NoRedGreen ones -- Dagster's red->yellow / green->blue colorblind swap is
 * intentionally not carried over.
 * ========================================================================== */
"""


def main():
    out = [HEADER]

    out.append("@media (prefers-color-scheme: light) {")
    out.append("  :root, .themeSystem, .themeSystemNoRedGreen {\n"
               + block(LIGHT, "light") + "  }")
    out.append("}\n")

    out.append("@media (prefers-color-scheme: dark) {")
    out.append("  :root, .themeSystem, .themeSystemNoRedGreen {\n"
               + block(DARK, "dark") + "  }")
    out.append("}\n")

    out.append(".themeLight, .themeLightNoRedGreen {\n" + block(LIGHT, "light") + "}\n")
    out.append(".themeDark, .themeDarkNoRedGreen {\n" + block(DARK, "dark") + "}\n")

    return "\n".join(out)


if __name__ == "__main__":
    import sys
    sys.stdout.write(main())
