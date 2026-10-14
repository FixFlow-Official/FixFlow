const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const authRouter = require("./routes/auth.routes");

const app = express();

// Middlewares

app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());

//Routes used with prefix

app.use("/api/auth", authRouter);

module.exports = app;
