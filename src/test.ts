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
        title: 'Story 1'
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
        title: 'Story 1',
        content: 'The quick brown fox...',
        roles: {
          owneruser: 'owner',
          writeruser: 'writer',
          readeruser: 'reader'
        }
      },
      collections: {}
    },
    {
      key: 'storywithcomments',
      fields: {
        title: 'Story With Comments',
        content: 'The quick brown fox...',
        roles: {
          owneruser: 'owner',
          readeruser: 'reader',
          commenteruser: 'commenter'
        }
      },
      collections: {
        comments: [
          {
            key: 'comment1',
            fields: {
              text: 'This is a comment',
              user: 'randomuser'
            },
            collections: {}
          }
        ]
      }
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

describe('[Basic Rules]', () => {
  let database: any;

  before(async () => {
    database = await getAuthenticatedDb();
  });

  afterEach(() => {
    database.setData({});
    database.setRules('');
  });

  it('should allow a read at any path to open rules', async () => {
    database.setData(basicData);
    database.setRulesFromFile(getRulesFilePath('../rules/open.rules'));

    const readAllowed = await database.canGet({}, 'any/path');
    expectFirestore.assert(readAllowed);
  });

  it('should deny a read any any path to closed rules', async () => {
    database.setData(basicData);
    database.setRulesFromFile(getRulesFilePath('../rules/closed.rules'));

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
    database.setData({});
    database.setRules('');
  });

  it('[step2] owners can create stories', async () => {
    database.setData(rbacData);
    database.setRulesFromFile(
      getRulesFilePath('../rules/solution-rbac/step2.rules')
    );

    const auth = {
      uid: 'user1234'
    };

    const ownerStory = {
      title: 'New Story',
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
    database.setData(rbacData);
    database.setRulesFromFile(
      getRulesFilePath('../rules/solution-rbac/step2.rules')
    );

    const auth = {
      uid: 'user1234'
    };

    const readerStory = {
      title: 'New Story',
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
    database.setData(rbacData);
    database.setRulesFromFile(
      getRulesFilePath('../rules/solution-rbac/step3.rules')
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

  it('[step4] any role can read comments', async () => {
    database.setData(rbacData);
    database.setRulesFromFile(
      getRulesFilePath('../rules/solution-rbac/step4.rules')
    );

    const readerAllowed = await database.canGet(
      { uid: 'readeruser' },
      'stories/storywithcomments/comments/comment1'
    );
    expectFirestore.assert(readerAllowed);
  });

  it('[step4] commenter can create comments', async () => {
    database.setData(rbacData);
    database.setRulesFromFile(
      getRulesFilePath('../rules/solution-rbac/step4.rules')
    );

    const commenterAllowed = await database.canSet(
      { uid: 'commenteruser' },
      'stories/storywithcomments/comments/comment2',
      {
        user: 'commenteruser',
        text: 'A new comment!'
      }
    );
    expectFirestore.assert(commenterAllowed);
  });

  it('[step4] reader cannot create comments', async () => {
    database.setData(rbacData);
    database.setRulesFromFile(
      getRulesFilePath('../rules/solution-rbac/step4.rules')
    );

    const readerNotAllowed = await database.cannotSet(
      { uid: 'readeruser' },
      'stories/storywithcomments/comments/comment2',
      {
        user: 'readeruser',
        text: 'A new comment!'
      }
    );
    expectFirestore.assert(readerNotAllowed);
  });

  it('[step4] comments must have the right user id', async () => {
    database.setData(rbacData);
    database.setRulesFromFile(
      getRulesFilePath('../rules/solution-rbac/step4.rules')
    );

    const mismatchNotAllowed = await database.cannotSet(
      { uid: 'commenteruser' },
      'stories/storywithcomments/comments/comment2',
      {
        user: 'commenteruser-blah',
        text: 'A new comment!'
      }
    );
    expectFirestore.assert(mismatchNotAllowed);
  });

  // This will pass after this issue is fixed:
  // https://github.com/GitbookIO/expect-firestore/issues/14

  // it('[step5] writer can update content only', async () => {
  //   database.setData(rbacData);
  //   database.setRulesFromFile(
  //     getRulesFilePath('../rules/solution-rbac/step5.rules')
  //   );

  //   const writerAllowed = await database.canUpdate(
  //     { uid: 'writeruser' },
  //     'stories/story1',
  //     {
  //       content: 'Something new!'
  //     }
  //   );

  //   expectFirestore.assert(writerAllowed);
  // });

  it('[step5] writer cannot update title', async () => {
    database.setData(rbacData);
    database.setRulesFromFile(
      getRulesFilePath('../rules/solution-rbac/step5.rules')
    );

    const writerNotAllowed = await database.cannotUpdate(
      { uid: 'writeruser' },
      'stories/story1',
      {
        title: 'A new name'
      }
    );

    expectFirestore.assert(writerNotAllowed);
  });
});
