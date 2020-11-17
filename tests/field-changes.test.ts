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

describe('[Field Change Rules]', () => {
  before(async () => {
    await firebase.loadFirestoreRules({
      projectId: 'field-changes',
      rules: readRulesFile('../rules/field-changes/example.rules')
    });
  });

  beforeEach(async () => {
    const db = firebase
      .initializeAdminApp({
        projectId: 'field-changes'
      })
      .firestore();

    await db.doc('/docs/test').set({
      name: 'test-doc',
      age: 1
    });
  });

  it('should allow a read to any path', async () => {
    const db = getAuthedDb('field-changes', undefined);

    await firebase.assertSucceeds(
      db
        .collection('any')
        .doc('doc')
        .get()
    );
  });

  it('should allow a write to a non-name field', async () => {
    const db = getAuthedDb('field-changes', undefined);

    await firebase.assertSucceeds(
      db
        .collection('docs')
        .doc('test')
        .update('age', 2)
    );
  });

  it('should deny a write where name changes', async () => {
    const db = getAuthedDb('field-changes', undefined);

    await firebase.assertFails(
      db
        .collection('docs')
        .doc('test')
        .update('name', 'sam')
    );
  });

  it('should deny a write where a field is added', async () => {
    const db = getAuthedDb('field-changes', undefined);

    await firebase.assertFails(
      db
        .collection('docs')
        .doc('test')
        .set({
          name: 'test-doc',
          age: 1,
          other: 'new-data'
        })
    );
  });
});
