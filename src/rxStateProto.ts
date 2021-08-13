import { merge, NEVER, Observable } from "rxjs";
import {
  filter,
  map,
  mergeMap,
  scan,
  startWith,
  takeUntil,
} from "rxjs/operators";
import {
  ChangeStateRequest,
  RemoveQueueEntry,
  AddQueueEntry,
} from "./ChangeStateRequest";
import {
  QueueEntryAdded,
  QueueEntryRemoved,
  QueueLengthUpdated,
  StateEvent,
} from "./StateEvent";

export function rxStateProto(
  incoming$: Observable<ChangeStateRequest>
): Observable<StateEvent> {
  const queueEntryLifecycleEvent$ = incoming$.pipe(
    filter(
      (message): message is AddQueueEntry => message.type === "AddQueueEntry"
    ),
    mergeMap((addQueueEntryMessage) => {
      const removeQueueEntry$ = incoming$.pipe(
        filter(
          (message): message is RemoveQueueEntry =>
            message.type === "RemoveQueueEntry"
        ),
        filter((message) => message.userId === addQueueEntryMessage.userId)
      );

      return merge(
        removeQueueEntry$.pipe(
          map(
            (message): QueueEntryRemoved => ({
              type: "QueueEntryRemoved",
              userId: message.userId,
            })
          )
        ),
        NEVER.pipe(
          startWith<QueueEntryAdded>({
            type: "QueueEntryAdded",
            userId: addQueueEntryMessage.userId,
          }),
          takeUntil(removeQueueEntry$)
        )
      );
    })
  );

  const queueLengthInitialEvent: QueueLengthUpdated = {
    type: "QueueLengthUpdated",
    updatedLength: 0,
  };

  const queueLengthEvent$ = queueEntryLifecycleEvent$.pipe(
    scan((prevEvent, lifecycleEvent): QueueLengthUpdated => {
      switch (lifecycleEvent.type) {
        case "QueueEntryAdded":
          return {
            type: "QueueLengthUpdated",
            updatedLength: prevEvent.updatedLength + 1,
          };
        case "QueueEntryRemoved":
          return {
            type: "QueueLengthUpdated",
            updatedLength: prevEvent.updatedLength - 1,
          };
      }
    }, queueLengthInitialEvent)
  );

  return merge(queueEntryLifecycleEvent$, queueLengthEvent$);
}
