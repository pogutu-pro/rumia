"""WhatsApp deep-link URL builder for Rumia listing inquiries."""
import urllib.parse
from typing import Optional


def build_whatsapp_inquiry_url(
    agent_whatsapp: str,
    listing_title: str,
    listing_location: str,
    price: Optional[int],
    is_full: bool = False,
    consultation_fee: Optional[int] = None,
) -> str:
    """
    Build a wa.me deep-link with a pre-filled inquiry message for a listing.

    The message clearly communicates room availability and any consultation fee
    so the agent knows the inquiry context before picking up.
    """
    # Clean phone number — strip spaces, dashes, leading +
    phone = agent_whatsapp.replace(" ", "").replace("-", "").lstrip("+")

    status = "❌ Currently Full" if is_full else "✅ Available"

    price_str = f"KES {price:,}" if price else "Price not listed"

    fee_line = ""
    if consultation_fee and consultation_fee > 0:
        fee_line = f"\n💳 Consultation Fee: KES {consultation_fee:,}"

    message = (
        f"Hi, I'm interested in this listing on Rumia:\n\n"
        f"🏠 *{listing_title}*\n"
        f"📍 {listing_location}\n"
        f"💰 {price_str}\n"
        f"Status: {status}"
        f"{fee_line}\n\n"
        f"Could you please provide more details?"
    )

    encoded_message = urllib.parse.quote(message)
    return f"https://wa.me/{phone}?text={encoded_message}"
