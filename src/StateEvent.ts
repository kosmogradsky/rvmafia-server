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
  updatedLength: number;
}

export interface QueueEntryAdded {
  type: "QueueEntryAdded";
  userId: string;
}

export interface QueueEntryRemoved {
  type: "QueueEntryRemoved";
  userId: string;
}

export type StateEvent =
  | QueueEntryAdded
  | QueueEntryRemoved
  | QueueingStatusUpdated
  | QueueLengthUpdated
  | GotQueueLength;
