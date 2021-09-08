export interface DeleteAuthSession {
  type: "DeleteAuthSession";
  authSessionId: string;
  context: {
    type: "SigningOut";
    socketId: string;
  };
}

export interface InsertRegisteredUser {
  type: "InsertRegisteredUser";
  email: string;
  hashedPassword: string;
  socketId: string;
}

export interface FindUserByEmail {
  type: "FindUserByEmail";
  socketId: string;
  email: string;
  context: {
    type: "SignInWithEmailAndPassword";
    password: string;
  };
}

export interface InsertAuthSession {
  type: "InsertAuthSession";
  socketId: string;
  userId: string;
  context: {
    type: "SignInWithEmailAndPassword";
  };
}

export type DatabaseQuery =
  | DeleteAuthSession
  | InsertRegisteredUser
  | FindUserByEmail
  | InsertAuthSession;
