import { createServer } from "http";
import { parse } from "url";
import { WebSocketServer, WebSocket } from "ws";

const server = createServer();
const appServer = new WebSocketServer({ noServer: true });
const clients = [];

appServer.on("connection", function connection(ws, req) {
  const clientId = new URL(req.url, "ws://localhost:3000").searchParams.get(
    "clientId"
  );
  const roomId = new URL(req.url, "ws://localhost:3000").searchParams.get(
    "roomId"
  );
  console.log(req.url);

  clients.push({ id: clientId, ws });
  clients.forEach((client) => {
    if (client.Id !== clientId) {
      client.ws.send(`[${clientId}]: dołączył do czata.`);
    }
  });
  ws.send(`[${clientId}]: jesteś połączony.`);
  //--------------------------------------------------------

  //----------------------------------------------------------
  ws.on("message", function message(data, isBinary) {
    appServer.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        const showDate = new Date().toLocaleDateString(undefined, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const showTime = new Date().toLocaleTimeString();
        client.send(`[${showDate} ${showTime}] [${clientId}]: ` + data, {
          binary: isBinary,
        });
      }
    });
  });

  ws.on("close", function disconnect() {
    const index = clients.findIndex((client) => client.ws === ws);
    if (index !== -1) {
      const disconectedClient = clients.splice(index, 1)[0];
      const disconectedClientId = disconectedClient.id;

      clients.forEach((client) => {
        client.ws.send(`[${disconectedClientId}] odłączony.`);
      });
    }
  });
});

server.on("upgrade", function upgrade(request, socket, head) {
  const { pathname } = parse(request.url);
  if (pathname === "/global") {
    return appServer.handleUpgrade(request, socket, head, function done(ws) {
      appServer.emit("connection", ws, request);
    });
  }
  socket.destroy();
});

server.listen(3000);
