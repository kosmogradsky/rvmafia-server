import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcrypt";
import { Socket } from "socket.io";
import { Session } from "./Session";
import { sessionIdSecret } from "./sessionIdSecret";
import { Connection } from "./Connection";
import { Db } from "mongodb";

export const onSignInWithEmailAndPassword = (
  socket: Socket,
  sessions: Map<string, Session>,
  connection: Connection,
  db: Db
) => {
  socket.on(
    "sign in with email and password",
    async (email, password): Promise<void> => {
      const userDoc = await db.collection("users").findOne({ email });

      console.log(userDoc);

      if (userDoc === undefined) {
        socket.emit("login error", "WRONG_EMAIL_OR_PASSWORD");
        return;
      }

      const isPasswordCorrect = await bcrypt.compare(
        password,
        userDoc.hashedPassword
      );

      if (isPasswordCorrect === false) {
        socket.emit("login error", "WRONG_EMAIL_OR_PASSWORD");
        return;
      }

      const session = sessions.get(connection.sessionId);
      if (session === undefined) {
        sessions.set(connection.sessionId, {
          userId: userDoc._id.toHexString(),
        });
      } else {
        session.userId = userDoc._id.toHexString();
      }

      jwt.sign(connection.sessionId, sessionIdSecret, (_err, sessionToken) => {
        socket.emit("successful sign in with email and password", sessionToken);
      });
    }
  );
};
