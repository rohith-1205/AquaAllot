"""
payments.py - Razorpay helpers (test mode).

We call the Razorpay REST API directly with `requests`, so no extra SDK
is needed. Keys are read from backend/.env on every call, so you can
change them without restarting the server:

    RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
    RAZORPAY_KEY_SECRET=xxxxxxxxxxxx
"""

import hashlib
import hmac
import logging
import os
import time
import uuid

import requests
from dotenv import load_dotenv

log = logging.getLogger("aquaallot.payments")

ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"


def razorpay_keys():
    """Returns (key_id, key_secret) from backend/.env (re-read every time)."""
    load_dotenv(dotenv_path=ENV_FILE, override=True)
    return (
        os.getenv("RAZORPAY_KEY_ID", "").strip(),
        os.getenv("RAZORPAY_KEY_SECRET", "").strip(),
    )


def has_real_keys():
    key_id, key_secret = razorpay_keys()
    return bool(key_id and key_secret and key_id.startswith("rzp_"))


def create_razorpay_order(amount_rupees, notes=None):
    """
    Create an order that the Razorpay checkout popup can pay.

    Returns a dict: {id, amount (paise), currency, key, receipt, is_real_key}
    Without keys we return a simulated order so the demo still works.
    """
    key_id, key_secret = razorpay_keys()
    receipt = f"receipt_{int(time.time())}"
    amount_paise = int(round(float(amount_rupees) * 100))

    if has_real_keys():
        response = requests.post(
            RAZORPAY_ORDERS_URL,
            auth=(key_id, key_secret),
            json={"amount": amount_paise, "currency": "INR", "receipt": receipt, "notes": notes or {}},
            timeout=10,
        )
        if response.status_code >= 400:
            raise RuntimeError(f"Razorpay error {response.status_code}: {response.text[:200]}")
        order = response.json()
        log.info("💳 Razorpay order %s created for ₹%s", order["id"], amount_rupees)
        return {
            "id": order["id"], "amount": order["amount"], "currency": order["currency"],
            "key": key_id, "receipt": order.get("receipt", receipt), "is_real_key": True,
        }

    order_id = f"order_sim_{uuid.uuid4().hex[:10]}"
    log.info("💳 Simulated order %s created for ₹%s (no Razorpay keys)", order_id, amount_rupees)
    return {
        "id": order_id, "amount": amount_paise, "currency": "INR",
        "key": key_id, "receipt": receipt, "is_real_key": False,
    }


def signature_is_valid(razorpay_order_id, razorpay_payment_id, razorpay_signature):
    """Razorpay signs 'order_id|payment_id' with your key secret (HMAC-SHA256)."""
    _, key_secret = razorpay_keys()
    if not (key_secret and razorpay_order_id and razorpay_payment_id and razorpay_signature):
        return False
    expected = hmac.new(
        key_secret.encode(),
        f"{razorpay_order_id}|{razorpay_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, razorpay_signature)
