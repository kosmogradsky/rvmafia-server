import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcrypt";
import * as EmailValidator from "email-validator";
import { from, Observable, of, Subject, merge, EMPTY } from "rxjs";
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
} from "rxjs/operators";
import { ChangeStateRequest } from "./ChangeStateRequest";
import { StateEvent } from "./StateEvent";

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

export interface SignInWithEmailAndPasswordError {
  type: "SignInWithEmailAndPasswordError";
  description: string;
}

export type SignInWithEmailAndPasswordOutcoming =
  | SignInWithEmailAndPasswordError
  | SignInWithEmailAndPasswordSuccess;

export interface RegisterIncoming {
  type: "RegisterIncoming";
  email: string;
  password: string;
}

export interface RegisterError {
  type: "RegisterError";
  description: string;
}

export interface RegisterSuccess {
  type: "RegisterSuccess";
}

export type RegisterOutcoming = RegisterError | RegisterSuccess;

export interface SignInWithAuthSessionTokenIncoming {
  type: "SignInWithAuthSessionTokenIncoming";
  authSessionToken: string;
}

export interface SignInWithAuthSessionTokenError {
  type: "SignInWithAuthSessionTokenError";
  description: string;
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

export type IncomingMessage =
  | RegisterIncoming
  | SignInWithEmailAndPasswordIncoming
  | SignInWithAuthSessionTokenIncoming
  | SignOutIncoming
  | EnterQueue
  | ExitQueue
  | SubscribeToQueueLength
  | UnsubscribeFromQueueLength;

export interface AuthStateUpdated {
  type: "AuthStateUpdated";
  user: {
    id: string;
    email: string;
  } | null;
}

export interface QueueLengthUpdated {
  type: "QueueLengthUpdated";
  updatedLength: number;
}

export type OutcomingMessage =
  | AuthStateUpdated
  | SignInWithEmailAndPasswordError
  | SignInWithAuthSessionTokenError
  | RegisterOutcoming
  | QueueLengthUpdated;

interface ChangeState {
  type: "ChangeState";
  request: ChangeStateRequest;
}

interface SendMessage {
  type: "SendMessage";
  message: OutcomingMessage;
}

type OutcomingCommand = ChangeState | SendMessage;

interface Sources {
  db: Db;
  message$: Observable<IncomingMessage>;
  stateEvent$: Observable<StateEvent>;
}

async function signInWithEmailAndPassword(
  message: SignInWithEmailAndPasswordIncoming,
  db: Db
): Promise<SignInWithEmailAndPasswordOutcoming> {
  
  const userDoc = await db
    .collection("users")
    .findOne({ email: message.email });

  console.log(userDoc);

  if (userDoc === undefined) {
    return {
      type: "SignInWithEmailAndPasswordError",
      description: "WRONG_EMAIL_OR_PASSWORD",
    };
  }

  const isPasswordCorrect = await bcrypt.compare(
    message.password,
    userDoc.hashedPassword
  );

  if (isPasswordCorrect === false) {
    return {
      type: "SignInWithEmailAndPasswordError",
      description: "WRONG_EMAIL_OR_PASSWORD",
    };
  }

  const insertedSession = await db.collection("authSessions").insertOne({
    userId: userDoc._id,
  });
  const insertedSessionId = insertedSession.insertedId.toHexString();

  const authSessionToken = await new Promise<string>((resolve) =>
    jwt.sign(
      { authSessionId: insertedSessionId } as object,
      sessionIdSecret,
      (_err, authSessionToken) => {
        resolve(authSessionToken!);
      }
    )
  );

  return {
    type: "SignInWithEmailAndPasswordSuccess",
    authSessionToken,
    authSessionId: insertedSessionId,
    userId: userDoc._id,
    userEmail: userDoc.email
  };
}

async function signInWithAuthSessionToken(
  message: SignInWithAuthSessionTokenIncoming,
  db: Db
): Promise<SignInWithAuthSessionTokenOutcoming> {
  const decodedSessionId = await new Promise<
    { type: "Error" } | { type: "Success"; authSessionId: string }
  >((resolve) =>
    jwt.verify(message.authSessionToken, sessionIdSecret, (err, decoded) => {
      if (err) {
        resolve({ type: "Error" });
      }

      const authSessionId: string | undefined = decoded?.authSessionId;
      if (authSessionId === undefined) {
        resolve({ type: "Error" });
      } else {
        resolve({
          type: "Success",
          authSessionId,
        });
      }
    })
  );

  if (decodedSessionId.type === "Error") {
    return {
      type: "SignInWithAuthSessionTokenError",
      description: "DECODING_ERROR",
    };
  }

  const authSessionId = decodedSessionId.authSessionId;
  const authSessionDoc = await db
    .collection("authSessions")
    .findOne({ _id: new ObjectId(authSessionId) });

  if (authSessionDoc === undefined) {
    return {
      type: "SignInWithAuthSessionTokenError",
      description: "SESSION_NOT_EXISTENT",
    };
  }

  const userDoc = await db
    .collection("users")
    .findOne({ _id: authSessionDoc.userId });

  return {
    type: "SignInWithAuthSessionTokenSuccess",
    authSessionId,
    userId: authSessionDoc.userId,
    userEmail: userDoc.email,
  };
}

async function register(
  message: RegisterIncoming,
  db: Db
): Promise<RegisterOutcoming> {
  if (typeof message.email !== "string") {
    return {
      type: "RegisterError",
      description: "EMAIL_MUST_BE_STRING",
    };
  }

  if (typeof message.password !== "string") {
    return {
      type: "RegisterError",
      description: "PASSWORD_MUST_BE_STRING",
    };
  }

  if (EmailValidator.validate(message.email) === false) {
    return {
      type: "RegisterError",
      description: "EMAIL_NOT_VALID",
    };
  }

  if (message.password.length < 6) {
    return {
      type: "RegisterError",
      description: "PASSWORD_TOO_SHORT",
    };
  }

  const hashedPassword = await bcrypt.hash(message.password, 10);

  await db
    .collection("users")
    .insertOne({ email: message.email, hashedPassword });

  return { type: "RegisterSuccess" };
}

export function rxSocketProto(sources: Sources): Observable<OutcomingCommand> {
  function createAuthenticatedMessage$({
    authSessionId,
    userId,
    userEmail,
  }: {
    authSessionId: string;
    userId: string;
    userEmail: string;
  }): Observable<OutcomingCommand> {
    return merge(
      sources.message$.pipe(
        filter((message) => message.type === "SignOutIncoming"),
        take(1),
        mergeMap(() =>
          sources.db.collection("authSessions").deleteOne({
            _id: new ObjectId(authSessionId),
          })
        ),
        mapTo<OutcomingCommand>({
          type: "SendMessage",
          message: {
            type: "AuthStateUpdated",
            user: null,
          },
        })
      ),
      merge(
        sources.message$.pipe(
          filter((message) => message.type === "EnterQueue"),
          mapTo<OutcomingCommand>({
            type: "ChangeState",
            request: {
              type: "AddQueueEntry",
              userId,
            },
          })
        ),
        sources.message$.pipe(
          filter((message) => message.type === "ExitQueue"),
          mapTo<OutcomingCommand>({
            type: "ChangeState",
            request: {
              type: "RemoveQueueEntry",
              userId,
            },
          })
        )
      ).pipe(
        startWith<OutcomingCommand>({
          type: "SendMessage",
          message: {
            type: "AuthStateUpdated",
            user: {
              id: userId,
              email: userEmail,
            },
          },
        }),
        takeUntil(
          sources.message$.pipe(
            filter((message) => message.type === "SignOutIncoming")
          )
        )
      )
    );
  }

  const authGuardedEvent$ = sources.message$.pipe(
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
                type: "SendMessage",
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
                    type: "SendMessage",
                    message: outcoming,
                  });
                case "SignInWithEmailAndPasswordSuccess":
                  return createAuthenticatedMessage$(outcoming);
              }
            })
          );
        case "SignInWithAuthSessionTokenIncoming":
          return from(signInWithAuthSessionToken(message, sources.db)).pipe(
            mergeMap((outcoming): Observable<OutcomingCommand> => {
              switch (outcoming.type) {
                case "SignInWithAuthSessionTokenError":
                  return of<OutcomingCommand>({
                    type: "SendMessage",
                    message: outcoming,
                  });
                case "SignInWithAuthSessionTokenSuccess":
                  return createAuthenticatedMessage$(outcoming);
              }
            })
          );
      }
    })
  );

  const queueLengthEvent$ = sources.message$.pipe(
    filter((message) => message.type === "SubscribeToQueueLength"),
    exhaustMap(() =>
      sources.stateEvent$.pipe(
        filter((stateEvent) => stateEvent.type === "QueueStateEvent"),
        map(
          (stateEvent): OutcomingCommand => ({
            type: "SendMessage",
            message: {
              type: "QueueLengthUpdated",
              updatedLength: stateEvent.state.size,
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

  return merge(authGuardedEvent$, queueLengthEvent$);
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

  const messageSubject = new Subject<IncomingMessage>();
  const message$: Observable<IncomingMessage> = messageSubject.asObservable();

  rxSocketProto({
    db,
    message$,
    stateEvent$: EMPTY,
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
