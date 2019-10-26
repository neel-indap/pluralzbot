const Firestore = require('@google-cloud/firestore');
const PROJECTID = 'playground-252414';
const COLLECTION_NAME = '3playaz';
const firestore = new Firestore({
  projectId: PROJECTID,
});
const collection = firestore.collection(COLLECTION_NAME);

async function find(userId) {
  const result = await collection.where(
    'user_id', '==', String(userId)
  ).limit(1).get();
  return result.docs[0];
}

async function find_or_create(userId) {
  const user = await find(userId);
  if (user) { return user; }
  const ref = await collection.add({
    user_id: userId,
  });
  const newUser = await ref.get();
  return newUser;
}

async function touch(userId) {
  const ts = new Date();
  const user = await(find_or_create(userId));
  collection.doc(user.id).update({
    bugged_at: ts,
  });
}

async function setParticipation(userId, value) {
  const user = await(find_or_create(userId));
  collection.doc(user.id).update({
    participation: value,
  });
}

async function setToken(userId, token) {
  const user = await(find_or_create(userId));
  collection.doc(user.id).update({
    token: token,
  });
}

module.exports = {
  find,
  find_or_create,
  setParticipation,
  setToken,
  touch,
};