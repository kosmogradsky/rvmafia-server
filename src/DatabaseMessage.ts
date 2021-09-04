export interface AuthSessionDeleted {
  type: "AuthSessionDeleted";
  context: {
    type: "SiginingOut";
    socketId: string;
  };
}

export type DatabaseMessage = AuthSessionDeleted;
