import * as jwt from "jsonwebtoken";
import { Socket } from "socket.io";
import { Connection } from "./Connection";
import { sessionIdSecret } from "./sessionIdSecret";

export const onSetSessionToken = (socket: Socket, connection: Connection) => {
  socket.on("set with session token", (sessionToken: string) => {
    jwt.verify(sessionToken, sessionIdSecret, (err, decodedSessionId) => {
      if (err) {
        socket.emit("error setting session token");
      }

      if (decodedSessionId) {
        connection.sessionId = decodedSessionId as unknown as string;
        console.log(decodedSessionId);
        socket.emit("successfully set session token", sessionToken);
      }
    });
  });
};
