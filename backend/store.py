"""
store.py - one small data layer for the whole backend.

If MongoDB is running (MONGO_URI) the data is saved there, otherwise it
lives in memory and resets when the server restarts.

Every route and service talks to `store`, never to MongoDB directly, so
the rest of the code does not care which one is active.

    store.all("users")                         -> list (newest first)
    store.find_one("users", id="USR001")       -> dict or None
    store.insert("alerts", {...})
    store.update("users", {"id": "USR001"}, set={"status": "Active"}, inc={"balance": -10})
"""

import copy
import logging
import threading

log = logging.getLogger("aquaallot.store")

COLLECTIONS = ["users", "stations", "transactions", "alerts", "anomalies", "orders", "settings", "meta"]


class Store:
    def __init__(self, mongo_uri=None):
        self.lock = threading.RLock()
        self.mongo = None
        self.memory = {name: [] for name in COLLECTIONS}

        if mongo_uri:
            try:
                import pymongo
                client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=1500)
                client.server_info()  # raises if MongoDB is not reachable
                self.mongo = client["aquaallot"]
                log.info("✓ Using MongoDB at %s (database: aquaallot)", mongo_uri)
            except Exception as error:
                log.warning("⚠ MongoDB not available (%s). Using in-memory storage.", error)

    # ---------- info ----------

    @property
    def using_mongo(self):
        return self.mongo is not None

    @property
    def name(self):
        return "MongoDB (aquaallot)" if self.using_mongo else "In-Memory"

    # ---------- read ----------

    def all(self, collection):
        """All documents, newest first."""
        with self.lock:
            if self.using_mongo:
                return [_clean(d) for d in self.mongo[collection].find({}).sort("_id", -1)]
            return copy.deepcopy(self.memory[collection])

    def find(self, collection, **match):
        return [doc for doc in self.all(collection) if _matches(doc, match)]

    def find_one(self, collection, **match):
        with self.lock:
            if self.using_mongo:
                return _clean(self.mongo[collection].find_one(match))
            for doc in self.memory[collection]:
                if _matches(doc, match):
                    return copy.deepcopy(doc)
            return None

    def count(self, collection):
        with self.lock:
            if self.using_mongo:
                return self.mongo[collection].count_documents({})
            return len(self.memory[collection])

    # ---------- write ----------

    def insert(self, collection, doc):
        with self.lock:
            if self.using_mongo:
                self.mongo[collection].insert_one(dict(doc))
            else:
                self.memory[collection].insert(0, copy.deepcopy(doc))  # newest first
        return doc

    def update(self, collection, match, set=None, inc=None):
        """Update the first matching document. Returns the updated document (or None)."""
        set, inc = set or {}, inc or {}
        with self.lock:
            if self.using_mongo:
                changes = {}
                if set:
                    changes["$set"] = set
                if inc:
                    changes["$inc"] = inc
                if changes:
                    self.mongo[collection].update_one(match, changes)
                return self.find_one(collection, **match)

            for doc in self.memory[collection]:
                if _matches(doc, match):
                    doc.update(set)
                    for key, amount in inc.items():
                        doc[key] = round((doc.get(key) or 0) + amount, 2)
                    return copy.deepcopy(doc)
            return None

    def replace_all(self, collection, docs):
        """Delete everything in a collection and insert `docs` (kept in the given order: newest first)."""
        with self.lock:
            if self.using_mongo:
                self.mongo[collection].delete_many({})
                if docs:
                    # Mongo returns newest first by _id, so insert oldest first
                    self.mongo[collection].insert_many([dict(d) for d in reversed(docs)])
            else:
                self.memory[collection] = copy.deepcopy(list(docs))


# ---------- helpers ----------

def _matches(doc, match):
    return all(doc.get(key) == value for key, value in match.items())


def _clean(doc):
    """Drop MongoDB's internal _id so the document can be sent as JSON."""
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    return doc
