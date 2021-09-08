import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcrypt";
import * as EmailValidator from "email-validator";
import {
  from,
  Observable,
  of,
  Subject,
  merge,
  EMPTY,
  BehaviorSubject,
} from "rxjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, Db, ObjectId } from "mongodb";
import {
  exhaustMap,
  filter,
  mergeMap,
  takeUntil,
  mapTo,
  startWith,
  take,
  map,
  withLatestFrom,
  share,
} from "rxjs/operators";
import { StateQuery } from "./StateQuery";
import {
  GotQueueLength,
  QueueEntryAdded,
  QueueEntryRemoved,
  QueueLengthUpdated,
  StateMessage,
} from "./StateMessage";
import { nanoid } from "nanoid/non-secure";
import { DatabaseQuery } from "./DatabaseQuery";
import {
  RegisterError,
  RegisterSuccess,
  ServerMessage,
  SignInWithAuthSessionTokenError,
  SignInWithEmailAndPasswordError,
} from "./ServerMessage";
import {
  DeletedAuthSession,
  DatabaseMessage,
  FoundUserByEmail,
  InsertedAuthSession,
  FoundAuthSessionById,
  FoundUserById,
} from "./DatabaseMessage";
import {
  Authenticate,
  ServerInternalMessage,
  Unauthenticate,
} from "./ServerInternalMessage";

const sessionIdSecret =
  "j[P{;a^jYRRKWW>>$/}j]+a3-B7n:`wa92Y[`F>{PkzP$atV#DUh98Qgk^_%C%8^";

export interface SignInWithEmailAndPasswordIncoming {
  type: "SignInWithEmailAndPasswordIncoming";
  email: string;
  password: string;
}

export interface SignInWithEmailAndPasswordSuccess {
  type: "SignInWithEmailAndPasswordSuccess";
  authSessionToken: string;
  authSessionId: string;
  userId: string;
  userEmail: string;
}

export type SignInWithEmailAndPasswordOutcoming =
  | SignInWithEmailAndPasswordError
  | SignInWithEmailAndPasswordSuccess;

export interface RegisterIncoming {
  type: "RegisterIncoming";
  email: string;
  password: string;
}

export type RegisterOutcoming = RegisterError | RegisterSuccess;

export interface SignInWithAuthSessionTokenIncoming {
  type: "SignInWithAuthSessionTokenIncoming";
  authSessionToken: string;
}

export interface SignInWithAuthSessionTokenSuccess {
  type: "SignInWithAuthSessionTokenSuccess";
  authSessionId: string;
  userId: string;
  userEmail: string;
}

export type SignInWithAuthSessionTokenOutcoming =
  | SignInWithAuthSessionTokenError
  | SignInWithAuthSessionTokenSuccess;

export interface SignOutIncoming {
  type: "SignOutIncoming";
}

export interface EnterQueue {
  type: "EnterQueue";
}

export interface ExitQueue {
  type: "ExitQueue";
}

export interface SubscribeToQueueLength {
  type: "SubscribeToQueueLength";
}

export interface UnsubscribeFromQueueLength {
  type: "UnsubscribeFromQueueLength";
}

export interface GetQueueLengthIncoming {
  type: "GetQueueLengthIncoming";
}

export interface GetIsQueueingIncoming {
  type: "GetIsQueueingIncoming";
}

export interface ConnectedIncoming {
  type: "ConnectedIncoming";
}

export interface DisconnectedIncoming {
  type: "DisconnectedIncoming";
}

export type ClientMessage =
  | ConnectedIncoming
  | DisconnectedIncoming
  | RegisterIncoming
  | SignInWithEmailAndPasswordIncoming
  | SignInWithAuthSessionTokenIncoming
  | SignOutIncoming
  | EnterQueue
  | ExitQueue
  | SubscribeToQueueLength
  | UnsubscribeFromQueueLength
  | GetQueueLengthIncoming
  | GetIsQueueingIncoming;

interface SendStateQuery {
  type: "SendStateQuery";
  query: StateQuery;
}

interface SendDatabaseQuery {
  type: "SendDatabaseQuery";
  query: DatabaseQuery;
}

interface SendServerMessage {
  type: "SendServerMessage";
  message: ServerMessage;
}

interface SendServerInternalMessage {
  type: "SendServerInternalMessage";
  message: ServerInternalMessage;
}

