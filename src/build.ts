/*
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';
import { auth } from 'google-auth-library';

const recursiveReadSync = require('recursive-readdir-sync');

class RulesClient {
  projectId: string;
  api: any;

  constructor(authClient: any, projectId: string) {
    this.projectId = projectId;
    this.api = google.firebaserules({
      version: 'v1',
      auth: authClient
    });
  }

  /**
   * Test rules for syntactical correctness.
   */
  test(rulesString: string): Promise<any> {
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
      this.api.projects.test(params, (err: any, response: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });
  }
}

class BuildRulesTest {
  /**
   * Sign in with environment credentials and get a rules client.
   *
   * See:
   * https://github.com/google/google-api-nodejs-client#choosing-the-correct-credential-type-automatically
   */
  static getAuthenticatedRulesClient(): Promise<RulesClient> {
    return new Promise((resolve, reject) => {
      google.auth.getApplicationDefault(function(
        err: any,
        authClient: any,
        projectId: string
      ) {
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
  }

  /**
   * Utility function to log a rules string and the response of the 'test' call.
   */
  static logRequestResponse(
    fileName: string,
    rulesString: string,
    response: any
  ) {
    const logMsg = `
Rules (${fileName})
------------------
${rulesString}

Response
------------------
${JSON.stringify(response.data, undefined, 2)}
`;

    console.log(logMsg);
  }
}

/**
 * Loop over the 'rules' directory and test each file.
 */
BuildRulesTest.getAuthenticatedRulesClient()
  .then(rulesClient => {
    const dirName = 'rules';
    const rulesFiles = recursiveReadSync(dirName);
    const promises = rulesFiles.map((f: string) => {
      const expectInvalid = f.indexOf('invalid') >= 0;
      const rulesString = fs.readFileSync(f).toString();

      const testPromise = rulesClient.test(rulesString).then(response => {
        BuildRulesTest.logRequestResponse(f, rulesString, response);

        const resData = response.data;
        if (!expectInvalid && resData.issues) {
          const err = `Invalid rules in ${f}`;
          return Promise.reject(err);
        } else if (expectInvalid && !resData.issues) {
          const err = `Expected invalid rules in ${f}.`;
          return Promise.reject(err);
        }

        return Promise.resolve();
      });

      return testPromise;
    });

    return Promise.all(promises);
  })
  .catch(err => {
    console.log(`Error: ${err}`);
    process.exit(1);
  });
