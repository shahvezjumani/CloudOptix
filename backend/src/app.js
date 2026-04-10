import express from "express";
import cors from "cors";
import { errorHandler } from "./utils/index.js";
import morgan from "morgan";

const app = express();

app.use(cors());
app.use(express.json());

app.use(errorHandler);

app.use(morgan("dev"));

export default app;
