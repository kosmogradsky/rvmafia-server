export interface AddQueueEntry {
  type: "AddQueueEntry";
  userId: string;
}

export interface RemoveQueueEntry {
  type: "RemoveQueueEntry";
  userId: string;
}

export interface GetQueueLength {
  type: "GetQueueLength";
  requestId: string;
}

export interface GetIsQueueing {
  type: "GetIsQueueing";
  userId: string;
}

export interface CreateIsQueueing {
  type: "CreateIsQueueing";
  userId: string;
}

export interface DestroyIsQueueing {
  type: "DestroyIsQueueing";
  userId: string;
}

export type ChangeStateRequest =
  | AddQueueEntry
  | RemoveQueueEntry
  | GetQueueLength
  | GetIsQueueing
  | CreateIsQueueing
  | DestroyIsQueueing;
