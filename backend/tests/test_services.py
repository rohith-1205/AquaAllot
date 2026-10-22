"""
Tests for the AquaAllot business rules.

    cd backend
    npm test            (or: python -m unittest discover -s tests -v)

They use a fresh in-memory store each time, so your MongoDB data is never touched.
"""

import hashlib
import hmac
import os
import sys
import unittest
from datetime import timedelta
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import demo_data  # noqa: E402
import services  # noqa: E402
from services import ServiceError  # noqa: E402
from store import Store  # noqa: E402

STATION = demo_data.WIRED_STATION_ID


def fresh_store():
    store = Store(mongo_uri=None)
    store.replace_all("users", demo_data.make_users())
    store.replace_all("stations", demo_data.make_stations())
    store.replace_all("transactions", demo_data.make_transactions())
    store.replace_all("settings", demo_data.make_settings())
    return store


class PaymentsAndRefunds(unittest.TestCase):
    """Razorpay-only payments: paid in full, unused litres refunded through Razorpay."""

    def setUp(self):
        self.store = fresh_store()
        self.rohith = self.store.find_one("users", id="USR001")
        self.sent_refunds = []

    def fake_razorpay_refund(self, payment_id, amount):
        self.sent_refunds.append((payment_id, amount))
        return f"rfnd_{len(self.sent_refunds)}"

    def order_and_pay(self, liters=2):
        order = services.create_order(self.store, self.rohith, liters, STATION, source="esp32")
        return services.pay_order(self.store, order["id"], "pay_test_1", "order_test_1")[0]

    def txn(self, order):
        return self.store.find_one("transactions", id=order["txnId"])

    def test_card_check(self):
        self.assertEqual(services.check_card(self.store, "01020304")["name"], "Rohith")
        with self.assertRaisesRegex(ServiceError, "Unknown card"):
            services.check_card(self.store, "AA:BB:CC:DD")
        with self.assertRaisesRegex(ServiceError, "suspended"):
            services.check_card(self.store, "C0:FF:EE:99")

    def test_users_have_no_wallet(self):
        self.assertNotIn("balance", self.rohith)

    def test_pay_request_marks_order(self):
        order = services.create_order(self.store, self.rohith, 1, STATION, source="esp32")
        order = services.request_payment(self.store, order["id"])
        self.assertIsNotNone(order["payRequestedAt"])
        self.assertEqual(order["status"], "pending")          # nothing is paid by pressing PAY

    def test_razorpay_payment_creates_transaction(self):
        order = self.order_and_pay(liters=2)
        self.assertEqual(order["status"], "paid")
        txn = self.txn(order)
        self.assertEqual((txn["amount"], txn["paymentMethod"], txn["razorpayPaymentId"]), (10, "Razorpay", "pay_test_1"))

    def test_double_payment_is_refused(self):
        order = self.order_and_pay(liters=1)
        with self.assertRaisesRegex(ServiceError, "Order is paid"):
            services.pay_order(self.store, order["id"], "pay_test_2", "order_test_1")

    def test_full_dispense_has_no_refund(self):
        order = self.order_and_pay(liters=2)
        result = services.finish_order(self.store, order["id"], 2.0, "done")
        self.assertEqual((result["charged"], result["refund"]), (10, 0))
        self.assertIsNone(self.txn(order)["refundStatus"])

    def test_stopped_dispense_refunds_unused_litres_via_razorpay(self):
        order = self.order_and_pay(liters=5)                          # ₹25 paid
        result = services.finish_order(self.store, order["id"], 1.0, "stopped", "Stopped by admin")
        self.assertEqual((result["charged"], result["refund"]), (5, 20))
        self.assertEqual(self.txn(order)["refundStatus"], "pending")
        services.process_refunds(self.store, self.fake_razorpay_refund)
        self.assertEqual(self.sent_refunds, [("pay_test_1", 20)])
        txn = self.txn(order)
        self.assertEqual((txn["refundStatus"], txn["refundId"], txn["paymentStatus"]), ("processed", "rfnd_1", "Partly refunded"))

    def test_refund_is_retried_then_alerts(self):
        order = self.order_and_pay(liters=2)
        services.finish_order(self.store, order["id"], 0.0, "anomaly", "No water flow")

        def broken(payment_id, amount):
            raise RuntimeError("Razorpay down")

        for _ in range(services.MAX_REFUND_ATTEMPTS):
            services.process_refunds(self.store, broken)
        self.assertEqual(self.txn(order)["refundStatus"], "failed")
        self.assertIn("Refund Failed", [a["title"] for a in self.store.all("alerts")])

    def test_finishing_twice_does_not_refund_twice(self):
        order = self.order_and_pay(liters=2)
        services.finish_order(self.store, order["id"], 1.0, "stopped")
        services.finish_order(self.store, order["id"], 1.0, "stopped")
        services.process_refunds(self.store, self.fake_razorpay_refund)
        services.process_refunds(self.store, self.fake_razorpay_refund)
        self.assertEqual(len(self.sent_refunds), 1)

    def test_stuck_paid_order_is_fully_refunded(self):
        order = self.order_and_pay(liters=2)
        old = (services.now() - timedelta(seconds=services.STUCK_ORDER_SECONDS + 5)).isoformat()
        self.store.update("orders", {"id": order["id"]}, set={"paidAt": old})
        failed = services.housekeeping(self.store, {}, self.fake_razorpay_refund)
        self.assertEqual([o["id"] for o in failed], [order["id"]])
        self.assertEqual(self.sent_refunds, [("pay_test_1", 10)])
        self.assertEqual(self.txn(order)["paymentStatus"], "Refunded")

    def test_order_with_recent_flow_is_not_refunded(self):
        order = self.order_and_pay(liters=2)
        old = (services.now() - timedelta(seconds=services.STUCK_ORDER_SECONDS + 5)).isoformat()
        self.store.update("orders", {"id": order["id"]}, set={"paidAt": old})
        self.assertEqual(services.housekeeping(self.store, {order["id"]: services.now().timestamp()}), [])

    def test_old_unpaid_orders_expire(self):
        order = services.create_order(self.store, self.rohith, 1, STATION, source="esp32")
        old = (services.now() - timedelta(minutes=services.PENDING_ORDER_MINUTES + 1)).isoformat()
        self.store.update("orders", {"id": order["id"]}, set={"createdAt": old})
        services.housekeeping(self.store, {})
        self.assertEqual(self.store.find_one("orders", id=order["id"])["status"], "cancelled")

    def test_razorpay_signature(self):
        with mock.patch("payments.razorpay_keys", return_value=("rzp_test_x", "secret")):
            import payments
            good = hmac.new(b"secret", b"order_1|pay_1", hashlib.sha256).hexdigest()
            self.assertTrue(payments.signature_is_valid("order_1", "pay_1", good))
            self.assertFalse(payments.signature_is_valid("order_1", "pay_1", "forged"))

    def test_simulated_payment_gets_simulated_refund(self):
        import payments
        self.assertTrue(payments.refund_payment("sim_PAY-1", 5).startswith("sim_rfnd_"))


