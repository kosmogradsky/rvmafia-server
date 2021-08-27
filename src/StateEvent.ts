export interface QueueingStatusUpdated {
  type: "QueueingStatusUpdated";
  userId: string;
  status: boolean;
}

export interface QueueLengthUpdated {
  type: "QueueLengthUpdated";
  updatedLength: number;
}

export interface GotQueueLength {
  type: "GotQueueLength";
  requestId: string;
  length: number;
}

export interface GotIsQueueing {
  type: "GotIsQueueing";
  isQueueing: boolean;
}

export interface QueueEntryAdded {
  type: "QueueEntryAdded";
  userId: string;
  updatedQueueLength: number;
}

export interface QueueEntryRemoved {
  type: "QueueEntryRemoved";
  userId: string;
  updatedQueueLength: number;
}

export type StateEvent =
  | QueueEntryAdded
  | QueueEntryRemoved
  | QueueingStatusUpdated
  | QueueLengthUpdated
  | GotQueueLength
  | GotIsQueueing;
