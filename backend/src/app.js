import express from "express";
import cors from "cors";
import { errorHandler } from "./utils/index.js";
import morgan from "morgan";
import routes from "./routes/routes.js";

const app = express();

app.use(morgan("dev"));

app.use(cors());
app.use(express.json());

app.use("/api/v1",routes)

app.use(errorHandler);

export default app;