type OutcomingCommand =
  | SendStateQuery
  | SendServerMessage
  | SendServerInternalMessage
  | SendDatabaseQuery;

interface Sources {
  databaseMessage$: Observable<DatabaseMessage>;
  clientMessage$: Observable<ClientMessage>;
  stateMessage$: Observable<StateMessage>;
  serverInternalMessage$: Observable<ServerInternalMessage>;
}

function signInWithEmailAndPassword(
  socketId: string,
  sources: Sources
): Observable<OutcomingCommand> {
  const findUserByEmail$ = sources.clientMessage$.pipe(
    filter(
      (message): message is SignInWithEmailAndPasswordIncoming =>
        message.type === "SignInWithEmailAndPasswordIncoming"
    ),
    map(
      (message): OutcomingCommand => ({
        type: "SendDatabaseQuery",
        query: {
          type: "FindUserByEmail",
          email: message.email,
          socketId,
          context: {
            type: "SignInWithEmailAndPassword",
            password: message.password,
          },
        },
      })
    )
  );

  const insertAuthSession$ = sources.databaseMessage$.pipe(
    filter(
      (message): message is FoundUserByEmail =>
        message.type === "FoundUserByEmail" &&
        message.socketId === socketId &&
        message.context.type === "SignInWithEmailAndPassword"
    ),
    map((message): OutcomingCommand => {
      if (message.user === undefined) {
        return {
          type: "SendServerMessage",
          message: {
            type: "SignInWithEmailAndPasswordError",
            description: "WRONG_EMAIL_OR_PASSWORD",
          },
        };
      }

      const isPasswordCorrect = bcrypt.compareSync(
        message.context.password,
        message.user.hashedPassword
      );

      if (isPasswordCorrect === false) {
        return {
          type: "SendServerMessage",
          message: {
            type: "SignInWithEmailAndPasswordError",
            description: "WRONG_EMAIL_OR_PASSWORD",
          },
        };
      }

      return {
        type: "SendDatabaseQuery",
        query: {
          type: "InsertAuthSession",
          socketId,
          userId: message.user._id,
          context: {
            type: "SignInWithEmailAndPassword",
          },
        },
      };
    })
  );

  const signInWithEmailAndPasswordSuccess$ = sources.databaseMessage$.pipe(
    filter(
      (message): message is InsertedAuthSession =>
        message.type === "InsertedAuthSession" &&
        message.socketId === socketId &&
        message.context.type === "SignInWithEmailAndPassword"
    ),
    map((message): OutcomingCommand => {
      const authSessionToken = jwt.sign(
        { authSessionId: message.insertedId } as object,
        sessionIdSecret
      );

      return {
        type: "SendServerInternalMessage",
        message: {
          type: "Authenticate",
          authSessionToken,
          authSessionId: message.insertedId,
          userId: message.context.user.id,
          userEmail: message.context.user.email,
        },
      };
    })
  );

  return merge(
    findUserByEmail$,
    insertAuthSession$,
    signInWithEmailAndPasswordSuccess$
  );
}

function signInWithAuthSessionToken(
  socketId: string,
  sources: Sources
): Observable<OutcomingCommand> {
  const findAuthSessionById$ = sources.clientMessage$.pipe(
    filter(
      (message): message is SignInWithAuthSessionTokenIncoming =>
        message.type === "SignInWithAuthSessionTokenIncoming"
    ),
    map((message): OutcomingCommand => {
      const decoded = jwt.verify(message.authSessionToken, sessionIdSecret);
      const authSessionId: string | undefined = (decoded as jwt.JwtPayload)
        ?.authSessionId;

      if (authSessionId === undefined) {
        return {
          type: "SendServerMessage",
          message: {
            type: "SignInWithAuthSessionTokenError",
            description: "DECODING_ERROR",
          },
        };
      }

      return {
        type: "SendDatabaseQuery",
        query: {
          type: "FindAuthSessionById",
          socketId,
          authSessionId,
        },
      };
    })
  );

  const findUserById$ = sources.databaseMessage$.pipe(
    filter((message): message is FoundAuthSessionById => message.type === 'FoundAuthSessionById'),
    map((message): OutcomingCommand => {
      if (message.authSession === undefined) {
        return {
          type: 'SendServerMessage',
          message: {
            type: "SignInWithAuthSessionTokenError",
            description: "SESSION_NOT_EXISTENT",
          }
        }
      }

      return {
        type: 'SendDatabaseQuery',
        query: {
          type: 'FindUserById',
          userId: message.authSession.userId,
          authSessionId: message.authSessionId,
          authSessionToken: message.authSessionToken,
          socketId
        }
      }
    })
  );

  const signInWithAuthSessionTokenSuccess$ = sources.databaseMessage$.pipe(
    filter((message): message is FoundUserById => message.type === 'FoundUserById'),
    map((message): OutcomingCommand => {
      if (message.user === undefined) {
        return {
          type: 'SendServerMessage',
          message: {
            type: 'SignInWithAuthSessionTokenError',
            description: 'USER_NOT_FOUND'
          }
        }
      }

      return {
        type: "SendServerInternalMessage",
        message: {
          type: "Authenticate",
          authSessionToken: message.authSessionToken,
          authSessionId: message.authSessionId,
          userId: message.userId,
          userEmail: message.user.email,
        },
      };
    })
  )

  return merge(
    findAuthSessionById$,
    findUserById$,
    signInWithAuthSessionTokenSuccess$
  );
}

