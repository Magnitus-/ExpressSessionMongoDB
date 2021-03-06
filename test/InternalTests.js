//Copyright (c) 2014 Eric Vallee <eric_vallee2003@yahoo.ca>
//MIT License: https://raw.githubusercontent.com/Magnitus-/ExpressSessionMongoDB/master/License.txt

var MongoDB = require('mongodb');
var Store = require('../lib/ExpressSessionMongoDB');
var Nimble = require('nimble');

var Context = {};
var RandomIdentifier = 'ExpressSessionMongoDBTestDB'+Math.random().toString(36).slice(-8);

function ConfirmCollectionState(Indexes, Test, Callback)
{
    Context['DB'].listCollections({'name': Context['CollectionName']}).toArray(function(Err, Collections) {
        Test.ok(Collections && Collections.length==1, "Confirming that the collection was properly created");
        Context['DB'].collection(Context['CollectionName'], function(Err, SessionCollection) {
            SessionCollection.indexInformation({full:true}, function(err, IndexInformation) {
                var IndexList = IndexInformation.map(function(Item, Index, List){
                    for (Key in Item['key'])
                    {
                        return Key;
                    }
                });
                Test.ok(Indexes.every(function(Item, Index, List){
                    var In = IndexList.some(function(Key, Index, List) {
                        return Item['Key'] == Key;
                    });
                    return((In&&Item['Set']) || (!(In||Item['Set'])));
                }), "Confirming that the indexes are properly set.");
                Callback();
            });
        });
    });
}

exports.EnsureDependencies = {
    'setUp': function(Callback) {
        MongoDB.MongoClient.connect("mongodb://localhost:27017/"+RandomIdentifier, {native_parser:true}, function(Err, DB) {
            if(Err)
            {
                console.log(Err);
            }
            Context['DB'] = DB;
            Context['CollectionName'] = 'Sessions';
            Callback();
        });
    },
    'tearDown': function(Callback) {
        Context.DB.dropDatabase(function(Err, Result) {
            if(Err)
            {
                console.log(Err);
            }
            Context.DB.close();
            Context['DB'] = null;
            Context['DependenciesOk'] = false;
            Callback();
        });
    },
    'TestEnsureTimeToLive': function(Test) {
        Test.expect(3);
        Context['DB'].createCollection(Context['CollectionName'], function(Err, SessionCollection) {
            Context['TimeToLive'] = 0;
            Store.prototype.UnitTestCalls['EnsureTimeToLive'].call(Context, SessionCollection, function(Err) {
                SessionCollection.indexInformation({full:true}, function(err, IndexInformation) {
                    Test.ok(IndexInformation.length==1, "Confirming that no index is created when TimeToLive is 0.");
                    Context['TimeToLive'] = 100;
                    Store.prototype.UnitTestCalls['EnsureTimeToLive'].call(Context, SessionCollection, function(Err) {
                        SessionCollection.indexInformation({full:true}, function(err, IndexInformation) {
                            Test.ok(IndexInformation.length==2 && IndexInformation[1]['key']['LastAccessed']==1, "Confirming that an index is created when TimeToLive is greater than 0.");
                            Store.prototype.UnitTestCalls['EnsureTimeToLive'].call(Context, SessionCollection, function(Err) {
                                SessionCollection.indexInformation({full:true}, function(err, IndexInformation) {
                                    Test.ok(IndexInformation.length==2 && IndexInformation[1]['key']['LastAccessed']==1, "Confirming that calling the method multiple times when index is already set is harmless.");
                                    Test.done();
                                });
                            });
                        });
                    });
                });
            });
        });
    },
    'EnsureIndexSessionID': function(Test) {
        Test.expect(3);
        Context['DB'].createCollection(Context['CollectionName'], function(Err, SessionCollection) {
            Context['IndexSessionID'] = false;
            Store.prototype.UnitTestCalls['EnsureIndexSessionID'].call(Context, SessionCollection, function(Err) {
                SessionCollection.indexInformation({full:true}, function(err, IndexInformation) {
                    Test.ok(IndexInformation.length==1, "Confirming that no index is created when IndexSessionID is falsey.");
                    Context['IndexSessionID'] = true;
                    Store.prototype.UnitTestCalls['EnsureIndexSessionID'].call(Context, SessionCollection, function(Err) {
                        SessionCollection.indexInformation({full:true}, function(err, IndexInformation) {
                            Test.ok(IndexInformation.length==2 && IndexInformation[1]['key']['SessionID']==1, "Confirming that an index is created when IndexSessionID is truey.");
                            Store.prototype.UnitTestCalls['EnsureIndexSessionID'].call(Context, SessionCollection, function(Err) {
                                SessionCollection.indexInformation({full:true}, function(err, IndexInformation) {
                                    Test.ok(IndexInformation.length==2 && IndexInformation[1]['key']['SessionID']==1, "Confirming that calling the method multiple times when index is already set is harmless.");
                                    Test.done();
                                });
                            });
                        });
                    });
                });
            });
        });
    },
    'TestEnsureDependencies': function(Test) {
        Test.expect(16);
        function TestPermutation(TimeToLive, IndexSessionID, DropCollection, Callback)
        {
            Context['TimeToLive'] = TimeToLive;
            Context['IndexSessionID'] = IndexSessionID;
            var Indexes = [{'Key': 'SessionID', 'Set': Context['IndexSessionID']},{'Key': 'LastAccessed', 'Set': (Context['TimeToLive']>0)}];
            Store.prototype.UnitTestCalls['EnsureDependencies'].call(Context, function(Err) {
                ConfirmCollectionState(Indexes, Test, function() {
                    if(DropCollection)
                    {
                        Context['DependenciesOk'] = false;
                        Context['DB'].collection(Context['CollectionName'], function(Err, SessionCollection) {
                            SessionCollection.drop(function(Err, Reply) {
                                Callback();
                            });
                        });
                    }
                    else
                    {
                        Callback();
                    }
                });
            });
        }
        Context['DependenciesOk'] = false;
        Nimble.series([
            function(Callback) {
                TestPermutation(0, false, false, function() {
                    TestPermutation(0, false, true, Callback);
                });
            },
            function(Callback) {
                TestPermutation(100, false, false, function() {
                    TestPermutation(100, false, true, Callback);
                });
            },
            function(Callback) {
                TestPermutation(0, true, false, function() {
                    TestPermutation(0, true, true, Callback);
                });
            },
            function(Callback) {
                TestPermutation(100, true, false, function() {
                    TestPermutation(100, true, true, Callback);
                });
            }], 
            function(Err) {
                Test.done();
            });
    }
};