class DailyLimit(unittest.TestCase):
    def setUp(self):
        self.store = fresh_store()
        self.sanjay = self.store.find_one("users", id="USR003")     # personal limit 3 L
        self.rohith = self.store.find_one("users", id="USR001")     # default limit 10 L

    def test_personal_limit_beats_default(self):
        self.assertEqual(services.daily_limit(self.store, self.sanjay), 3.0)
        self.assertEqual(services.daily_limit(self.store, self.rohith), 10.0)

    def test_default_limit_comes_from_settings(self):
        self.store.update("settings", {"id": "global"}, set={"dailyLimitLiters": 4})
        self.assertEqual(services.daily_limit(self.store, self.rohith), 4.0)
        self.assertEqual(services.daily_limit(self.store, self.sanjay), 3.0)

    def test_order_within_limit_has_no_warning(self):
        self.assertEqual(services.create_order(self.store, self.sanjay, 2, STATION, source="esp32")["warning"], "")

    def test_order_above_limit_is_refused_with_one_alert(self):
        for _ in range(2):
            with self.assertRaises(services.ServiceError) as ctx:
                services.create_order(self.store, self.sanjay, 5, STATION, source="esp32")
        self.assertEqual(str(ctx.exception), "Only 3 L left today")
        alerts = [a for a in self.store.all("alerts") if a["title"] == "Daily Limit Exceeded"]
        self.assertEqual(len(alerts), 1)
        self.assertEqual(self.store.find("orders"), [])
        self.assertEqual(self.store.find_one("users", id="USR003")["status"], "Warning")

    def test_limit_reached(self):
        self.store.update("users", {"id": "USR003"}, set={"todayUsage": 3.0})
        sanjay = self.store.find_one("users", id="USR003")
        with self.assertRaises(services.ServiceError) as ctx:
            services.create_order(self.store, sanjay, 1, STATION, source="esp32")
        self.assertEqual(str(ctx.exception), "Daily limit reached")

    def test_alert_mode_allows_the_order(self):
        self.store.update("settings", {"id": "global"}, set={"limitAction": "alert"})
        order = services.create_order(self.store, self.sanjay, 5, STATION, source="esp32")
        self.assertEqual(order["warning"], "Over daily limit")
        self.assertIn("Daily Limit Exceeded", [a["title"] for a in self.store.all("alerts")])

    def test_analytics_shows_limits(self):
        self.store.update("users", {"id": "USR003"}, set={"todayUsage": 3.0})
        rows = {row["userId"]: row for row in services.analytics(self.store)["overuse"]}
        self.assertEqual((rows["USR003"]["limit"], rows["USR003"]["customLimit"], rows["USR003"]["left"]), (3.0, True, 0.0))
        self.assertTrue(rows["USR003"]["reachedLimit"])
        self.assertEqual((rows["USR001"]["limit"], rows["USR001"]["customLimit"]), (10.0, False))

    def test_new_day_resets_today_usage(self):
        self.store.update("users", {"id": "USR003"}, set={"todayUsage": 6.0, "status": "Warning"})
        self.store.update("settings", {"id": "global"}, set={"usageDate": "2000-01-01"})
        self.assertTrue(services.roll_over_day(self.store))
        sanjay = self.store.find_one("users", id="USR003")
        self.assertEqual((sanjay["todayUsage"], sanjay["status"]), (0.0, "Active"))
        self.assertFalse(services.roll_over_day(self.store))       # only once per day


