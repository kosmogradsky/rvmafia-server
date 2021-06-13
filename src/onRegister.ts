import * as bcrypt from "bcrypt";
import * as EmailValidator from "email-validator";
import { nanoid } from "nanoid";
import { Socket } from "socket.io";
import { db } from "./db";

export const onRegister = (socket: Socket) => {
  socket.on("register", async (email, password): Promise<void> => {
    if (typeof email !== "string") {
      socket.emit("registration error", "EMAIL_MUST_BE_STRING");
      return;
    }

    if (typeof password !== "string") {
      socket.emit("registration error", "PASSWORD_MUST_BE_STRING");
      return;
    }

    if (EmailValidator.validate(email) === false) {
      socket.emit("registration error", "EMAIL_NOT_VALID");
      return;
    }

    if (password.length < 6) {
      socket.emit("registration error", "PASSWORD_TOO_SHORT");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const uid = nanoid();
    await db("users").insert({ uid, email, hashedPassword });

    socket.emit("registration success");
  });
};
