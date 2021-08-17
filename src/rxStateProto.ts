import { merge, NEVER, Observable } from "rxjs";
import {
  filter,
  map,
  mergeMap,
  scan,
  share,
  startWith,
  takeUntil,
  withLatestFrom,
} from "rxjs/operators";
import {
  ChangeStateRequest,
  RemoveQueueEntry,
  AddQueueEntry,
  GetQueueLength,
  CreateIsQueueing,
  GetIsQueueing,
  DestroyIsQueueing,
} from "./ChangeStateRequest";
import {
  GotQueueLength,
  QueueingStatusUpdated,
  QueueLengthUpdated,
  StateEvent,
} from "./StateEvent";

export function rxStateProto(
  incoming$: Observable<ChangeStateRequest>
): Observable<StateEvent> {
  const queueingStatusUpdated$ = incoming$.pipe(
    filter(
      (message): message is CreateIsQueueing =>
        message.type === "CreateIsQueueing"
    ),
    mergeMap((createIsQueueingMessage) => {
      const isQueueing$ = incoming$.pipe(
        filter(
          (message): message is AddQueueEntry | RemoveQueueEntry =>
            message.type === "AddQueueEntry" ||
            message.type === "RemoveQueueEntry"
        ),
        filter((message) => message.userId === createIsQueueingMessage.userId),
        scan((_, message) => {
          switch (message.type) {
            case "AddQueueEntry":
              return true;
            case "RemoveQueueEntry":
              return false;
          }
        }, false),
        startWith(false),
        share()
      );

      const queueingStatus$ = isQueueing$.pipe(
        map(
          (isQueueing): QueueingStatusUpdated => ({
            type: "QueueingStatusUpdated",
            userId: createIsQueueingMessage.userId,
            status: isQueueing,
          })
        )
      );

      const queueingStatusOnRequest$ = incoming$.pipe(
        filter(
          (message): message is GetIsQueueing =>
            message.type === "GetIsQueueing"
        ),
        filter((message) => message.userId === createIsQueueingMessage.userId),
        withLatestFrom(isQueueing$),
        map(
          ([_, isQueueing]): QueueingStatusUpdated => ({
            type: "QueueingStatusUpdated",
            userId: createIsQueueingMessage.userId,
            status: isQueueing,
          })
        )
      );

      return merge(queueingStatus$, queueingStatusOnRequest$).pipe(
        takeUntil(
          incoming$.pipe(
            filter(
              (message): message is DestroyIsQueueing =>
                message.type === "DestroyIsQueueing"
            ),
            filter(
              (message) => message.userId === createIsQueueingMessage.userId
            )
          )
        )
      );
    })
  );

  const queueLengthInitialEvent: QueueLengthUpdated | GotQueueLength = {
    type: "QueueLengthUpdated",
    updatedLength: 0,
  };

  const queueLengthEvent$ = merge(
    queueingStatusUpdated$,
    incoming$.pipe(
      filter(
        (message): message is GetQueueLength =>
          message.type === "GetQueueLength"
      )
    )
  ).pipe(
    scan<
      GetQueueLength | QueueingStatusUpdated,
      QueueLengthUpdated | GotQueueLength
    >((prevEvent, lifecycleEvent): QueueLengthUpdated | GotQueueLength => {
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
        case "GetQueueLength":
          return {
            type: "GotQueueLength",
            requestId: lifecycleEvent.requestId,
            updatedLength: prevEvent.updatedLength,
          };
      }
    }, queueLengthInitialEvent)
  );

  return merge(queueEntryLifecycleEvent$, queueLengthEvent$);
}
