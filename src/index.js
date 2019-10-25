const BUG_TIME_THRESH = 1 * 60 * 1000;
const test_channel = process.env["TEST_CHANNEL"];

const axios = require('axios');
const pluralz = require('./pluralz');
const slackz = require('./slackz');
const users = require('./users');

// Main event function handler
exports.main = async (req, res) => {
  const { body, query } = req;
  console.log(body);
  console.log(query);

  // Allow re-verification of URL by Slack
  if (body.challenge) {
    res.status(200).send(body.challenge);
    return;
  } else if (query.action === 'event' && body.event) {
    await handleEvent(body.event);
  } else if (query.action === 'response' && body.payload) {
    await handleResponse(body.payload);
  } else if (query.action === 'command') {
    await handleCommand(body);
  }

  res.status(200).send('');
};

function eventInScope(event) {
  return (
    event.channel === test_channel &&
    event.type === "message" && !event.subtype
  );
}

function logResponse(response, name="request") {
  console.log(`Response for ${name}:`, response.data);
}

function timeToBugAgain(buggedAt) {
  return (new Date() - buggedAt) > BUG_TIME_THRESH;
}

async function handleEvent(event) {
  const { ts, text, channel, user: userId } = event;
  if (!eventInScope(event)) { return; }
  if (!pluralz.hasPlural(text)) { return; }

  const user = await users.find_or_create(userId);
  const userData = user.data();
  if (userData.participation === 'ignore') {
    console.log(`Pluralz: ignore user ${userId}.`)
    return;
  } else if (userData.participation === 'autocorrect' && userData.token) {
    console.log(`Pluralz: correct user ${userId}.`)
    correctPluralz({ ts, text, channel, token: userData.token });
  } else if (!user.participation || timeToBugAgain(userData.bugged_at)) {
    console.log(`Pluralz: time to bug user ${userId}!`)
    suggestPluralz({ userId, channel });
  } else {
    console.log(`Pluralz: we're hiding from user ${userId}.`)
    return;
  }
}

async function handleResponse(payloadStr) {
  const payload = JSON.parse(payloadStr);
  if (payload.type !== "block_actions") { return; }

  const { user, response_url, actions } = payload;
  const action = actions[0] || {};
  const value = action.value;
  if (!user || !user.id) { return; }

  console.log(`Setting user ${user} to ${value}`);

  users.setParticipation(user.id, value);
  axios(slackz.acknowledgePrefs({ value, response_url })).then(response => {
    logResponse(response, "user interaction");
  })
}

async function handleCommand({ user_id: userId, channel_id: channel }) {
  axios(slackz.settingsInquiry({ userId, channel })).then(response => {
    users.touch(userId);
    logResponse(response, "suggestion");
  });
}

function suggestPluralz({ userId, channel }) {
  axios(slackz.suggestion({ userId, channel })).then(response => {
    users.touch(userId);
    logResponse(response, "suggestion");
  });
}

function correctPluralz({ ts, text, channel, token }) {
  axios(slackz.correction({ ts, text, channel, token })).then(response => {
    logResponse(response, "correction");
  });
}
