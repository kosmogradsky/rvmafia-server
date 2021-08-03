import * as admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL:
    "https://rvmafia-3f73f-default-rtdb.europe-west1.firebasedatabase.app",
});

admin
  .firestore()
  .collection("players")
  .get()
  .then((response) => {
    console.log(response);
  });
