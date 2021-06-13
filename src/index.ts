import { nanoid } from "nanoid";
import { Server } from "socket.io";
import { BehaviorSubject } from "rxjs";
import { onRegister } from "./onRegister";
import { Session } from "./Session";
import { onSignInWithEmailAndPassword } from "./onSignInWithEmailAndPassword";
import { onSetSessionToken } from "./onSetSessionToken";
import { onSignOut } from "./onSignOut";
import { map } from "rxjs/operators";

const sessions: Map<string, Session> = new Map();

function between(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
}

class QueueEntry {
  readonly orderToken: number;
  readonly orderTokenRange: number;

  constructor(orderTokenRange: number = 1024) {
    this.orderTokenRange = orderTokenRange;
    this.orderToken = between(1, this.orderTokenRange);
  }
}

const queueSubject = new BehaviorSubject<Map<string, QueueEntry>>(new Map());

queueSubject.pipe(map((queue) => queue.size));

const io = new Server(8000, {
  transports: ["websocket"],
});

io.on("connection", (socket) => {
  const connection = { sessionId: nanoid() };

  onRegister(socket);
  onSignInWithEmailAndPassword(socket, sessions, connection);
  onSetSessionToken(socket, connection);
  onSignOut(socket, sessions, connection);

  socket.on("enter queue", () => {
    const session = sessions.get(connection.sessionId);

    if (session !== undefined) {
      const queue = queueSubject.getValue();
      const nextQueue = new Map(queue);
      nextQueue.set(session.userId, new QueueEntry());
      queueSubject.next(queue);

      socket.emit("successfully entered queue");
    } else {
      socket.emit("error entering queue", "UNAUTHENTICATED");
    }
  });
});
