const fs = require('fs');
const path = require('path');
const google = require('googleapis');

/**
 * Construct a new authenticated rules client.
 */
const RulesClient = function(authClient, projectId) {
  this.projectId = projectId;

  this.api = google.firebaserules({
    version: 'v1',
    auth: authClient
  });
};

/**
 * Test rules for syntactical correctness.
 */
RulesClient.prototype.test = function(rulesString) {
  const body = {
    source: {
      files: [
        {
          content: rulesString,
          name: 'firestore.rules'
        }
      ]
    }
  };

  const params = {
    name: `projects/${this.projectId}`,
    resource: body
  };

  return new Promise((resolve, reject) => {
    this.api.projects.test(params, (err, response) => {
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
};

/**
 * Sign in with environment credentials and get a rules client.
 *
 * See:
 * https://github.com/google/google-api-nodejs-client#choosing-the-correct-credential-type-automatically
 */
const getAuthenticatedRulesClient = () => {
  return new Promise((resolve, reject) => {
    google.auth.getApplicationDefault(function(err, authClient, projectId) {
      if (err) {
        reject(err);
        return;
      }

      if (
        authClient.createScopedRequired &&
        authClient.createScopedRequired()
      ) {
        authClient = authClient.createScoped([
          'https://www.googleapis.com/auth/cloud-platform',
          'https://www.googleapis.com/auth/firebase',
          'https://www.googleapis.com/auth/firebase.readonly'
        ]);
      }

      resolve(new RulesClient(authClient, projectId));
    });
  });
};

/**
 * Utility function to log a rules string and the response of the 'test' call.
 */
const logRequestResponse = (rulesString, response) => {
  const logMsg = `
Rules
------------------
${rulesString}

Response
------------------
${JSON.stringify(response)}
`;

  console.log(logMsg);
};

/**
 * Loop over the 'rules' directory and test each file.
 */
return getAuthenticatedRulesClient()
  .then(rulesClient => {
    const dirName = 'rules';
    const rulesFiles = fs.readdirSync(dirName);

    const promises = rulesFiles.map(f => {
      const filePath = path.join(dirName, f);
      const rulesString = fs.readFileSync(filePath).toString();

      // TODO: Return all promises.
      const testPromise = rulesClient.test(rulesString).then(response => {
        logRequestResponse(rulesString, response);

        if (response.issues) {
          const err = `Invalid rules in ${filePath}: ${JSON.stringify(
            response
          )}`;

          return Promise.reject(err);
        }
      });

      return testPromise;
    });

    return Promise.all(promises);
  })
  .catch(err => {
    console.log(`Error: ${err}`);
    exit(1);
  });
