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

export interface InsertedAuthSession {
  type: "InsertedAuthSession";
  socketId: string;
  insertedId: string;
  context: {
    type: "SignInWithEmailAndPassword";
  };
}

export type DatabaseMessage =
  | DeletedAuthSession
  | InsertedRegisteredUser
  | FoundUserByEmail
  | InsertedAuthSession;
