"""Rumia email templates.

Minimal, provider-agnostic template layer built on string.Template. Every email
shares the same branded base layout (header, body, CTA, footer, preferences
link); only content differs. No raw HTML strings live in business logic.
"""
import html
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from string import Template
from typing import Optional


@dataclass
class RenderedEmail:
    subject: str
    html: str
    text: str


BRAND_PRIMARY = "#6d28d9"
BRAND_PRIMARY_DARK = "#5b21b6"
BRAND_BG = "#f9fafb"
BRAND_TEXT = "#111827"
BUTTON_LINK = "https://rumia.co.ke"


def _esc(value: str) -> str:
    return html.escape(str(value or ""), quote=True)


@lru_cache(maxsize=1)
def _load_base_template() -> Template:
    path = Path(__file__).parent / "base.html"
    return Template(path.read_text(encoding="utf-8"))


def _render_text_simple(body_text: str) -> str:
    return body_text


def render_email(
    *,
    template_name: str,
    subject: str,
    heading: str,
    body_html: str,
    body_text: str,
    cta_url: Optional[str] = None,
    cta_label: Optional[str] = "View listing",
    footer_note: Optional[str] = None,
    listing_title: Optional[str] = None,
    setting_url: str = "https://rumia.co.ke/account?tab=settings",
) -> RenderedEmail:
    """Render the shared Rumia branded layout around a content fragment."""
    now_year = datetime.utcnow().year
    base = _load_base_template()
    html_body = base.substitute(
        {
            "HEADING": _esc(heading),
            "CONTENT": body_html,
            "CTA_URL": cta_url or BUTTON_LINK,
            "CTA_LABEL": _esc(cta_label or "View listing"),
            "CTA_HIDDEN": "display:none;" if not cta_url else "",
            "FOOTER_NOTE": _esc(footer_note or "") if footer_note else "",
            "YEAR": str(now_year),
            "SETTINGS_URL": setting_url,
        }
    )
    text = f"{heading}\n\n{body_text}"
    if cta_url:
        text += f"\n\n{cta_label or 'View listing'}: {cta_url}"
    if listing_title:
        text += f"\n\n—\n{listing_title}"
    text += "\n\nManage your notification preferences: " + setting_url
    return RenderedEmail(subject=subject, html=html_body, text=text)


# ─────────────────────────────────────────────────────────────────────────
# Wishlist templates
# ─────────────────────────────────────────────────────────────────────────


def wishlist_listing_available_email(*, user_name, listing_title, listing_area, listing_price, listing_url) -> RenderedEmail:
    price = listing_price if listing_price is not None else ""
    area_line = f" in {_esc(listing_area)}" if listing_area else ""
    cta = _render_body_block(
        f"""
        <p>Hi {_esc(user_name)},</p>
        <p>Good news — <strong>{_esc(listing_title)}</strong>{area_line}, a hostel you saved to your Wishlist,
        now has availability.</p>
        <p>If you're still looking, this could be a great time to reach out.</p>
        """
    )
    body_text = (
        f"Hi {user_name},\n\nGood news — {listing_title}{' in ' + listing_area if listing_area else ''}, "
        f"a hostel you saved to your Wishlist, now has availability."
    )
    if listing_price is not None:
        body_text += f"\n\nPrice: KES {listing_price}/month"
    return render_email(
        template_name="wishlist_listing_available",
        subject=f"Good news: {listing_title} is available",
        heading=f"{listing_title} is now available",
        body_html=cta,
        body_text=body_text,
        cta_url=listing_url,
        cta_label="View listing",
        listing_title=f"{listing_title} · {area_line.strip(' in')} · KES {listing_price}" if listing_price is not None else listing_title,
    )


def wishlist_listing_updated_email(*, user_name, listing_title, listing_area, listing_url, update_summary) -> RenderedEmail:
    area_line = f" in {_esc(listing_area)}" if listing_area else ""
    cta = _render_body_block(
        f"""
        <p>Hi {_esc(user_name)},</p>
        <p>There's an update to <strong>{_esc(listing_title)}</strong>{area_line}, a hostel in your Wishlist.</p>
        <p>{_esc(update_summary)}</p>
        """
    )
    body_text = (
        f"Hi {user_name},\n\nThere's an update to {listing_title}{' in ' + listing_area if listing_area else ''}, "
        f"a hostel in your Wishlist.\n\n{update_summary}"
    )
    return render_email(
        template_name="wishlist_listing_updated",
        subject=f"An update to {listing_title}",
        heading=f"An update to {listing_title}",
        body_html=cta,
        body_text=body_text,
        cta_url=listing_url,
        cta_label="View listing",
        listing_title=listing_title,
    )


def wishlist_price_updated_email(*, user_name, listing_title, listing_area, old_price, new_price, listing_url) -> RenderedEmail:
    area_line = f" in {_esc(listing_area)}" if listing_area else ""
    old_line = f"<s>KES {_esc(str(old_price))}</s>" if old_price is not None else ""
    new_line = f"KES {_esc(str(new_price))}" if new_price is not None else ""
    cta = _render_body_block(
        f"""
        <p>Hi {_esc(user_name)},</p>
        <p>There's a price change at <strong>{_esc(listing_title)}</strong>{area_line}, a hostel in your Wishlist.</p>
        <p style="font-size:20px; margin:16px 0;">
          {old_line}&nbsp; {new_line}
        </p>
        """
    )
    prev = f" KES {old_price}" if old_price is not None else ""
    curr = f" KES {new_price}" if new_price is not None else ""
    body_text = (
        f"Hi {user_name},\n\nThere's a price change at {listing_title}{' in ' + listing_area if listing_area else ''}."
        f" Previous price:{prev} → New price:{curr}"
    )
    return render_email(
        template_name="wishlist_price_updated",
        subject=f"{listing_title} has a new price",
        heading=f"{listing_title} has a new price",
        body_html=cta,
        body_text=body_text,
        cta_url=listing_url,
        cta_label="View listing",
        listing_title=f"{listing_title} · {new_line.strip('&nbsp;')}",
    )


def _render_body_block(content: str) -> str:
    return content