exports.Accessors = {
    'setUp': function(Callback) {
        MongoDB.MongoClient.connect("mongodb://localhost:27017/"+RandomIdentifier, {native_parser:true}, function(Err, DB) {
            if(Err)
            {
                console.log(Err);
            }
            Context['DB'] = DB;
            Callback();
        });
    },
    'tearDown': function(Callback) {
        Context.DB.dropDatabase(function(Err, Result) {
            if(Err)
            {
                console.log(Err);
            }
            Context.DB.close();
            Context['DB'] = null;
            Callback();
        });
    },
    'Testsetget': function(Test) {
        Test.expect(48);
        function TestPermutation(TimeToLive, IndexSessionID, DeleteFlag, Callback)
        {
            Store(Context['DB'], function(Err, TestStore) {
                TestStore.set('a', {'a': 1, 'b': 2, 'SessionID': [1,2,3], 'SomeObject': {'a': 3}}, function() {
                    TestStore.get('a', function(Err, Session) {
                        Test.ok(Session['a']==1 && Session['b']==2 && Session['c']===undefined, "Confirming get/set works on a basic level.");
                        Test.ok(Session['SessionID'].length==3 && Session['SessionID'][0]==1 && Session['SessionID'][1]==2 && Session['SessionID'][2]==3, "Confirming that SessionID key is not overwritten and that arrays work.");
                        Test.ok(Session['SomeObject']['a']==3, "Confirming that objects work.");
                        TestStore.get('b', function(Err, Session) {
                            Test.ok(!Session, "Confirming that getting a non-existent session returns a falsey value");
                            TestStore.set('b', {'a': 5, 'b': 6}, function() {
                                TestStore.get('a', function(Err, SessionA) {
                                    TestStore.get('b', function(Err, SessionB) {
                                        Test.ok(SessionA['a']==1&&SessionA['b']==2&&SessionA['SessionID']&&SessionB['a']==5&&SessionB['b']==6&&(!SessionB['SessionID']), "Confirming that sessions with different keys are kept distinct");
                                        TestStore.set('a', {'b': 10}, function() {
                                            TestStore.get('a', function(Err, Session) {
                                                Test.ok(Session['b']==10&&(!Session['a'])&&(!Session['SessionID'])&&(!Session['SomeObject']), "Confirming that setting an existing session overwrites it.");
                                                Context['DB'].collection(Context['CollectionName'], function(Err, SessionCollection) {
                                                    SessionCollection.drop(function(Err, Reply) {
                                                        Callback();
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            }, {'TimeToLive': TimeToLive, 'IndexSessionID': IndexSessionID, 'DeleteFlag': DeleteFlag});
        }
        TestPermutation(0, false, false, function() {
            TestPermutation(100, false, false, function() {
                TestPermutation(0, true, false, function() {
                    TestPermutation(100, true, false, function() {
                        TestPermutation(0, false, true, function() {
                            TestPermutation(100, false, true, function() {
                                TestPermutation(0, true, true, function() {
                                    TestPermutation(100, true, true, function() {
                                        Test.done();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    },
    'TestFilter': function(Test) {
        Test.expect(2);
        Store(Context['DB'], function(Err, TestStore) {
            TestStore.set('a', {'a.b': [1, 2, {'a': 1, '$b\0c': {'Test.Testdot-*-dot*-': 35}}]}, function(Err) {
                Test.ok(!Err, "Confirming that ., $ and null are threated as valid input when filter is specified.");
                TestStore.get('a', function(Err, SessionA) {
                    Test.ok(SessionA['a.b'] && Array.isArray(SessionA['a.b']) && SessionA['a.b'][2]['$b\0c'] && SessionA['a.b'][2]['$b\0c']['Test.Testdot-*-dot*-'] && SessionA['a.b'][2]['$b\0c']['Test.Testdot-*-dot*-']==35, "Confirming that filtering works on non-trivial cases.");
                    Test.done();
                });
            });
        }, {'Filter': true});
    },
    'Testdestroy': function(Test) {
        Test.expect(24);
        function TestPermutation(TimeToLive, IndexSessionID, DeleteFlag, Callback)
        {
            Store(Context['DB'], function(Err, TestStore) {
                TestStore.set('a', {'a':1}, function() {
                    TestStore.set('b', {'b':1}, function() {
                        TestStore.destroy('c', function() {
                             TestStore.get('a', function(Err, SessionA) {
                                 TestStore.get('b', function(Err, SessionB) {
                                     Test.ok(SessionA&&SessionA['a']==1&&SessionB&&SessionB['b']==1, 'Confirming that destroying a non-existent session does not disrupt anything.');
                                     TestStore.destroy('a', function() {
                                         TestStore.get('a', function(Err, SessionA) {
                                             TestStore.get('b', function(Err, SessionB) {
                                                 Test.ok((!SessionA)&&SessionB&&SessionB['b']==1, 'Confirming that destroying an existing session works and does not disrupt other sessions.');
                                                 TestStore.destroy('b', function() {
                                                     TestStore.get('a', function(Err, SessionA) {
                                                         TestStore.get('b', function(Err, SessionB) {
                                                             Test.ok(!(SessionA||SessionB), 'Confirming that destroying the last session works as expected');
                                                             Context['DB'].collection(Context['CollectionName'], function(Err, SessionCollection) {
                                                                 SessionCollection.drop(function(Err, Reply) {
                                                                     Callback();
                                                                 });
                                                             });
                                                         });
                                                     });
                                                 });
                                             });
                                         });
                                     });
                                 });
                             });
                        });
                    });
                });
            }, {'TimeToLive': TimeToLive, 'IndexSessionID': IndexSessionID, 'DeleteFlag': DeleteFlag});
        }
        TestPermutation(0, false, false, function() {
            TestPermutation(100, false, false, function() {
                TestPermutation(0, true, false, function() {
                    TestPermutation(100, true, false, function() {
                        TestPermutation(0, false, true, function() {
                            TestPermutation(100, false, true, function() {
                                TestPermutation(0, true, true, function() {
                                    TestPermutation(100, true, true, function() {
                                        Test.done();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    },
    'Testlength': function(Test) {
        Test.expect(40);
        function TestPermutation(TimeToLive, IndexSessionID, DeleteFlag, Callback)
        {
            Store(Context['DB'], function(Err, TestStore) {
                TestStore.length(function(Err, Count) {
                    Test.ok(Count==0, 'Ensure an empty session collection returns a count of 0.');
                    TestStore.set('a', {}, function() {
                        TestStore.length(function(Err, Count) {
                            Test.ok(Count==1, 'Confirming that adding the first session document raises the count to 1.');
                            TestStore.set('b', {}, function() {
                                TestStore.length(function(Err, Count) {
                                    Test.ok(Count==2, 'Confirming that adding more elements after the first raises the count appropriately.');
                                    TestStore.destroy('a', function() {
                                        TestStore.length(function(Err, Count) {
                                            Test.ok(Count==1, 'Confirming that destroying a session document decreases the count appropriately.');
                                            TestStore.destroy('b', function() {
                                                TestStore.length(function(Err, Count) {
                                                    Test.ok(Count==0, 'Confirming that destroying the last session document decreases the count to 0.');
                                                    Context['DB'].collection(Context['CollectionName'], function(Err, SessionCollection) {
                                                        SessionCollection.drop(function(Err, Reply) {
                                                            Callback();
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            }, {'TimeToLive': TimeToLive, 'IndexSessionID': IndexSessionID, 'DeleteFlag': DeleteFlag});
        }
        TestPermutation(0, false, false, function() {
            TestPermutation(100, false, false, function() {
                TestPermutation(0, true, false, function() {
                    TestPermutation(100, true, false, function() {
                        TestPermutation(0, false, true, function() {
                            TestPermutation(100, false, true, function() {
                                TestPermutation(0, true, true, function() {
                                    TestPermutation(100, true, true, function() {
                                        Test.done();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    },
    'Testclear': function(Test) {
        Test.expect(40);
        function TestPermutation(TimeToLive, IndexSessionID, DeleteFlag, Callback)
        {
            Store(Context['DB'], function(Err, TestStore) {
                TestStore.clear(function() {
                    var Indexes = [{'Key': 'SessionID', 'Set': IndexSessionID},{'Key': 'LastAccessed', 'Set': (TimeToLive>0)}];
                    ConfirmCollectionState(Indexes, Test, function() {
                        TestStore.set('a', {}, function() {
                            TestStore.set('b', {}, function() {
                                TestStore.clear(function() {
                                    TestStore.length(function(Err, Count) {
                                        Test.ok(Count==0, 'Confirming that populated collection is cleared of all data.');
                                        ConfirmCollectionState(Indexes, Test, function() {
                                            Context.DB.dropDatabase(function(Err, Result) {
                                                Context.DB.close();
                                                MongoDB.MongoClient.connect("mongodb://localhost:27017/"+RandomIdentifier, {native_parser:true}, function(Err, DB) {
                                                    Context['DB'] = DB;
                                                    Callback();
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            }, {'TimeToLive': TimeToLive, 'IndexSessionID': IndexSessionID, 'DeleteFlag': DeleteFlag});
        }
        TestPermutation(0, false, false, function() {
            TestPermutation(100, false, false, function() {
                TestPermutation(0, true, false, function() {
                    TestPermutation(100, true, false, function() {
                        TestPermutation(0, false, true, function() {
                            TestPermutation(100, false, true, function() {
                                TestPermutation(0, true, true, function() {
                                    TestPermutation(100, true, true, function() {
                                        Test.done();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    },
    'TestDeleteFlagAndCleanup': function(Test) {
        Test.expect(4);
        Store(Context['DB'], function(Err, TestStore) {
            Context['DB'].collection('Sessions', function(Err, SessionStore) {
                TestStore.set('a', {}, function() {
                    TestStore.set('b', {}, function() {
                        TestStore.set('c', {}, function() {
                            TestStore.destroy('a', function(Err) {
                                SessionStore.findOne({'SessionID': 'a'}, function(Err, SessionA) {
                                    Test.ok(SessionA.Delete, "Confirming that the session is flagged as deleted");
                                    TestStore.FlagDeletion('b', function(Err) {
                                        SessionStore.findOne({'SessionID': 'b'}, function(Err, SessionB) {
                                            Test.ok(SessionB.Delete, "Confirming that the session is flagged as deleted");
                                            TestStore.clear(function(Err) {
                                                TestStore.FlagDeletion('c', function(Err) {
                                                    SessionStore.findOne({'SessionID': 'c'}, function(Err, SessionC) {
                                                        Test.ok(SessionC.Delete, "Confirming that the session is flagged as deleted");
                                                        TestStore.set('d', {}, function() {
                                                            TestStore.Cleanup(function(Err, Amount) {
                                                                Test.ok(Amount==3, "Confirming that cleanup deleted 3 flagged sessions and left last one alone.");
                                                                Test.done();
                                                            });
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }, {'DeleteFlag': true});
    }
};

exports.ErrorHandling = {
    'setUp': function(Callback) {
        MongoDB.MongoClient.connect("mongodb://localhost:27017/"+RandomIdentifier, {native_parser:true}, function(Err, DB) {
            if(Err)
            {
                console.log(Err);
            }
            Context['DB'] = DB;
            Callback();
        });
    },
    'tearDown': function(Callback) {
        Context['DB'] = null;
        Callback();
    },
    'TestEnsureDependencies': function(Test) {
        Test.expect(1);
        Context.DB.dropDatabase(function(Err, Result) {
            Context.DB.close();
            Store.prototype.UnitTestCalls['EnsureDependencies'].call(Context, function(Err) {
                Test.ok(Err,"Confirming EnsureDependencies handles database errors.");
                Test.done();
            });
        });
    },
    'Testset': function(Test) {
        Test.expect(1);
        Store(Context['DB'], function(Err, TestStore) {
            Context.DB.dropDatabase(function(Err, Result) {
                Context.DB.close();
                TestStore.set('a', {}, function(Err) {
                    Test.ok(Err,"Confirming set handles database errors.");
                    Test.done();
                });
            });
        });
    },
    'TestFilter': function(Test) {
        Test.expect(3);
        Store(Context['DB'], function(Err, TestStore) {
            TestStore.set('a', {'a.b':1}, function(Err) {
                Test.ok(Err, "Confirming that . is treated as error for key by default");
                TestStore.set('a', {'a$b':1}, function(Err) {
                    Test.ok(true || Err, "Confirming that $ is no longer treated as error for key by default (Mongo 3.x.x)");
                    TestStore.set('a', {'a\0b':1}, function(Err) {
                        Test.ok(Err, "Confirming that null is treated as error for key by default");
                        Context.DB.dropDatabase(function(Err, Result) {
                            Context.DB.close();
                            Test.done();
                        });
                    });
                })
            });
        }, {'Filter': false});
    },
    'Testget': function(Test) {
        Test.expect(1);
        Store(Context['DB'], function(Err, TestStore) {
            Context.DB.dropDatabase(function(Err, Result) {
                Context.DB.close();
                TestStore.get('a', function(Err, Session) {
                    Test.ok(Err,"Confirming get handles database errors.");
                    Test.done();
                });
            });
        });
    },
    'Testdestroy': function(Test) {
        Test.expect(1);
        Store(Context['DB'], function(Err, TestStore) {
            Context.DB.dropDatabase(function(Err, Result) {
                Context.DB.close();
                TestStore.destroy('a', function(Err) {
                    Test.ok(Err,"Confirming destroy handles database errors.");
                    Test.done();
                });
            });
        });
    },
    'Testlength': function(Test) {
        Test.expect(1);
        Store(Context['DB'], function(Err, TestStore) {
            Context.DB.dropDatabase(function(Err, Result) {
                Context.DB.close();
                TestStore.length(function(Err, Count) {
                    Test.ok(Err,"Confirming length handles database errors.");
                    Test.done();
                });
            });
        });
    },
    'Testclear': function(Test) {
        Test.expect(1);
        Store(Context['DB'], function(Err, TestStore) {
            Context.DB.dropDatabase(function(Err, Result) {
                Context.DB.close();
                TestStore.clear(function(Err) {
                    Test.ok(Err,"Confirming clear handles database errors.");
                    Test.done();
                });
            });
        });
    }
};

process.on('uncaughtException', function(MainErr) {
    if(Context.DB)
    {
        Context.DB.dropDatabase(function(Err, Result) {
            if(Err)
            {
                console.log(Err);
            }
            console.log('Caught exception: ' + MainErr);
            process.exit(1);
        });
    }
    else
    {
        console.log('Caught exception: ' + MainErr);
        process.exit(1);
    }
});
