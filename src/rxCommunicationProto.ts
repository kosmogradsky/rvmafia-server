import * as bcrypt from "bcrypt";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Subject, Observable } from "rxjs";
import { Server } from "socket.io";
import { StateQuery } from "./StateQuery";
import { ClientMessage, rxSocketProto } from "./rxSocketProto";
import { rxStateProto } from "./rxStateProto";
import { StateMessage } from "./StateMessage";
import { DatabaseMessage } from "./DatabaseMessage";
import { ServerInternalMessage } from "./ServerInternalMessage";

async function rxCommunicationProto() {
  const mongoServer = await MongoMemoryServer.create();
  const connection = await MongoClient.connect(mongoServer.getUri());
  const db = connection.db(mongoServer.instanceInfo!.dbName);

  await db.collection("test").insertMany([{ a: 1 }, { b: 1 }]);
  await db.collection("users").insertOne({
    email: "kosmogradsky@gmail.com",
    hashedPassword: await bcrypt.hash("1234567", 10),
  });

  const changeStateRequestSubject = new Subject<StateQuery>();
  const changeStateRequest$: Observable<StateQuery> =
    changeStateRequestSubject.asObservable();

  const stateMessageSubject = new Subject<StateMessage>();
  const stateMessage$ = stateMessageSubject.asObservable();

  const databaseMessageSubject = new Subject<DatabaseMessage>();
  const databaseMessage$ = databaseMessageSubject.asObservable();

  rxStateProto(changeStateRequest$).subscribe((stateMessage) => {
    console.log(stateMessage);
    stateMessageSubject.next(stateMessage);
  });

  const io = new Server(8000, {
    transports: ["websocket"],
  });

  io.on("connection", (socket) => {
    const clientMessageSubject = new Subject<ClientMessage>();
    const clientMessage$: Observable<ClientMessage> = clientMessageSubject.asObservable();

    const serverInternalMessageSubject = new Subject<ServerInternalMessage>();
    const serverInternalMessage$: Observable<ServerInternalMessage> = serverInternalMessageSubject.asObservable();

    socket.on(
      "sign in with email and password",
      (email: string, password: string) => {
        clientMessageSubject.next({
          type: "SignInWithEmailAndPasswordIncoming",
          email,
          password,
        });
      }
    );

    socket.on("sign in with auth session token", (authSessionToken: string) => {
      clientMessageSubject.next({
        type: "SignInWithAuthSessionTokenIncoming",
        authSessionToken,
      });
    });

    socket.on("register", (email: string, password: string) => {
      clientMessageSubject.next({
        type: "RegisterIncoming",
        email,
        password,
      });
    });

    socket.on("sign out", () => {
      clientMessageSubject.next({
        type: "SignOutIncoming",
      });
    });

    socket.on("enter queue", () => {
      clientMessageSubject.next({
        type: "EnterQueue",
      });
    });

    socket.on("exit queue", () => {
      clientMessageSubject.next({
        type: "ExitQueue",
      });
    });

    socket.on("subscribe to queue length", () => {
      clientMessageSubject.next({
        type: "SubscribeToQueueLength",
      });
    });

    socket.on("unsubscribe from queue length", () => {
      clientMessageSubject.next({
        type: "UnsubscribeFromQueueLength",
      });
    });

    socket.on("get queue length", () => {
      clientMessageSubject.next({
        type: "GetQueueLengthIncoming",
      });
    });

    socket.on("get is queueing", () => {
      clientMessageSubject.next({
        type: "GetIsQueueingIncoming",
      });
    });

    rxSocketProto({
      databaseMessage$,
      clientMessage$,
      serverInternalMessage$,
      stateMessage$,
    }).subscribe((outcomingCommand) => {
      switch (outcomingCommand.type) {
        case "SendStateQuery":
          console.log("SendStateQuery", outcomingCommand);
          changeStateRequestSubject.next(outcomingCommand.query);
          break;
        case "SendServerMessage": {
          console.log("SendServerMessage", outcomingCommand);

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
              break;
            }
            case "SignInWithEmailAndPasswordError": {
              socket.emit(
                "sign in with email and password error",
                outcomingCommand.message.description
              );
              break;
            }
            case "SignInWithEmailAndPasswordOutcomingSuccess": {
              socket.emit("sign in with email and password success");
              break;
            }
            case "EnteredQueue": {
              socket.emit("entered queue");
              break;
            }
            case "ExitedQueue": {
              socket.emit("exited queue");
            }
          }

          break;
        }
      }
    });
  });
}

rxCommunicationProto();
