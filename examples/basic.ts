/**
 * Minimal usage example for Afnkit.
 *
 * Running this file starts an HTTP server on port 3000. It is provided as
 * documentation only and was not executed while the project was authored.
 */
import { express, HttpError } from "../src/index";
import type { NextFunction, Request, Response } from "../src/index";

const app = express();

app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "Afnkit");
  next();
});

app.get("/", (req, res) => {
  res.send("Hello world!");
});

app.get("/json", (req, res) => {
  res.json({ hello: "world" });
});

app.post("/things", (req, res) => {
  res.status(201).json({ created: true });
});

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).send(err.message);
    return;
  }
  next(err);
});

app.listen(3000, () => {
  console.log("Afnkit listening on http://localhost:3000");
});
