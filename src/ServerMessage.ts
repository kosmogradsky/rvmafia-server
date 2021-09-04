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

export interface SignInWithEmailAndPasswordOutcomingSuccess {
  type: "SignInWithEmailAndPasswordOutcomingSuccess";
}

export interface EnteredQueue {
  type: "EnteredQueue";
}

export interface ExitedQueue {
  type: "ExitedQueue";
}

export interface SignInWithEmailAndPasswordError {
  type: "SignInWithEmailAndPasswordError";
  description: string;
}

export interface SignInWithAuthSessionTokenError {
  type: "SignInWithAuthSessionTokenError";
  description: string;
}

export interface RegisterError {
  type: "RegisterError";
  description: string;
}

export interface RegisterSuccess {
  type: "RegisterSuccess";
}

export interface SignOutError {
  type: "SignOutError";
  description: string;
}

export interface QueueOperationError {
  type: "QueueOperationError";
  description: string;
}

export type ServerMessage =
  | AuthStateUpdated
  | SignInWithEmailAndPasswordError
  | SignInWithAuthSessionTokenError
  | RegisterError
  | RegisterSuccess
  | QueueLengthUpdated
  | SignInWithEmailAndPasswordOutcomingSuccess
  | EnteredQueue
  | ExitedQueue
  | SignOutError
  | QueueOperationError;
