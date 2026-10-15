import { createServer, type Server } from "node:http";
import type { Application } from "../../src/application/application";
import type { Request, Response } from "../../src/types";

export interface TestServer {
  /** Base URL such as `http://127.0.0.1:54321`. */
  url: string;
  /** Stop the server and release all connections. */
  close(): Promise<void>;
}

/**
 * Start the application on an ephemeral port so tests can exercise the full
 * Node HTTP request/response path without hard-coding a port.
 */
export async function listenOnEphemeralPort(app: Application): Promise<TestServer> {
  const server: Server = createServer((req, res) => {
    app.handle(req as Request, res as Response);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Failed to determine the test server address");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        server.closeAllConnections?.();
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
