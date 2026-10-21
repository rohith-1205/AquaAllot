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


class WalletAndOrders(unittest.TestCase):
    def setUp(self):
        self.store = fresh_store()
        self.rohith = self.store.find_one("users", id="USR001")       # ₹150

    def order_and_pay(self, user_id="USR001", liters=2):
        user = self.store.find_one("users", id=user_id)
        order = services.create_order(self.store, user, liters, STATION, source="esp32")
        return services.pay_order(self.store, order["id"], via="test")

    def balance(self, user_id="USR001"):
        return self.store.find_one("users", id=user_id)["balance"]

    def test_card_check(self):
        self.assertEqual(services.check_card(self.store, "01020304")["name"], "Rohith")
        with self.assertRaisesRegex(ServiceError, "Unknown card"):
            services.check_card(self.store, "AA:BB:CC:DD")
        with self.assertRaisesRegex(ServiceError, "suspended"):
            services.check_card(self.store, "C0:FF:EE:99")

    def test_paying_reserves_money_from_wallet(self):
        order, user = self.order_and_pay(liters=2)
        self.assertEqual(order["status"], "paid")
        self.assertEqual(self.balance(), 150 - 10)

    def test_low_wallet_is_refused(self):
        with self.assertRaisesRegex(ServiceError, "Low wallet balance"):
            self.order_and_pay(user_id="USR002", liters=2)              # Deepankishor has ₹8
        self.assertEqual(self.balance("USR002"), 8)

    def test_full_dispense_charges_everything(self):
        order, _ = self.order_and_pay(liters=2)
        result = services.finish_order(self.store, order["id"], 2.0, "done")
        self.assertEqual((result["charged"], result["refund"]), (10, 0))
        self.assertEqual(self.balance(), 140)
        txn = self.store.find_one("transactions", id=order["txnId"])
        self.assertEqual((txn["dispensingStatus"], txn["amount"]), ("Completed", 10))

    def test_stopped_dispense_refunds_unused_litres(self):
        order, _ = self.order_and_pay(liters=5)                       # ₹25 reserved
        result = services.finish_order(self.store, order["id"], 1.0, "stopped", "Stopped by admin")
        self.assertEqual((result["charged"], result["refund"]), (5, 20))
        self.assertEqual(self.balance(), 150 - 5)
        txn = self.store.find_one("transactions", id=order["txnId"])
        self.assertEqual(txn["paymentStatus"], "Partly refunded")

    def test_finishing_twice_does_not_charge_twice(self):
        order, _ = self.order_and_pay(liters=1)
        services.finish_order(self.store, order["id"], 1.0)
        services.finish_order(self.store, order["id"], 1.0)
        self.assertEqual(self.balance(), 145)

    def test_double_payment_is_refused(self):
        order, _ = self.order_and_pay(liters=1)
        with self.assertRaisesRegex(ServiceError, "Order is paid"):
            services.pay_order(self.store, order["id"], via="test")
        self.assertEqual(self.balance(), 145)

    def test_stuck_paid_order_is_refunded(self):
        order, _ = self.order_and_pay(liters=2)
        old = (services.now() - timedelta(seconds=services.STUCK_ORDER_SECONDS + 5)).isoformat()
        self.store.update("orders", {"id": order["id"]}, set={"paidAt": old})
        refunded = services.housekeeping(self.store, last_activity={})
        self.assertEqual([o["id"] for o in refunded], [order["id"]])
        self.assertEqual(self.balance(), 150)
        self.assertEqual(self.store.find_one("orders", id=order["id"])["status"], "failed")

    def test_order_with_recent_flow_is_not_refunded(self):
        order, _ = self.order_and_pay(liters=2)
        old = (services.now() - timedelta(seconds=services.STUCK_ORDER_SECONDS + 5)).isoformat()
        self.store.update("orders", {"id": order["id"]}, set={"paidAt": old})
        refunded = services.housekeeping(self.store, last_activity={order["id"]: services.now().timestamp()})
        self.assertEqual(refunded, [])

    def test_old_unpaid_orders_expire(self):
        order = services.create_order(self.store, self.rohith, 1, STATION, source="esp32")
        old = (services.now() - timedelta(minutes=services.PENDING_ORDER_MINUTES + 1)).isoformat()
        self.store.update("orders", {"id": order["id"]}, set={"createdAt": old})
        services.housekeeping(self.store, last_activity={})
        self.assertEqual(self.store.find_one("orders", id=order["id"])["status"], "cancelled")


class TopUps(unittest.TestCase):
    def setUp(self):
        self.store = fresh_store()

    def test_topup_adds_money_once(self):
        topup = services.create_topup(self.store, "USR002", 50, "order_test")
        services.complete_topup(self.store, topup["id"], "pay_1", "Razorpay")
        self.assertEqual(self.store.find_one("users", id="USR002")["balance"], 58)
        with self.assertRaisesRegex(ServiceError, "already used"):
            services.complete_topup(self.store, topup["id"], "pay_1", "Razorpay")
        self.assertEqual(self.store.find_one("users", id="USR002")["balance"], 58)

    def test_topup_limits(self):
        with self.assertRaises(ServiceError):
            services.create_topup(self.store, "USR002", 1, "order_test")

    def test_razorpay_signature(self):
        with mock.patch("payments.razorpay_keys", return_value=("rzp_test_x", "secret")):
            import payments
            good = hmac.new(b"secret", b"order_1|pay_1", hashlib.sha256).hexdigest()
            self.assertTrue(payments.signature_is_valid("order_1", "pay_1", good))
            self.assertFalse(payments.signature_is_valid("order_1", "pay_1", "forged"))


class OverUsage(unittest.TestCase):
    def setUp(self):
        self.store = fresh_store()
        self.sanjay = self.store.find_one("users", id="USR003")

    def test_baseline_is_learned_from_history(self):
        profile = services.usage_profile(self.store, self.sanjay)
        self.assertTrue(profile["learned"])
        self.assertAlmostEqual(profile["mean"], 1.5, delta=0.5)

    def test_big_order_raises_one_alert_per_day(self):
        order = services.create_order(self.store, self.sanjay, 5, STATION, source="esp32")
        self.assertEqual(order["warning"], "Above normal use")
        services.create_order(self.store, self.sanjay, 5, STATION, source="esp32")
        spikes = [a for a in self.store.all("alerts") if a["title"] == "Unusual Consumption Spike"]
        self.assertEqual(len(spikes), 1)
        self.assertEqual(len(self.store.all("anomalies")), 1)
        self.assertEqual(self.store.find_one("users", id="USR003")["status"], "Warning")

    def test_normal_order_has_no_warning(self):
        rohith = self.store.find_one("users", id="USR001")
        self.assertEqual(services.create_order(self.store, rohith, 1, STATION, source="esp32")["warning"], "")

    def test_daily_quota_alert(self):
        rohith = self.store.find_one("users", id="USR001")
        self.store.update("users", {"id": "USR001"}, set={"todayUsage": 9.0})
        rohith = self.store.find_one("users", id="USR001")
        services.create_order(self.store, rohith, 2, STATION, source="esp32")
        titles = [a["title"] for a in self.store.all("alerts")]
        self.assertIn("Daily Quota Exceeded", titles)

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
        services.pay_order(self.store, order["id"], via="test")
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
