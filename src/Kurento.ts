import * as websocket from "ws";
import * as admin from "firebase-admin";
import * as kurento from "kurento-client";
import { v4 } from "uuid";

interface Session {
  socket: websocket;
  mediaPipeline?: kurento.MediaPipeline;
  webRtcEndpoint?: kurento.WebRtcEndpoint;
  candidatesQueue: kurento.IceCandidate[];
}

async function main() {
  const sessions = new Map<string, Session>();
  const kurentoClient = await kurento("ws://84.201.133.103:49153/kurento");

  async function startKurento(sdpOffer: string, session: Session) {
    const mediaPipeline = await kurentoClient.create("MediaPipeline");
    const webRtcEndpoint = await mediaPipeline.create("WebRtcEndpoint");

    session.mediaPipeline = mediaPipeline;
    session.webRtcEndpoint = webRtcEndpoint;

    webRtcEndpoint.on("OnIceCandidate", function (event) {
      const candidate = kurento.getComplexType("IceCandidate")(event.candidate);

      session.socket.send(
        JSON.stringify({
          id: "iceCandidate",
          candidate: candidate,
        })
      );
    });

    console.log("Candidates queue has length ", session.candidatesQueue.length);
    while (session.candidatesQueue.length) {
      const candidate = session.candidatesQueue.shift()!;

      webRtcEndpoint.addIceCandidate(candidate as any);
    }

    await webRtcEndpoint.connect(webRtcEndpoint, undefined);

    const sdpAnswer = await webRtcEndpoint.processOffer(sdpOffer);
    session.socket.send(
      JSON.stringify({
        type: "sdpAnswer",
        sdp: sdpAnswer,
      })
    );

    await webRtcEndpoint.gatherCandidates();
  }

  function stopKurento(sessionId: string): void {
    const session = sessions.get(sessionId);

    if (session?.mediaPipeline !== undefined) {
      console.log(`Releasing pipeline for session ${sessionId}`);
      session.mediaPipeline.release();

      sessions.delete(sessionId);
    }
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL:
      "https://rvmafia-3f73f-default-rtdb.europe-west1.firebasedatabase.app",
  });

  admin
    .database()
    .ref("playersOnline")
    .on("value", (snapshot) => {
      console.log("playersOnline", snapshot.val());
    });

  const ws = new websocket.Server({ port: 8000 });

  ws.on("connection", (socket) => {
    const sessionId = v4();
    const session: Session = { candidatesQueue: [], socket };
    sessions.set(sessionId, session);
    console.log("Created session ", sessionId);

    socket.on("message", (data) => {
      const message = JSON.parse(data as string);

      switch (message.type) {
        case "sdpOffer": {
          try {
            startKurento(message.sdp, session);
          } catch (err) {
            if (session.mediaPipeline !== undefined) {
              session.mediaPipeline.release();
            }

            throw err;
          }
          break;
        }
        case "iceCandidate": {
          console.log(
            "Received an ICE candidate from client: \n",
            message.candidate
          );
          if (session.webRtcEndpoint !== undefined) {
            session.webRtcEndpoint.addIceCandidate(message.candidate);
          } else {
            session.candidatesQueue.push(message.candidate);
          }
          break;
        }
      }
    });

    socket.on("error", () => {
      console.log("Got an error in session ", sessionId);
      stopKurento(sessionId);
    });

    socket.on("close", () => {
      console.log("Closing session ", sessionId);
      stopKurento(sessionId);
    });
  });
}

main();
