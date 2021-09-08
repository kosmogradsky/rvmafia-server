export interface DeletedAuthSession {
  type: "DeletedAuthSession";
  context: {
    type: "SiginingOut";
    socketId: string;
  };
}

export interface InsertedRegisteredUser {
  type: "InsertedRegisteredUser";
  socketId: string;
}

export interface FoundUserByEmail {
  type: "FoundUserByEmail";
  socketId: string;
  context: {
    type: "SignInWithEmailAndPassword";
    password: string;
  };
  user:
    | {
        _id: string;
        email: string;
        hashedPassword: string;
      }
    | undefined;
}

export interface FoundAuthSessionById {
  type: "FoundAuthSessionById";
  socketId: string;
  authSessionId: string;
  authSessionToken: string;
  authSession:
    | {
        userId: string;
      }
    | undefined;
}

export interface InsertedAuthSession {
  type: "InsertedAuthSession";
  socketId: string;
  insertedId: string;
  context: {
    type: "SignInWithEmailAndPassword";
    user: {
      id: string;
      email: string;
    };
  };
}

export interface FoundUserById {
  type: "FoundUserById";
  socketId: string;
  authSessionId: string;
  authSessionToken: string;
  userId: string;
  user:
    | {
        id: string;
        email: string;
      }
    | undefined;
}

export type DatabaseMessage =
  | DeletedAuthSession
  | InsertedRegisteredUser
  | FoundUserByEmail
  | InsertedAuthSession
  | FoundAuthSessionById
  | FoundUserById;
