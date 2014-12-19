ExpressSessionMongoDB
=====================

Implementation of the store functionality conforming to the API specified in express-session project (https://github.com/expressjs/session).

This implementation uses the MongoDB database.

Requirements
============

- A recent version of MongoDB (version 2.4.9 is installed on my machine) *

- A recent version of Node.js (version 0.10.25 is installed on my machine) *

- npm if you want the easy way to install this module.

- Read the package.json file for other dependencies. The devDependencies are solely to run the tests and not required for production.

* Later versions should also work. If you find it not to be the case, let me know.

Installation
============

npm install express-session-mongodb

Running Tests
=============

In the directory where the module is located, run the following 2 commands on the prompt:

- npm install
- npm test

Usage
=====

Example of the usage pattern for this module:

```javascript
var Mongodb = require('mongodb');
var Store = require('express-session-mongodb');
var ExpressSession = require('express-session');
var Express = require('express');
var App = Express();
//Probably Some code

var StoreOptions = {'TimeToLive': 0, 'IndexSessionID': false}; //Read more below
MongoDB.MongoClient.connect("mongodb://localhost:27017/SomeDatabase", function(Err, DB) { //Obviously, your code will probably differ here
    Store(DB, function(Err, SessionStore) {
        var Options = {'secret': 'qwerty!', 'store': SessionStore}; //Look at the express-session project to find out all the options you can pass here
        App.use(ExpressSession(Options);
        
        //Probably more code

    }, StoreOptions);
});
```

The express-session-mongodb module returns a function with the following signature:

```javascript
function(<DBHandle>, <Callback>, <Options>);
```

'DBHandle' is the database handle that the store will operate on. It should be obtained using the MongoDB driver.
'Callback' is the function that will be called when the session store instance (and its underlying database collection/index dependencies) have been created.
'Options' are the options you can pass to the session store instance.

'Options' is an object with the following properties:

SessionID: Can be either true or false (default). If true, session IDs will be indexed with a unique requirement in the MongoDB database, making the creation of sessions slower, but their access faster. It will also report an error if 2 sessions with duplicate IDs are generated.
TimeToLive: Integer than can be 0 (default) or greater. If greater than 0, a Time-to-Live index will be set which will represent how long (in seconds) a session can be idle in the database (neither written to nor accessed) before MongoDB deletes it.
Note that according to the author of "MongoDB: The Definitive Guide", MongoDB check on Time-To-Live indexes about once per minute, so you should not rely on a session getting deleted the exact second it expires.


'Callback' takes the following signature: 

```javascript
function(<Err>, <StoreInstance>)
```

'Err' is null if no error occured (otherwise it contains the error object).
'StoreInstance' is the resulting store instance you can pass to express-session.

Future
======

Immediate plans for this module include more integration tests (internal tests are finished) to cover the following cases:

- Running the tests for all possible option permutations you can pass to express-session during the initialization.
- Running tests when the database is down.
- Running tests with TimeToLive > 0, to ensure that express-session handles session getting delete from the database by MongoDB gracefully.
- Running tests with IndexSessionID set to true, to ensure that express-session properly bubble ups the potential error that occurs with duplicate session IDs and allows the user to set a handler for it.

Longer term plans include implementing further useful options you can pass to the constructor as well as an evented API. 
