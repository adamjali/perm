import { defineApp } from "convex/server";
import rag from "@convex-dev/rag/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";

const app = defineApp();
app.use(rag);
app.use(rateLimiter);

export default app;
