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
import 'mocha';
import 'babel-polyfill';

import { expect } from 'chai';

import * as path from 'path';

const expectFirestore = require('expect-firestore');
const serviceAccount = require('../service-account.json');

const basicData = {
  stories: [
    {
      key: 'story1',
      fields: {
        name: 'Story 1'
      },
      collections: {}
    }
  ]
};

const rbacData = {
  stories: [
    {
      key: 'story1',
      fields: {
        name: 'Story 1',
        roles: {
          owneruser: 'owner',
          readeruser: 'reader'
        }
      },
      collections: {}
    }
  ]
};

async function getAuthenticatedDb() {
  const database = new expectFirestore.Database({
    credential: serviceAccount
  });

  await database.authorize();

  return database;
}

function getRulesFilePath(name: string): string {
  return path.join(__dirname, name);
}

function clearMockData(database: any) {
  database.setData({});
  database.setRules('');
}

function setMockDataAndRules(database: any, data: any, rulesFile: string) {
  database.setData(data);
  database.setRulesFromFile(getRulesFilePath(rulesFile));
}

describe('[Basic Rules]', () => {
  let database: any;

  before(async () => {
    database = await getAuthenticatedDb();
  });

  afterEach(() => {
    clearMockData(database);
  });

  it('should allow a read at any path to open rules', async () => {
    setMockDataAndRules(database, basicData, '../rules/open.rules');

    const readAllowed = await database.canGet({}, 'any/path');
    expectFirestore.assert(readAllowed);
  });

  it('should deny a read any any path to closed rules', async () => {
    setMockDataAndRules(database, basicData, '../rules/closed.rules');

    const readNotAllowed = await database.cannotGet({}, 'any/path');
    expectFirestore.assert(readNotAllowed);
  });
});

describe('[RBAC Rules]', () => {
  let database: any;

  before(async () => {
    database = await getAuthenticatedDb();
  });

  afterEach(() => {
    clearMockData(database);
  });

  it('[step2] owners can create stories', async () => {
    setMockDataAndRules(
      database,
      rbacData,
      '../rules/solution-rbac/step2.rules'
    );

    const auth = {
      uid: 'user1234'
    };

    const ownerStory = {
      name: 'New Story',
      roles: {
        user1234: 'owner'
      }
    };

    const ownerAllowed = await database.canSet(
      auth,
      'stories/newstory',
      ownerStory
    );
    expectFirestore.assert(ownerAllowed);
  });

  it('[step2] readers cannot create stories', async () => {
    setMockDataAndRules(
      database,
      rbacData,
      '../rules/solution-rbac/step2.rules'
    );

    const auth = {
      uid: 'user1234'
    };

    const readerStory = {
      name: 'New Story',
      roles: {
        user1234: 'reader'
      }
    };

    const readerNotAllowed = await database.cannotSet(
      auth,
      'stories/newstory',
      readerStory
    );
    expectFirestore.assert(readerNotAllowed);
  });

  it('[step3] any role should be allowed to read stories', async () => {
    setMockDataAndRules(
      database,
      rbacData,
      '../rules/solution-rbac/step3.rules'
    );

    const ownerAllowed = await database.canGet(
      { uid: 'owneruser' },
      'stories/story1'
    );
    expectFirestore.assert(ownerAllowed);

    const readerAllowed = await database.canGet(
      { uid: 'readeruser' },
      'stories/story1'
    );
    expectFirestore.assert(readerAllowed);

    const strangerNotAllowed = await database.cannotGet(
      { uid: 'stranger' },
      'stories/story1'
    );
    expectFirestore.assert(strangerNotAllowed);
  });
});
