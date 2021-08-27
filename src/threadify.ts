import { Observable, Subject } from "rxjs";

export interface CreateThread {
  type: "CreateThread";
  threadKey: string;
}

export interface DestroyThread {
  type: "DestroyThread";
  threadKey: string;
}

export interface PushToThread<TMessage> {
  type: "PushToThread";
  threadKey: string;
  message: TMessage;
}

export interface Thread<TMessage> {
  threadKey: string;
  message$: Observable<TMessage>
}

export type ThreadifyMessage<TMessage> =
  | CreateThread
  | DestroyThread
  | PushToThread<TMessage>;

export function threadify<TMessage>() {
  return (
    source: Observable<ThreadifyMessage<TMessage>>
  ): Observable<Thread<TMessage>> => {
    return new Observable<Thread<TMessage>>(subscriber => {
      const threads = new Map<string, Subject<TMessage>>();
      
      return source.subscribe({
        next(message) {
          switch(message.type) {
            case 'CreateThread': {
              if (threads.get(message.threadKey) === undefined) {
                const threadMessageSubject = new Subject<TMessage>();
                threads.set(message.threadKey, threadMessageSubject);

                subscriber.next({
                  threadKey: message.threadKey,
                  message$: threadMessageSubject.asObservable()
                });
              }
              break;
            }
            case 'DestroyThread': {
              const thread = threads.get(message.threadKey);

              if (thread !== undefined) {
                thread.complete();
              }

              threads.delete(message.threadKey);
              break;
            }
            case 'PushToThread': {
              const thread = threads.get(message.threadKey);

              if (thread !== undefined) {
                thread.next(message.message);
              }
              
              break;
            }
          }
        },
        error(err) {
          subscriber.error(err);
        },
        complete() {
          subscriber.complete();
        },
      });
    });
  };
}
