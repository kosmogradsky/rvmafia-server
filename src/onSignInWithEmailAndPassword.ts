import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcrypt";
import { Socket } from "socket.io";
import { db } from "./db";
import { Session } from "./Session";
import { sessionIdSecret } from "./sessionIdSecret";
import { Connection } from "./Connection";

export const onSignInWithEmailAndPassword = (
  socket: Socket,
  sessions: Map<string, Session>,
  connection: Connection
) => {
  socket.on(
    "sign in with email and password",
    async (email, password): Promise<void> => {
      const userRow = await db("users").where({ email }).first();

      console.log(userRow);

      if (userRow === undefined) {
        socket.emit("login error", "WRONG_EMAIL_OR_PASSWORD");
        return;
      }

      const isPasswordCorrect = await bcrypt.compare(
        password,
        userRow.hashedPassword
      );

      if (isPasswordCorrect === false) {
        socket.emit("login error", "WRONG_EMAIL_OR_PASSWORD");
        return;
      }

      const session = sessions.get(connection.sessionId);
      if (session === undefined) {
        sessions.set(connection.sessionId, { userId: userRow.id });
      } else {
        session.userId = userRow.id;
      }

      jwt.sign(connection.sessionId, sessionIdSecret, (_err, sessionToken) => {
        socket.emit("successful sign in with email and password", sessionToken);
      });
    }
  );
};
