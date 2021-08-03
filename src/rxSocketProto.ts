import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcrypt";
import * as EmailValidator from "email-validator";
import { from, Observable, of, Subject, merge } from "rxjs";
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

const sessionIdSecret =
  "j[P{;a^jYRRKWW>>$/}j]+a3-B7n:`wa92Y[`F>{PkzP$atV#DUh98Qgk^_%C%8^";

export interface SignInWithEmailAndPasswordIncoming {
  type: "SignInWithEmailAndPasswordIncoming";
  data: {
    email: string;
    password: string;
  };
}

export interface SignInWithEmailAndPasswordError {
  type: "SignInWithEmailAndPasswordError";
  data: string;
}

export interface SignInWithEmailAndPasswordSuccess {
  type: "SignInWithEmailAndPasswordSuccess";
  data: {
    authSessionToken: string;
    authSessionId: string;
    userId: string;
  };
}

export type SignInWithEmailAndPasswordOutcoming =
  | SignInWithEmailAndPasswordError
  | SignInWithEmailAndPasswordSuccess;

export interface RegisterIncoming {
  type: "RegisterIncoming";
  data: {
    email: string;
    password: string;
  };
}

export interface RegisterError {
  type: "RegisterError";
  data: string;
}

export interface RegisterSuccess {
  type: "RegisterSuccess";
  data: null;
}

export type RegisterOutcoming = RegisterError | RegisterSuccess;

export interface SignInWithAuthSessionTokenIncoming {
  type: "SignInWithAuthSessionTokenIncoming";
  data: {
    authSessionToken: string;
  };
}

export interface SignInWithAuthSessionTokenError {
  type: "SignInWithAuthSessionTokenError";
  data: string;
}

export interface SignInWithAuthSessionTokenSuccess {
  type: "SignInWithAuthSessionTokenSuccess";
  data: {
    authSessionId: string;
    userId: string;
  };
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

export type IncomingMessage =
  | RegisterIncoming
  | SignInWithEmailAndPasswordIncoming
  | SignInWithAuthSessionTokenIncoming
  | SignOutIncoming
  | EnterQueue
  | ExitQueue;

export interface OutcomingMessage {
  type: string;
  data: any;
}

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
}

async function signInWithEmailAndPassword(
  message: SignInWithEmailAndPasswordIncoming,
  db: Db
): Promise<SignInWithEmailAndPasswordOutcoming> {
  const userDoc = await db
    .collection("users")
    .findOne({ email: message.data.email });

  console.log(userDoc);

  if (userDoc === undefined) {
    return {
      type: "SignInWithEmailAndPasswordError",
      data: "WRONG_EMAIL_OR_PASSWORD",
    };
  }

  const isPasswordCorrect = await bcrypt.compare(
    message.data.password,
    userDoc.hashedPassword
  );

  if (isPasswordCorrect === false) {
    return {
      type: "SignInWithEmailAndPasswordError",
      data: "WRONG_EMAIL_OR_PASSWORD",
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
    data: {
      authSessionToken,
      authSessionId: insertedSessionId,
      userId: userDoc._id,
    },
  };
}

async function signInWithAuthSessionToken(
  message: SignInWithAuthSessionTokenIncoming,
  db: Db
): Promise<SignInWithAuthSessionTokenOutcoming> {
  const decodedSessionId = await new Promise<
    { type: "Error" } | { type: "Success"; authSessionId: string }
  >((resolve) =>
    jwt.verify(
      message.data.authSessionToken,
      sessionIdSecret,
      (err, decoded) => {
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
      }
    )
  );

  if (decodedSessionId.type === "Error") {
    return { type: "SignInWithAuthSessionTokenError", data: "DECODING_ERROR" };
  }

  const authSessionId = decodedSessionId.authSessionId;
  const authSessionDoc = await db
    .collection("authSessions")
    .findOne({ _id: new ObjectId(authSessionId) });

  if (authSessionDoc === undefined) {
    return {
      type: "SignInWithAuthSessionTokenError",
      data: "SESSION_NOT_EXISTENT",
    };
  }

  return {
    type: "SignInWithAuthSessionTokenSuccess",
    data: {
      authSessionId,
      userId: authSessionDoc.userId,
    },
  };
}

async function register(
  message: RegisterIncoming,
  db: Db
): Promise<RegisterOutcoming> {
  if (typeof message.data.email !== "string") {
    return {
      type: "RegisterError",
      data: "EMAIL_MUST_BE_STRING",
    };
  }

  if (typeof message.data.password !== "string") {
    return {
      type: "RegisterError",
      data: "PASSWORD_MUST_BE_STRING",
    };
  }

  if (EmailValidator.validate(message.data.email) === false) {
    return {
      type: "RegisterError",
      data: "EMAIL_NOT_VALID",
    };
  }

  if (message.data.password.length < 6) {
    return {
      type: "RegisterError",
      data: "PASSWORD_TOO_SHORT",
    };
  }

  const hashedPassword = await bcrypt.hash(message.data.password, 10);

  await db
    .collection("users")
    .insertOne({ email: message.data.email, hashedPassword });

  return { type: "RegisterSuccess", data: null };
}

export function main(sources: Sources): Observable<OutcomingCommand> {
  function createAuthenticatedMessage$(outcoming: {
    type: string;
    data: { authSessionId: string; userId: string };
  }): Observable<OutcomingCommand> {
    return merge(
      sources.message$.pipe(
        filter((message) => message.type === "SignOutIncoming"),
        take(1),
        mergeMap(() =>
          sources.db.collection("authSessions").deleteOne({
            _id: new ObjectId(outcoming.data.authSessionId),
          })
        ),
        mapTo<OutcomingCommand>({
          type: "SendMessage",
          message: {
            type: "SignOutSuccess",
            data: null,
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
              userId: outcoming.data.userId,
            },
          })
        ),
        sources.message$.pipe(
          filter((message) => message.type === "ExitQueue"),
          mapTo<OutcomingCommand>({
            type: "ChangeState",
            request: {
              type: "RemoveQueueEntry",
              userId: outcoming.data.userId,
            },
          })
        )
      ).pipe(
        startWith<OutcomingCommand>({
          type: "SendMessage",
          message: outcoming,
        }),
        takeUntil(
          sources.message$.pipe(
            filter((message) => message.type === "SignOutIncoming")
          )
        )
      )
    );
  }

  return sources.message$.pipe(
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
}

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

  main({
    db,
    message$,
  }).subscribe(async (message) => {
    console.log(message);
    console.log(await db.collection("authSessions").find().toArray());
    messageSubject.next({
      type: "SignOutIncoming",
    });
  });

  messageSubject.next({
    type: "SignInWithEmailAndPasswordIncoming",
    data: { email: "kosmogradsky@gmail.com", password: "1234567" },
  });
}

mongoMain();