class OfflineSalesAndAnalytics(unittest.TestCase):
    def setUp(self):
        self.store = fresh_store()

    def test_offline_sale_saved_once(self):
        first = services.record_offline_sale(self.store, "S1", "01:02:03:04", 1, 5, STATION, 30)
        again = services.record_offline_sale(self.store, "S1", "01:02:03:04", 1, 5, STATION, 30)
        self.assertIsNotNone(first)
        self.assertIsNone(again)
        self.assertEqual(first["userName"], "Rohith")

    def test_analytics_counts_today(self):
        rohith = self.store.find_one("users", id="USR001")
        order = services.create_order(self.store, rohith, 2, STATION, source="esp32")
        services.pay_order(self.store, order["id"], "pay_x", "order_x")
        services.finish_order(self.store, order["id"], 2.0)
        data = services.analytics(self.store)
        self.assertEqual(data["kpis"]["dispensedToday"], 2.0)
        self.assertEqual(data["kpis"]["revenueToday"], 10.0)
        self.assertEqual(len(data["charts"]["thisWeek"]), 7)
        self.assertGreater(data["kpis"]["dispensedYesterday"], 0)

    def test_timestamps_are_iso(self):
        for txn in self.store.all("transactions", limit=20):
            self.assertIsNotNone(services.parse_time(txn["timestamp"]), txn["timestamp"])


if __name__ == "__main__":
    unittest.main()
