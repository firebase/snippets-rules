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

const mockData = {
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

function getRulesFile(name: string): string {
  const filePath = path.join(__dirname, name);
  return fs.readFileSync(filePath).toString();
}

describe('[Basic Rules]', () => {
  let database: any;

  before(async () => {
    database = new expectFirestore.Database({
      credential: serviceAccount
    });

    await database.authorize();
  });

  afterEach(() => {
    // TODO: should not have to call both .data and .collections
    database.data = undefined;
    database.collections = undefined;
    database.rules = undefined;
  });

  it('should allow a read at any path to open rules', async () => {
    const rules = getRulesFile('../rules/open.rules');

    database.data = mockData;
    database.collections = mockData;
    database.rules = rules;

    const allowed = await database.canGet({}, 'any/path');
    assert.ok(allowed, 'Read is allowed');
  });

  it('should deny a read any any path to closed rules', async () => {
    const rules = getRulesFile('../rules/closed.rules');

    database.data = mockData;
    database.collections = mockData;
    database.rules = rules;

    const allowed = await database.canGet({}, 'any/path');
    assert.ok(!allowed, 'Read is not allowed');
  });
});