function register(
  socketId: string,
  sources: Sources
): Observable<OutcomingCommand> {
  const insertRegisteredUser$ = sources.clientMessage$.pipe(
    filter(
      (message): message is RegisterIncoming =>
        message.type === "RegisterIncoming"
    ),
    map((message): OutcomingCommand => {
      if (typeof message.email !== "string") {
        return {
          type: "SendServerMessage",
          message: {
            type: "RegisterError",
            description: "EMAIL_MUST_BE_STRING",
          },
        };
      }

      if (typeof message.password !== "string") {
        return {
          type: "SendServerMessage",
          message: {
            type: "RegisterError",
            description: "PASSWORD_MUST_BE_STRING",
          },
        };
      }

      if (EmailValidator.validate(message.email) === false) {
        return {
          type: "SendServerMessage",
          message: {
            type: "RegisterError",
            description: "EMAIL_NOT_VALID",
          },
        };
      }

      if (message.password.length < 6) {
        return {
          type: "SendServerMessage",
          message: {
            type: "RegisterError",
            description: "PASSWORD_TOO_SHORT",
          },
        };
      }

      const hashedPassword = bcrypt.hashSync(message.password, 10);

      return {
        type: "SendDatabaseQuery",
        query: {
          type: "InsertRegisteredUser",
          email: message.email,
          hashedPassword,
          socketId,
        },
      };
    })
  );

  const registerSuccess$ = sources.databaseMessage$.pipe(
    filter(
      (message) =>
        message.type === "InsertedRegisteredUser" &&
        message.socketId === socketId
    ),
    map(
      (): OutcomingCommand => ({
        type: "SendServerMessage",
        message: {
          type: "RegisterSuccess",
        },
      })
    )
  );

  return merge(insertRegisteredUser$, registerSuccess$);
}

export interface Authenticated {
  type: "Authenticated";
  authSessionId: string;
  userId: string;
  userEmail: string;
}

export interface Unauthenticated {
  type: "Unauthenticated";
}

export type AuthStatus = Authenticated | Unauthenticated;

