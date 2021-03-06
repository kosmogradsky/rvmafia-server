import { merge, Observable } from "rxjs";
import { filter, map } from "rxjs/operators";
import {
  StateQuery,
  RemoveQueueEntry,
  AddQueueEntry,
  GetQueueLength,
  GetIsQueueing,
} from "./StateQuery";
import { MapperWithStateReturnee, mapWithState } from "./mapWithState";
import { QueueEntry } from "./QueueEntry";
import {
  GotIsQueueing,
  GotQueueLength,
  QueueEntryAdded,
  QueueEntryRemoved,
  QueueingStatusUpdated,
  QueueLengthUpdated,
  StateMessage,
} from "./StateMessage";

export function rxStateProto(
  incoming$: Observable<StateQuery>
): Observable<StateMessage> {
  const queueStateMessage$ = incoming$.pipe(
    filter(
      (
        message
      ): message is
        | AddQueueEntry
        | RemoveQueueEntry
        | GetIsQueueing
        | GetQueueLength =>
        message.type === "AddQueueEntry" ||
        message.type === "RemoveQueueEntry" ||
        message.type === "GetIsQueueing" ||
        message.type === "GetQueueLength"
    ),
    mapWithState(
      (
        state,
        message
      ): MapperWithStateReturnee<Map<string, QueueEntry>, StateMessage> => {
        switch (message.type) {
          case "AddQueueEntry": {
            const nextState = new Map(state);
            nextState.set(message.userId, new QueueEntry());

            const nextMessage: QueueEntryAdded = {
              type: "QueueEntryAdded",
              userId: message.userId,
              updatedQueueLength: nextState.size,
            };

            return {
              nextState,
              nextMessage,
            };
          }
          case "GetIsQueueing": {
            const nextMessage: GotIsQueueing = {
              type: "GotIsQueueing",
              isQueueing: state.has(message.userId),
            };

            return {
              nextState: undefined,
              nextMessage,
            };
          }
          case "GetQueueLength": {
            const nextMessage: GotQueueLength = {
              type: "GotQueueLength",
              length: state.size,
              requestId: message.requestId,
            };

            return {
              nextState: undefined,
              nextMessage,
            };
          }
          case "RemoveQueueEntry": {
            const nextState = new Map(state);
            nextState.delete(message.userId);

            const nextMessage: QueueEntryRemoved = {
              type: "QueueEntryRemoved",
              userId: message.userId,
              updatedQueueLength: nextState.size,
            };

            return {
              nextState,
              nextMessage,
            };
          }
        }
      },
      new Map<string, QueueEntry>()
    )
  );

  const queueLengthUpdated$ = queueStateMessage$.pipe(
    filter(
      (message): message is QueueEntryAdded | QueueEntryRemoved =>
        message.type === "QueueEntryAdded" ||
        message.type === "QueueEntryRemoved"
    ),
    map(
      (message): QueueLengthUpdated => ({
        type: "QueueLengthUpdated",
        updatedLength: message.updatedQueueLength,
      })
    )
  );

  const queueingStatusUpdated$ = merge(
    queueStateMessage$.pipe(
      filter(
        (message): message is QueueEntryAdded =>
          message.type === "QueueEntryAdded"
      ),
      map(
        (message): QueueingStatusUpdated => ({
          type: "QueueingStatusUpdated",
          userId: message.userId,
          status: true,
        })
      )
    ),
    queueStateMessage$.pipe(
      filter(
        (message): message is QueueEntryRemoved =>
          message.type === "QueueEntryRemoved"
      ),
      map(
        (message): QueueingStatusUpdated => ({
          type: "QueueingStatusUpdated",
          userId: message.userId,
          status: false,
        })
      )
    )
  );

  return merge(queueStateMessage$, queueLengthUpdated$, queueingStatusUpdated$);
}
