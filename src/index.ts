import { nanoid } from "nanoid";
import { Server } from "socket.io";
import { onRegister } from "./onRegister";
import { Session } from "./Session";
import { onSignInWithEmailAndPassword } from "./onSignInWithEmailAndPassword";
import { onSetSessionToken } from "./onSetSessionToken";
import { onSignOut } from "./onSignOut";
// @ts-ignore
import { StateApp } from "./main";
import { BehaviorSubject } from "rxjs";
import { MongoClient } from "mongodb";

const queueSizeSubject = new BehaviorSubject(0);

StateApp.onQueueSizeChanged = (queueSize: number) => {
  queueSizeSubject.next(queueSize);
};

const sessions: Map<string, Session> = new Map();

async function main() {
  const client = new MongoClient("mongodb://127.0.0.1:27017");

  await client.connect();

  const db = client.db("rvmafia");

  const io = new Server(8000, {
    transports: ["websocket"],
  });

  io.on("connection", (socket) => {
    const connection = { sessionId: nanoid() };

    const queueSizeSubscription = queueSizeSubject.subscribe((queueSize) => {
      socket.emit("queue size changed", queueSize);
    });

    onRegister(socket, db);
    onSignInWithEmailAndPassword(socket, sessions, connection, db);
    onSetSessionToken(socket, connection);
    onSignOut(socket, sessions, connection);

    socket.on("enter queue", () => {
      const session = sessions.get(connection.sessionId);

      if (session !== undefined) {
        console.log(session.userId);
        StateApp.addQueueEntry(session.userId);

        socket.emit("successfully entered queue");
      } else {
        socket.emit("error entering queue", "UNAUTHENTICATED");
      }
    });

    socket.on("exit queue", () => {
      const session = sessions.get(connection.sessionId);

      if (session !== undefined) {
        console.log(session.userId);
        StateApp.removeQueueEntry(session.userId);

        socket.emit("successfully exited queue");
      } else {
        socket.emit("error exiting queue", "UNAUTHENTICATED");
      }
    });

    socket.on("create match if enough players", () => {
      StateApp.createMatchIfEnoughPlayers(nanoid());
    });

    socket.on("connect to match", (gameId: string) => {
      const session = sessions.get(connection.sessionId);

      if (session !== undefined) {
        StateApp.playerConnected(gameId, session.userId);

        socket.emit("successfully connected to match");
      } else {
        socket.emit("error connecting to match", "UNAUTHENTICATED");
      }
    });

    socket.on("disconnect from match", (gameId: string) => {
      const session = sessions.get(connection.sessionId);

      if (session !== undefined) {
        StateApp.playerDisconnected(gameId, session.userId);

        socket.emit("successfully disconnected from match");
      } else {
        socket.emit("error disconnecting from match", "UNAUTHENTICATED");
      }
    });

    socket.on("disconnect", () => {
      console.log("disconnect cleanup");

      const session = sessions.get(connection.sessionId);
      if (session !== undefined) {
        StateApp.removeQueueEntry(session.userId);
      }

      queueSizeSubscription.unsubscribe();
    });
  });
}

main();
