export interface DeleteAuthSession {
  type: "DeleteAuthSession";
  authSessionId: string;
  context: {
    type: "SigningOut";
    socketId: string;
  };
}

export type DatabaseQuery = DeleteAuthSession;
