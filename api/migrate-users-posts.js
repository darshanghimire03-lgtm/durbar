const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://darbarhigh-4c642-default-rtdb.firebaseio.com",
});

const rtdb = admin.database();
const firestore = admin.firestore();

async function copyNode(node, collection) {
  const snapshot = await rtdb.ref(node).get();
  const data = snapshot.val() || {};
  let batch = firestore.batch();
  let pending = 0;
  let total = 0;

  for (const [id, value] of Object.entries(data)) {
    if (value === null || typeof value !== "object") continue;
    batch.set(firestore.collection(collection).doc(id), value);
    pending++;
    total++;
    if (pending === 400) {
      await batch.commit();
      batch = firestore.batch();
      pending = 0;
    }
  }

  if (pending > 0) await batch.commit();
  console.log(collection + ": " + total + " documents copied");
}

(async () => {
  await copyNode("users", "users");
  await copyNode("posts", "posts");
  process.exit(0);
})();