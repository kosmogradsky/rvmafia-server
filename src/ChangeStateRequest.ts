export interface AddQueueEntry {
  type: "AddQueueEntry";
  userId: string;
}

export interface RemoveQueueEntry {
  type: "RemoveQueueEntry";
  userId: string;
}

export type ChangeStateRequest = AddQueueEntry | RemoveQueueEntry;
