import { createServer } from "http";
import { parse } from "url";
import { WebSocketServer } from "ws";
import pkg from "pg";
const { Client } = pkg;

const client = new Client({
  user: "postgres",
  host: "localhost",
  database: "chat-api",
  password: "password",
  port: 5433,
});

client.connect();

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
  if (!clientId || !roomId) {
    ws.close();
    return console.log("Użytkownik nie ma poprawnych danych.");
  }
  client.query("INSERT INTO users(client_id) VALUES ($1)", [clientId]);

  client.query(
    "SELECT * FROM messages WHERE room_id = $1 ORDER BY ts ASC",
    [roomId],
    (err, res) => {
      if (err) {
        console.error("Błąd pobierania danych.");
        return;
      }
      const convertToJson = res.rows.map((row) => ({
        clientId: row.client_id,
        roomId: row.room_id,
        message: row.message,
      }));
      convertToJson.forEach((message) => {
        ws.send(JSON.stringify(message));
      });
    }
  );

  clients.push({ id: clientId, ws, idR: roomId });
  // console.log(clientId, roomId, { id: clientId, idR: roomId });

  clients.forEach((client) => {
    if (client.Id !== clientId) {
      client.ws.send(`[${clientId}]: dołączył do czatu.`);
    }
  });
  ws.send(`[${clientId}]: jesteś połączony.`);

  //--------------------------------------------------------

  //----------------------------------------------------------
  ws.on("message", function message(data, isBinary) {
    const result = JSON.parse(data.toString());
    client.query(
      "INSERT INTO messages(client_id, room_id, message) VALUES ($1, $2, $3)",
      [result.clientId, result.roomId, result.message],
      (err, res) => {
        if (err) {
          console.error("Błąd podczas zapisywania wiadomości:", err);
          return;
        }
        if (Object.keys(result).length < 3) {
          return console.log("Pola nie mogą byc puste.");
        }
        console.log("Wiadomość zapisana do bazy danych:", result);
      }
    );
    // console.log(result);
    // console.log(Object.keys(result).length);
    clients
      .filter((client) => {
        return client.idR == result.roomId && client.id != result.clientId;
      })
      .forEach((client) => {
        const showDate = new Date().toLocaleDateString(undefined, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const showTime = new Date().toLocaleTimeString();
        client.ws.send(
          `[${showDate} ${showTime}] [${clientId}]: ` + result.message,
          { binary: isBinary }
        );
      });
  });

  ws.on("close", function disconnect() {
    // client.end();
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