export function rxSocketProto(sources: Sources): Observable<OutcomingCommand> {
  const socketId = nanoid();

  const initialAuthStatus: AuthStatus = {
    type: "Unauthenticated",
  };

  const authStatus$ = sources.serverInternalMessage$.pipe(
    filter(
      (message): message is Authenticate | Unauthenticate =>
        message.type === "Authenticate" || message.type === "Unauthenticate"
    ),
    map((message): AuthStatus => {
      switch (message.type) {
        case "Authenticate": {
          return {
            type: "Authenticated",
            userId: message.userId,
            authSessionId: message.authSessionId,
            userEmail: message.userEmail,
          };
        }
        case "Unauthenticate": {
          return {
            type: "Unauthenticated",
          };
        }
      }
    }),
    share({
      connector: () => new BehaviorSubject<AuthStatus>(initialAuthStatus),
      resetOnError: false,
      resetOnComplete: false,
      resetOnRefCountZero: false,
    })
  );

  authStatus$.pipe(
    map(
      (authStatus): OutcomingCommand => ({
        type: "SendServerMessage",
        message: {
          type: "AuthStateUpdated",
          user:
            authStatus.type === "Authenticated"
              ? {
                  id: authStatus.userId,
                  email: authStatus.userEmail,
                }
              : null,
        },
      })
    )
  );

  sources.clientMessage$.pipe(
    filter((message) => message.type === "SignOutIncoming"),
    withLatestFrom(authStatus$),
    map(
      ([_, authStatus]): OutcomingCommand =>
        authStatus.type === "Authenticated"
          ? {
              type: "SendDatabaseQuery",
              query: {
                type: "DeleteAuthSession",
                authSessionId: authStatus.authSessionId,
                context: {
                  type: "SigningOut",
                  socketId,
                },
              },
            }
          : {
              type: "SendServerMessage",
              message: {
                type: "SignOutError",
                description: "SESSION_NON_EXISTENT",
              },
            }
    )
  );

  sources.databaseMessage$.pipe(
    filter(
      (message): message is DeletedAuthSession =>
        message.type === "DeletedAuthSession" &&
        message.context.socketId === socketId
    ),
    map(
      (): OutcomingCommand => ({
        type: "SendServerInternalMessage",
        message: {
          type: "Unauthenticate",
        },
      })
    )
  );

  sources.clientMessage$.pipe(
    filter((message) => message.type === "EnterQueue"),
    withLatestFrom(authStatus$),
    map(
      ([_, authStatus]): OutcomingCommand =>
        authStatus.type === "Authenticated"
          ? {
              type: "SendStateQuery",
              query: {
                type: "AddQueueEntry",
                userId: authStatus.userId,
              },
            }
          : {
              type: "SendServerMessage",
              message: {
                type: "QueueOperationError",
                description: "UNAUTHENTICATED",
              },
            }
    )
  );

  sources.clientMessage$.pipe(
    filter((message) => message.type === "ExitQueue"),
    withLatestFrom(authStatus$),
    map(
      ([_, authStatus]): OutcomingCommand =>
        authStatus.type === "Authenticated"
          ? {
              type: "SendStateQuery",
              query: {
                type: "RemoveQueueEntry",
                userId: authStatus.userId,
              },
            }
          : {
              type: "SendServerMessage",
              message: {
                type: "QueueOperationError",
                description: "UNAUTHENTICATED",
              },
            }
    )
  );

  sources.stateMessage$.pipe(
    withLatestFrom(authStatus$),
    filter(
      ([message, authStatus]) =>
        message.type === "QueueEntryAdded" &&
        authStatus.type === "Authenticated" &&
        message.userId === authStatus.userId
    ),
    mapTo<OutcomingCommand>({
      type: "SendServerMessage",
      message: {
        type: "EnteredQueue",
      },
    })
  );

  sources.stateMessage$.pipe(
    withLatestFrom(authStatus$),
    filter(
      ([message, authStatus]) =>
        message.type === "QueueEntryRemoved" &&
        authStatus.type === "Authenticated" &&
        message.userId === authStatus.userId
    ),
    mapTo<OutcomingCommand>({
      type: "SendServerMessage",
      message: {
        type: "ExitedQueue",
      },
    })
  );

  sources.clientMessage$.pipe(
    filter(
      (message): message is RegisterIncoming =>
        message.type === "RegisterIncoming"
    )
  );

  const authGuardedEvent$ = sources.clientMessage$.pipe(
    filter(
      (
        message
      ): message is
        | RegisterIncoming
        | SignInWithAuthSessionTokenIncoming
        | SignInWithEmailAndPasswordIncoming =>
        message.type === "RegisterIncoming" ||
        message.type === "SignInWithAuthSessionTokenIncoming" ||
        message.type === "SignInWithEmailAndPasswordIncoming"
    ),
    exhaustMap((message): Observable<OutcomingCommand> => {
      switch (message.type) {
        case "RegisterIncoming":
          return from(register(message, sources.db)).pipe(
            map(
              (message): OutcomingCommand => ({
                type: "SendServerMessage",
                message,
              })
            )
          );
        case "SignInWithEmailAndPasswordIncoming":
          return from(signInWithEmailAndPassword(message, sources.db)).pipe(
            mergeMap((outcoming): Observable<OutcomingCommand> => {
              switch (outcoming.type) {
                case "SignInWithEmailAndPasswordError":
                  return of<OutcomingCommand>({
                    type: "SendServerMessage",
                    message: outcoming,
                  });
                case "SignInWithEmailAndPasswordSuccess":
                  return of<OutcomingCommand[]>(
                    {
                      type: "SendClientRecurse",
                      message: {
                        type: "Authenticate",
                        userId: outcoming.userId,
                        userEmail: outcoming.userEmail,
                        authSessionId: outcoming.authSessionId,
                      },
                    },
                    {
                      type: "SendServerMessage",
                      message: {
                        type: "SignInWithEmailAndPasswordOutcomingSuccess",
                      },
                    }
                  );
              }
            })
          );
        case "SignInWithAuthSessionTokenIncoming":
          return from(signInWithAuthSessionToken(message, sources.db)).pipe(
            mergeMap((outcoming): Observable<OutcomingCommand> => {
              switch (outcoming.type) {
                case "SignInWithAuthSessionTokenError":
                  return of<OutcomingCommand>({
                    type: "SendServerMessage",
                    message: outcoming,
                  });
                case "SignInWithAuthSessionTokenSuccess":
                  return of<OutcomingCommand>({
                    type: "SendClientRecurse",
                    message: {
                      type: "Authenticate",
                      userId: outcoming.userId,
                      userEmail: outcoming.userEmail,
                      authSessionId: outcoming.authSessionId,
                    },
                  });
              }
            })
          );
      }
    })
  );

  const queueLengthEvent$ = sources.message$.pipe(
    filter((message) => message.type === "SubscribeToQueueLength"),
    exhaustMap(() =>
      sources.stateMessage$.pipe(
        filter(
          (stateMessage): stateMessage is QueueLengthUpdated =>
            stateMessage.type === "QueueLengthUpdated"
        ),
        map(
          (stateMessage): OutcomingCommand => ({
            type: "SendServerMessage",
            message: {
              type: "QueueLengthUpdated",
              updatedLength: stateMessage.updatedLength,
            },
          })
        ),
        takeUntil(
          sources.message$.pipe(
            filter((message) => message.type === "UnsubscribeFromQueueLength")
          )
        )
      )
    )
  );

  const getQueueLength$ = sources.message$.pipe(
    filter(
      (message): message is GetQueueLengthIncoming =>
        message.type === "GetQueueLengthIncoming"
    ),
    mapTo<OutcomingCommand>({
      type: "SendStateQuery",
      query: {
        type: "GetQueueLength",
        requestId: socketId,
      },
    })
  );

  const gotQueueLength$ = sources.stateMessage$.pipe(
    filter(
      (stateMessage): stateMessage is GotQueueLength =>
        stateMessage.type === "GotQueueLength"
    ),
    filter((stateMessage) => stateMessage.requestId === socketId),
    map(
      (stateMessage): OutcomingCommand => ({
        type: "SendServerMessage",
        message: {
          type: "QueueLengthUpdated",
          updatedLength: stateMessage.length,
        },
      })
    )
  );

  return merge(
    authGuardedEvent$,
    queueLengthEvent$,
    getQueueLength$,
    gotQueueLength$
  );
}

