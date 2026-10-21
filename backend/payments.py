"""
payments.py - Razorpay helpers (test mode): create order, verify signature,
capture and refund payments.

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


RAZORPAY_PAYMENTS_URL = "https://api.razorpay.com/v1/payments"


def ensure_captured(payment_id, amount_rupees):
    """
    Razorpay may only *authorize* a payment. Refunds need a *captured* payment,
    so capture it right after verification (no-op if it is already captured).
    """
    if not has_real_keys() or not payment_id:
        return
    keys = razorpay_keys()
    payment = requests.get(f"{RAZORPAY_PAYMENTS_URL}/{payment_id}", auth=keys, timeout=10).json()
    if payment.get("status") == "authorized":
        response = requests.post(
            f"{RAZORPAY_PAYMENTS_URL}/{payment_id}/capture", auth=keys, timeout=10,
            json={"amount": int(round(float(amount_rupees) * 100)), "currency": "INR"},
        )
        if response.status_code >= 400:
            raise RuntimeError(f"Razorpay capture error {response.status_code}: {response.text[:200]}")
        log.info("💳 Payment %s captured", payment_id)


def refund_payment(payment_id, amount_rupees):
    """
    Refund part (or all) of a Razorpay payment. Returns the refund id.
    Simulated payments (no Razorpay keys) get a simulated refund.
    """
    if not has_real_keys() or not payment_id or str(payment_id).startswith("sim_"):
        return f"sim_rfnd_{uuid.uuid4().hex[:10]}"
    response = requests.post(
        f"{RAZORPAY_PAYMENTS_URL}/{payment_id}/refund", auth=razorpay_keys(), timeout=10,
        json={"amount": int(round(float(amount_rupees) * 100)), "notes": {"reason": "Water not dispensed"}},
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Razorpay refund error {response.status_code}: {response.text[:200]}")
    return response.json()["id"]
