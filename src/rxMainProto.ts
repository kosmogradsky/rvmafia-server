import * as bcrypt from "bcrypt";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Subject, Observable } from "rxjs";
import { ChangeStateRequest } from "./ChangeStateRequest";
import { IncomingMessage, rxSocketProto } from "./rxSocketProto";
import { rxStateProto } from "./rxStateProto";
import { StateMessage } from "./StateMessage";

async function rxMainProto() {
  const mongoServer = await MongoMemoryServer.create();
  const connection = await MongoClient.connect(mongoServer.getUri());
  const db = connection.db(mongoServer.instanceInfo!.dbName);

  await db.collection("test").insertMany([{ a: 1 }, { b: 1 }]);
  await db.collection("users").insertOne({
    email: "kosmogradsky@gmail.com",
    hashedPassword: await bcrypt.hash("1234567", 10),
  });

  const messageSubject = new Subject<IncomingMessage>();
  const message$: Observable<IncomingMessage> = messageSubject.asObservable();

  const changeStateRequestSubject = new Subject<ChangeStateRequest>();
  const changeStateRequest$: Observable<ChangeStateRequest> =
    changeStateRequestSubject.asObservable();

  const stateMessageSubject = new Subject<StateMessage>();
  const stateMessage$ = stateMessageSubject.asObservable();

  rxSocketProto({
    db,
    message$,
    stateMessage$,
  }).subscribe((outcomingCommand) => {
    switch (outcomingCommand.type) {
      case "SendStateQuery":
        console.log("SendStateQuery", outcomingCommand);
        changeStateRequestSubject.next(outcomingCommand.request);
        break;
      case "SendServerMessage":
        console.log("SendServerMessage", outcomingCommand);
    }
  });

  rxStateProto(changeStateRequest$).subscribe((stateMessage) => {
    console.log(stateMessage);
    stateMessageSubject.next(stateMessage);
  });

  messageSubject.next({
    type: "SignInWithEmailAndPasswordIncoming",
    email: "kosmogradsky@gmail.com",
    password: "1234567",
  });
  messageSubject.next({
    type: "SubscribeToQueueLength",
  });

  setTimeout(() => {
    messageSubject.next({
      type: "EnterQueue",
    });
  }, 1000);
}

rxMainProto();
