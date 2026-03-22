import { WebSocketServer } from "ws";

const PORT = 3001;

const wss = new WebSocketServer({ port: PORT });

console.log(`[ws] WebSocket dev server running on ws://localhost:${PORT}`);

wss.on("connection", (ws) => {
  console.log("[ws] Client connected");

  ws.on("message", (data) => {
    const message = data.toString();
    console.log("[ws] Received:", message);
  });

  ws.on("close", () => {
    console.log("[ws] Client disconnected");
  });
});
