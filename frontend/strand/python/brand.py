"""
@twelvelabs/strand — Python Brand Constants

Canonical TwelveLabs brand values for Python consumers (e.g. SlideForge pipeline).
These match the JSON tokens in packages/strand/tokens/ exactly.

Usage:
    from strand.python.brand import BRAND_COLORS, BRAND_TYPOGRAPHY, BRAND_LAYOUT
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class BrandColors:
    """TwelveLabs canonical brand color palette."""

    # Brand palette (marketing, logos)
    brand_green: str = "#00FF00"
    brand_charcoal: str = "#1D1C1B"
    brand_white: str = "#F4F3F3"
    brand_grey: str = "#D3D1CF"

    # Gray ramp (Figma Variables: Gray50–Gray700)
    gray_50: str = "#F4F3F3"
    gray_100: str = "#ECECEC"
    gray_200: str = "#E2E2E2"
    gray_300: str = "#D3D1CF"
    gray_400: str = "#BDBCBB"
    gray_500: str = "#8F8984"
    gray_600: str = "#45423F"
    gray_700: str = "#1D1C1B"

    # UI accent (WCAG-safe derivative of brand green)
    accent: str = "#00DC82"
    accent_hover: str = "#00B86E"
    accent_light: str = "#E8F5E9"

    # Highlight green (Figma: Global/Highlight)
    highlight: str = "#60E21B"

    # Text
    text_primary: str = "#1D1C1B"
    text_secondary: str = "#6B6966"
    text_tertiary: str = "#9B9895"

    # UI surfaces
    background: str = "#F4F3F3"
    surface: str = "#FFFFFF"
    card: str = "#ECECEC"

    # Borders
    border_default: str = "#D3D1CF"
    border_light: str = "#E8E7E5"

    # Slide-specific greys
    slide_grey_light: str = "#F5F5F5"
    slide_grey_medium: str = "#666666"
    slide_grey_dark: str = "#333333"

    # Slide gradient
    gradient_start: str = "#16DF84"
    gradient_end: str = "#00D67E"

    # Product line colors
    product_search_dark: str = "#7B5880"
    product_search: str = "#F6AFFF"
    product_search_light: str = "#FBDFFF"
    product_generate_dark: str = "#7D5D0C"
    product_generate: str = "#FABA17"
    product_generate_light: str = "#FDE3A2"
    product_embed_dark: str = "#366B7F"
    product_embed: str = "#6CD5FD"
    product_embed_light: str = "#C4EEFE"

    # System
    error: str = "#DC2626"
    warning: str = "#F59E0B"
    success: str = "#00DC82"
    info: str = "#3B82F6"
    destructive: str = "#E22E22"


@dataclass(frozen=True)
class BrandTypography:
    """TwelveLabs canonical typography.

    Font families match what's actually deployed on playground.twelvelabs.io
    and twelvelabs.io. Milling is used for EVERYTHING (headings + body),
    with Noto Sans as the primary fallback — not Inter.
    """

    # Primary brand font (headings + body)
    brand_font: str = "Milling Duplex 1mm"
    brand_bold_font: str = "Milling Triplex 1mm"
    brand_xbold_font: str = "Milling Triplex 1,5mm"

    # Fallback body font (playground uses Noto Sans, not Inter)
    body_font: str = "Noto Sans"
    body_fallback: str = "Helvetica, Arial, sans-serif"

    # Technical/product UI font (marketing site)
    geist_font: str = "Geist"

    # Code font
    mono_font: str = "IBM Plex Mono"

    # Legacy aliases (kept for backwards compatibility)
    heading_font: str = "Milling Duplex 1mm"
    heading_fallback: str = "Noto Sans, Helvetica, Arial, sans-serif"

    # Font sizes in points
    title_size: int = 44
    heading_size: int = 32
    subheading_size: int = 24
    body_size: int = 18
    caption_size: int = 14


@dataclass(frozen=True)
class BrandLayout:
    """TwelveLabs canonical layout specifications."""

    slide_width: int = 1920
    slide_height: int = 1080
    margin_percent: float = 4.0
    gutter_percent: float = 8.0
    corner_radius_percent: float = 30.0
    grid_unit: int = 4


# Singleton instances — import these directly
BRAND_COLORS = BrandColors()
BRAND_TYPOGRAPHY = BrandTypography()
BRAND_LAYOUT = BrandLayout()
