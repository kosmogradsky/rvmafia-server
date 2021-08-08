import * as bcrypt from "bcrypt";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Subject, Observable } from "rxjs";
import { Server } from "socket.io";
import { ChangeStateRequest } from "./ChangeStateRequest";
import { IncomingMessage, rxSocketProto } from "./rxSocketProto";
import { rxStateProto } from "./rxStateProto";
import { StateEvent } from "./StateEvent";

async function rxCommunicationProto() {
  const mongoServer = await MongoMemoryServer.create();
  const connection = await MongoClient.connect(mongoServer.getUri());
  const db = connection.db(mongoServer.instanceInfo!.dbName);

  await db.collection("test").insertMany([{ a: 1 }, { b: 1 }]);
  await db.collection("users").insertOne({
    email: "kosmogradsky@gmail.com",
    hashedPassword: await bcrypt.hash("1234567", 10),
  });

  const changeStateRequestSubject = new Subject<ChangeStateRequest>();
  const changeStateRequest$: Observable<ChangeStateRequest> =
    changeStateRequestSubject.asObservable();

  const stateEventSubject = new Subject<StateEvent>();
  const stateEvent$ = stateEventSubject.asObservable();

  rxStateProto(changeStateRequest$).subscribe((stateEvent) => {
    console.log(stateEvent);
    stateEventSubject.next(stateEvent);
  });

  const io = new Server(8000, {
    transports: ["websocket"],
  });

  io.on("connection", (socket) => {
    const messageSubject = new Subject<IncomingMessage>();
    const message$: Observable<IncomingMessage> = messageSubject.asObservable();

    socket.on(
      "sign in with email and password",
      (email: string, password: string) => {
        messageSubject.next({
          type: "SignInWithEmailAndPasswordIncoming",
          email,
          password,
        });
      }
    );

    socket.on("sign in with auth session token", (authSessionToken: string) => {
      messageSubject.next({
        type: "SignInWithAuthSessionTokenIncoming",
        authSessionToken,
      });
    });

    socket.on("register", (email: string, password: string) => {
      messageSubject.next({
        type: "RegisterIncoming",
        email,
        password,
      });
    });

    socket.on("sign out", () => {
      messageSubject.next({
        type: "SignOutIncoming",
      });
    });

    socket.on("enter queue", () => {
      messageSubject.next({
        type: "EnterQueue",
      });
    });

    socket.on("exit queue", () => {
      messageSubject.next({
        type: "ExitQueue",
      });
    });

    socket.on("subscribe to queue length", () => {
      messageSubject.next({
        type: "SubscribeToQueueLength",
      });
    });

    socket.on("unsubscribe from queue length", () => {
      messageSubject.next({
        type: "UnsubscribeFromQueueLength",
      });
    });

    rxSocketProto({
      db,
      message$,
      stateEvent$,
    }).subscribe((outcomingCommand) => {
      switch (outcomingCommand.type) {
        case "ChangeState":
          console.log("ChangeState", outcomingCommand);
          changeStateRequestSubject.next(outcomingCommand.request);
          break;
        case "SendMessage": {
          console.log("SendMessage", outcomingCommand);

          switch (outcomingCommand.message.type) {
            case "AuthStateUpdated": {
              socket.emit("auth state updated", outcomingCommand.message.user);
              break;
            }
            case "QueueLengthUpdated": {
              socket.emit(
                "queue length updated",
                outcomingCommand.message.updatedLength
              );
              break;
            }
            case "RegisterError": {
              socket.emit(
                "register error",
                outcomingCommand.message.description
              );
              break;
            }
            case "RegisterSuccess": {
              socket.emit("register success");
              break;
            }
            case "SignInWithAuthSessionTokenError": {
              socket.emit(
                "sign in with session token error",
                outcomingCommand.message.description
              );
            }
            case "SignInWithEmailAndPasswordError": {
              socket.emit(
                "sign in with email and password error",
                outcomingCommand.message.description
              );
            }
          }

          break;
        }
      }
    });
  });
}

rxCommunicationProto();
