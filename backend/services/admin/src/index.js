const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");

dotenv.config({ path: require("path").join(__dirname, "..", "..", "..", ".env") });

function makeApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  return app;
}

module.exports = { makeApp };