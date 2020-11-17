/*
 * Copyright 2020 Google Inc. All Rights Reserved.
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

import * as firebase from '@firebase/rules-unit-testing';

import { readRulesFile, getAuthedDb } from './util';

const rbacData = new Map([
  [
    'stories/story1',
    {
      title: 'Story 1',
      content: 'The quick brown fox...',
      roles: {
        owneruser: 'owner',
        writeruser: 'writer',
        readeruser: 'reader'
      }
    }
  ],
  [
    '/stories/storywithcomments',
    {
      title: 'Story With Comments',
      content: 'The quick brown fox...',
      roles: {
        owneruser: 'owner',
        readeruser: 'reader',
        commenteruser: 'commenter'
      }
    }
  ],
  [
    '/stories/storywithcomments/comments/comment1',
    {
      text: 'This is a comment',
      user: 'randomuser'
    }
  ]
]);

describe('[RBAC Rules]', () => {
  async function loadRbacRules(name: string) {
    await firebase.loadFirestoreRules({
      projectId: 'rbac-rules',
      rules: readRulesFile(`../rules/solution-rbac/${name}.rules`)
    });
  }

  beforeEach(async () => {
    const db = firebase
      .initializeAdminApp({
        projectId: 'rbac-rules'
      })
      .firestore();

    for (let [docPath, docData] of rbacData) {
      await db.doc(docPath).set(docData);
    }
  });

  afterEach(async () => {
    await Promise.all(firebase.apps().map(app => app.delete()));
  });

  it('[step2] owners can create stories', async () => {
    await loadRbacRules('step2');

    const db = getAuthedDb('rbac-rules', 'user1234');

    const ownerStory = {
      title: 'New Story',
      roles: {
        user1234: 'owner'
      }
    };

    await firebase.assertSucceeds(db.collection('stories').add(ownerStory));
  });

  it('[step2] readers cannot create stories', async () => {
    await loadRbacRules('step2');

    const db = getAuthedDb('rbac-rules', 'user1234');

    const readerStory = {
      title: 'New Story',
      roles: {
        user1234: 'reader'
      }
    };

    await firebase.assertFails(db.collection('stories').add(readerStory));
  });

  it('[step3] any known role should be allowed to read stories', async () => {
    await loadRbacRules('step3');

    const ownerDb = getAuthedDb('rbac-rules', 'owneruser');
    await firebase.assertSucceeds(
      ownerDb
        .collection('stories')
        .doc('story1')
        .get()
    );

    const readerDb = getAuthedDb('rbac-rules', 'readeruser');
    await firebase.assertSucceeds(
      readerDb
        .collection('stories')
        .doc('story1')
        .get()
    );

    const strangerDb = getAuthedDb('rbac-rules', 'stranger');
    await firebase.assertFails(
      strangerDb
        .collection('stories')
        .doc('story1')
        .get()
    );
  });

  it('[step4] any role can read comments', async () => {
    await loadRbacRules('step4');

    const db = getAuthedDb('rbac-rules', 'readeruser');
    await firebase.assertSucceeds(
      db
        .collection('stories')
        .doc('storywithcomments')
        .collection('comments')
        .doc('comment1')
        .get()
    );
  });

  it('[step4] commenter can create comments', async () => {
    await loadRbacRules('step4');

    const db = getAuthedDb('rbac-rules', 'commenteruser');
    await firebase.assertSucceeds(
      db
        .collection('stories')
        .doc('storywithcomments')
        .collection('comments')
        .add({
          user: 'commenteruser',
          text: 'A new comment!'
        })
    );
  });

  it('[step4] reader cannot create comments', async () => {
    await loadRbacRules('step4');

    const db = getAuthedDb('rbac-rules', 'readeruser');
    await firebase.assertFails(
      db
        .collection('stories')
        .doc('storywithcomments')
        .collection('comments')
        .add({
          user: 'commenteruser',
          text: 'A new comment!'
        })
    );
  });

  it('[step4] comments must have the right user id', async () => {
    await loadRbacRules('step4');

    const db = getAuthedDb('rbac-rules', 'commenteruser');
    await firebase.assertFails(
      db
        .collection('stories')
        .doc('storywithcomments')
        .collection('comments')
        .doc('comment2')
        .set({
          user: 'commenteruser-blah',
          text: 'A new comment!'
        })
    );
  });

  it('[step5] writer can update content only', async () => {
    await loadRbacRules('step5');

    const db = getAuthedDb('rbac-rules', 'writeruser');
    await firebase.assertSucceeds(
      db
        .collection('stories')
        .doc('story1')
        .update({
          content: 'Something new!'
        })
    );
  });

  it('[step5] writer cannot update title', async () => {
    await loadRbacRules('step5');

    const db = getAuthedDb('rbac-rules', 'writeruser');
    await firebase.assertFails(
      db
        .collection('stories')
        .doc('story1')
        .update({
          title: 'A new name'
        })
    );
  });

  it('[step5] writer cannot add fields', async () => {
    await loadRbacRules('step5');

    const db = getAuthedDb('rbac-rules', 'writeruser');
    await firebase.assertFails(
      db
        .collection('stories')
        .doc('story1')
        .update({
          secret_field: 'An invalid field'
        })
    );
  });

  it('[step5] writer cannot remove fields', async () => {
    await loadRbacRules('step5');

    const db = getAuthedDb('rbac-rules', 'writeruser');
    await firebase.assertFails(
      db
        .collection('stories')
        .doc('story1')
        .update({
          content: firebase.firestore.FieldValue.delete()
        })
    );
  });

  it('[step5] writer cannot swap fields', async () => {
    await loadRbacRules('step5');

    const db = getAuthedDb('rbac-rules', 'writeruser');
    await firebase.assertFails(
      db
        .collection('stories')
        .doc('story1')
        .update({
          content: firebase.firestore.FieldValue.delete(),
          'invalid-content': 'Same number of fields, but different'
        })
    );
  });
});
