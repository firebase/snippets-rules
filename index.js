const google = require("googleapis");

function testRules(authClient, projectId) {
  console.log("PROJECT ID:" + projectId);

  const rules = google.firebaserules({
    version: "v1",
    auth: authClient
  });

  const rulesString = `
    service cloud.firestore {
      match /databases/{database}/documents {
        match /{document=**} {
          allow read, write;
        }
      }
    }`;

  const body = {
    source: {
      files: [
        {
          content: rulesString,
          name: "firestore.rules"
        }
      ]
    }
  };

  const params = {
    name: `projects/${projectId}`,
    resource: body
  };

  rules.projects.test(params, function(err, response) {
    if (err) {
      throw err;
    }

    console.log("Response", response);
  });
}

/**
 * See:
 * https://github.com/google/google-api-nodejs-client#choosing-the-correct-credential-type-automatically
 */
google.auth.getApplicationDefault(function(err, authClient, projectId) {
  if (err) {
    throw err;
  }

  if (authClient.createScopedRequired && authClient.createScopedRequired()) {
    authClient = authClient.createScoped([
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/firebase",
      "https://www.googleapis.com/auth/firebase.readonly"
    ]);
  }

  testRules(authClient, projectId);
});
