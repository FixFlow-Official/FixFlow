require("dotenv").config();

const nodeEnv = process.env.NODE_ENV?.trim() || "development";

const config = {
  NODE_ENV: nodeEnv,
  HOST: process.env.HOST?.trim() || (nodeEnv === "production" ? "0.0.0.0" : "127.0.0.1"),
  PORT: process.env.PORT === undefined ? 3000 : Number(process.env.PORT),
  TRUST_PROXY_HOPS: process.env.TRUST_PROXY_HOPS === undefined
    ? 0
    : Number(process.env.TRUST_PROXY_HOPS),
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  GOOGLE_USER: process.env.GOOGLE_USER,
  IMAGEKIT_PRIVATE_KEY: process.env.IMAGEKIT_PRIVATE_KEY,
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT,
};

const requiredVariables = [
  "MONGO_URI",
  "JWT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "GOOGLE_USER",
  "IMAGEKIT_PRIVATE_KEY",
];

function validateConfig(values = config) {
  const missing = requiredVariables.filter(
    (name) => typeof values[name] !== "string" || !values[name].trim(),
  );

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (!/^mongodb(?:\+srv)?:\/\//i.test(values.MONGO_URI)) {
    throw new Error("MONGO_URI must start with mongodb:// or mongodb+srv://.");
  }

  if (!Number.isInteger(values.PORT) || values.PORT < 1 || values.PORT > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  if (
    !Number.isInteger(values.TRUST_PROXY_HOPS ?? 0) ||
    (values.TRUST_PROXY_HOPS ?? 0) < 0 ||
    (values.TRUST_PROXY_HOPS ?? 0) > 10
  ) {
    throw new Error("TRUST_PROXY_HOPS must be a whole number between 0 and 10.");
  }

  if (!["development", "test", "production"].includes(values.NODE_ENV)) {
    throw new Error("NODE_ENV must be development, test, or production.");
  }

  if (values.NODE_ENV === "production" && values.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters in production.");
  }

  const hasVapidPublicKey = Boolean(values.VAPID_PUBLIC_KEY?.trim());
  const hasVapidPrivateKey = Boolean(values.VAPID_PRIVATE_KEY?.trim());
  if (hasVapidPublicKey !== hasVapidPrivateKey) {
    throw new Error("Set both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY, or leave both unset.");
  }

  if (
    hasVapidPublicKey &&
    values.VAPID_SUBJECT &&
    !/^(?:mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/i.test(values.VAPID_SUBJECT)
  ) {
    throw new Error("VAPID_SUBJECT must be a mailto: address or an HTTPS URL.");
  }

  return values;
}

module.exports = { ...config, validateConfig };
