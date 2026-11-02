const mongoose = require("mongoose");

/** Shared fixed-window counters across backend instances and restarts. */
class MongoRateLimitStore {
  constructor(namespace) {
    this.namespace = namespace;
    this.windowMs = 0;
    this.indexPromise = null;
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  get collection() {
    const database = mongoose.connection.db;
    if (!database) {
      throw new Error("MongoDB is not connected; cannot enforce rate limits.");
    }
    return database.collection("rate_limit_buckets");
  }

  async ensureIndexes() {
    if (!this.indexPromise) {
      this.indexPromise = Promise.all([
        this.collection.createIndex(
          { namespace: 1, key: 1 },
          { unique: true, name: "rate_limit_namespace_key" },
        ),
        this.collection.createIndex(
          { resetAt: 1 },
          { expireAfterSeconds: 0, name: "rate_limit_reset_ttl" },
        ),
      ]).catch((error) => {
        this.indexPromise = null;
        throw error;
      });
    }
    await this.indexPromise;
  }

  async get(key) {
    await this.ensureIndexes();
    const bucket = await this.collection.findOne({
      namespace: this.namespace,
      key,
      resetAt: { $gt: new Date() },
    });
    return bucket
      ? { totalHits: bucket.totalHits, resetTime: bucket.resetAt }
      : undefined;
  }

  async increment(key) {
    await this.ensureIndexes();
    const now = new Date();
    const nextResetAt = new Date(now.getTime() + this.windowMs);
    const activeWindow = { $gt: ["$resetAt", now] };
    const update = [
      {
        $set: {
          namespace: this.namespace,
          key,
          totalHits: {
            $cond: [
              activeWindow,
              { $add: [{ $ifNull: ["$totalHits", 0] }, 1] },
              1,
            ],
          },
          resetAt: { $cond: [activeWindow, "$resetAt", nextResetAt] },
        },
      },
    ];

    let result;
    try {
      result = await this.collection.findOneAndUpdate(
        { namespace: this.namespace, key },
        update,
        { upsert: true, returnDocument: "after" },
      );
    } catch (error) {
      // Retry if simultaneous first requests raced to create the same bucket.
      if (error?.code !== 11000) throw error;
      result = await this.collection.findOneAndUpdate(
        { namespace: this.namespace, key },
        update,
        { returnDocument: "after" },
      );
    }

    const bucket = result?.value || result;
    return { totalHits: bucket.totalHits, resetTime: bucket.resetAt };
  }

  async decrement(key) {
    await this.ensureIndexes();
    await this.collection.updateOne(
      { namespace: this.namespace, key, resetAt: { $gt: new Date() } },
      [{ $set: { totalHits: { $max: [0, { $subtract: ["$totalHits", 1] }] } } }],
    );
  }

  async resetKey(key) {
    await this.ensureIndexes();
    await this.collection.deleteOne({ namespace: this.namespace, key });
  }

  async resetAll() {
    await this.ensureIndexes();
    await this.collection.deleteMany({ namespace: this.namespace });
  }
}

module.exports = MongoRateLimitStore;