// @ts-ignore
async function mongoMain() {
  const mongoServer = await MongoMemoryServer.create();
  const connection = await MongoClient.connect(mongoServer.getUri());
  const db = connection.db(mongoServer.instanceInfo!.dbName);

  await db.collection("test").insertMany([{ a: 1 }, { b: 1 }]);
  await db.collection("users").insertOne({
    email: "kosmogradsky@gmail.com",
    hashedPassword: await bcrypt.hash("1234567", 10),
  });
  // const insertedSession = await db.collection("authSessions").insertOne({
  //   userId: insertedUser.insertedId,
  // });
  // const insertedSessionId = insertedSession.insertedId.toHexString();

  // const authSessionToken = await new Promise<string>((resolve) =>
  //   jwt.sign(
  //     { authSessionId: insertedSessionId } as object,
  //     sessionIdSecret,
  //     (_err, authSessionToken) => {
  //       resolve(authSessionToken!);
  //     }
  //   )
  // );

  const messageSubject = new Subject<ClientMessage>();
  const message$: Observable<ClientMessage> = messageSubject.asObservable();

  rxSocketProto({
    db,
    message$,
    stateMessage$: EMPTY,
  }).subscribe(async (message) => {
    console.log(message);
    console.log(await db.collection("authSessions").find().toArray());
    messageSubject.next({
      type: "SignOutIncoming",
    });
  });

  messageSubject.next({
    type: "SignInWithEmailAndPasswordIncoming",
    email: "kosmogradsky@gmail.com",
    password: "1234567",
  });
}

// mongoMain();
