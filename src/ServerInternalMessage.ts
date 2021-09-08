export interface Authenticate {
    type: "Authenticate";
    authSessionToken: string;
    authSessionId: string;
    userId: string;
    userEmail: string;
  }
  
  export interface Unauthenticate {
    type: "Unauthenticate";
  }
  
  export type ServerInternalMessage = Authenticate | Unauthenticate;