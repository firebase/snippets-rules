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

import * as assert from 'assert';
import * as fs from 'fs';
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

function getRulesFile(name: string): string {
  const filePath = path.join(__dirname, name);
  return fs.readFileSync(filePath).toString();
}

function clearMockData(database: any) {
  // TODO: should not have to call both .data and .collections
  database.data = undefined;
  database.collections = undefined;
  database.rules = undefined;
}

function setMockDataAndRules(database: any, data: any, rulesFile: string) {
  database.data = data;
  database.collections = data;
  database.rules = getRulesFile(rulesFile);
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

    const allowed = await database.canGet({}, 'any/path');
    assert.ok(allowed, 'Read is allowed');
  });

  it('should deny a read any any path to closed rules', async () => {
    setMockDataAndRules(database, basicData, '../rules/closed.rules');

    const allowed = await database.canGet({}, 'any/path');
    assert.ok(!allowed, 'Read is not allowed');
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

  it('[step2] only owners should be allowed to create stories', async () => {
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

    const readerStory = {
      name: 'New Story',
      roles: {
        user1234: 'reader'
      }
    };

    const ownerAllowed = await database.canSet(
      auth,
      'stories/newstory',
      ownerStory
    );
    assert.ok(ownerAllowed, 'Owner story is allowed.');

    const readerAllowed = await database.canSet(
      auth,
      'stories/newstory',
      readerStory
    );
    assert.ok(!readerAllowed, 'Reader story is not allowed.');
  });
});
