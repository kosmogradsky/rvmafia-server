import { Socket } from "socket.io";
import { Connection } from "./Connection";
import { Session } from "./Session";

export const onSignOut = (
  socket: Socket,
  sessions: Map<string, Session>,
  connection: Connection
) => {
  socket.on("sign out", async (): Promise<void> => {
    sessions.delete(connection.sessionId);
    socket.emit("successful sign out");
  });
};
