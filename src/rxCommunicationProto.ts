import * as bcrypt from "bcrypt";
import { MongoClient, ObjectId } from "mongodb";
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
    const clientMessage$: Observable<ClientMessage> =
      clientMessageSubject.asObservable();

    const serverInternalMessageSubject = new Subject<ServerInternalMessage>();
    const serverInternalMessage$: Observable<ServerInternalMessage> =
      serverInternalMessageSubject.asObservable();

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
      console.log("OutcomingCommand", outcomingCommand);

      switch (outcomingCommand.type) {
        case "SendDatabaseQuery": {
          switch (outcomingCommand.query.type) {
            case "InsertRegisteredUser": {
              const insertRegisteredUser = outcomingCommand.query;

              db.collection("users")
                .insertOne({
                  email: insertRegisteredUser.email,
                  hashedPassword: insertRegisteredUser.hashedPassword,
                })
                .then(() => {
                  databaseMessageSubject.next({
                    type: "InsertedRegisteredUser",
                    socketId: insertRegisteredUser.socketId,
                  });
                });
              break;
            }
            case "InsertAuthSession": {
              const insertAuthSession = outcomingCommand.query;

              db.collection("authSessions")
                .insertOne({
                  userId: insertAuthSession.userId,
                })
                .then((insertedSession) => {
                  const insertedSessionId =
                    insertedSession.insertedId.toHexString();

                  databaseMessageSubject.next({
                    type: "InsertedAuthSession",
                    socketId: insertAuthSession.socketId,
                    insertedId: insertedSessionId,
                    context: {
                      type: "SignInWithEmailAndPassword",
                      user: {
                        id: insertAuthSession.context.user.id,
                        email: insertAuthSession.context.user.email,
                      },
                    },
                  });
                });
              break;
            }
            case "FindUserById": {
              const findUserById = outcomingCommand.query;

              db.collection("users")
                .findOne({
                  _id: new ObjectId(findUserById.userId),
                })
                .then((userDoc) => {
                  databaseMessageSubject.next({
                    type: "FoundUserById",
                    socketId: findUserById.socketId,
                    authSessionId: findUserById.authSessionId,
                    authSessionToken: findUserById.authSessionToken,
                    userId: findUserById.userId,
                    user:
                      userDoc === undefined
                        ? undefined
                        : {
                            id: userDoc._id,
                            email: userDoc.email,
                          },
                  });
                });
              break;
            }
            case "FindUserByEmail": {
              const findUserByEmail = outcomingCommand.query;

              db.collection("users")
                .findOne({ email: findUserByEmail.email })
                .then((userDoc) => {
                  console.log("userDoc", userDoc);
                  
                  databaseMessageSubject.next({
                    type: "FoundUserByEmail",
                    socketId: findUserByEmail.socketId,
                    context: findUserByEmail.context,
                    user:
                      userDoc === undefined
                        ? undefined
                        : {
                            _id: userDoc._id,
                            email: userDoc.email,
                            hashedPassword: userDoc.hashedPassword,
                          },
                  });
                });
              break;
            }
            case "FindAuthSessionById": {
              const findAuthSessionById = outcomingCommand.query;

              db.collection("authSessions")
                .findOne({
                  _id: new Object(findAuthSessionById.authSessionId),
                })
                .then((authSessionDoc) => {
                  databaseMessageSubject.next({
                    type: "FoundAuthSessionById",
                    socketId: findAuthSessionById.socketId,
                    authSessionId: findAuthSessionById.authSessionId,
                    authSessionToken: findAuthSessionById.authSessionToken,
                    authSession:
                      authSessionDoc === undefined
                        ? undefined
                        : {
                            userId: authSessionDoc.userId,
                          },
                  });
                });
              break;
            }
            case "DeleteAuthSession": {
              const deleteAuthSession = outcomingCommand.query;

              db.collection("authSessions")
                .deleteOne({
                  _id: new ObjectId(deleteAuthSession.authSessionId),
                })
                .then(() => {
                  databaseMessageSubject.next({
                    type: "DeletedAuthSession",
                    context: {
                      type: "SiginingOut",
                      socketId: deleteAuthSession.context.socketId,
                    },
                  });
                });
              break;
            }
          }
          break;
        }
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
