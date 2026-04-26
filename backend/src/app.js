import express from "express";
import cors from "cors";
import { errorHandler } from "./utils/index.js";
import morgan from "morgan";
import routes from "./routes/routes.js";
import cookieParser from "cookie-parser";

const app = express();

app.use(morgan("dev"));

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true, // ← without this, cookies are blocked
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/v1", routes);

// app.use(errorHandler);

export default app;
