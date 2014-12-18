//Copyright (c) 2014 Eric Vallee <eric_vallee2003@yahoo.ca>
//MIT License: https://raw.githubusercontent.com/Magnitus-/ExpressSessionMongoDB/master/License.txt

var MongoDB = require('mongodb');
Express = require('express');
Session = require('express-session');
Store = require('../lib/ExpressSessionMongoDB');
Http = require('http');

var RandomIdentifier = 'ExpressSessionMongoDBTestDB'+Math.random().toString(36).slice(-8);
var Context = {};

function Setup(Options, Callback)
{
    MongoDB.MongoClient.connect("mongodb://localhost:27017/"+RandomIdentifier, {native_parser:true}, function(Err, DB) {
        Context['DB'] = DB;
        Store(DB, function(Err, SessionStore) {
            Context['Store'] = SessionStore;
            Options['store'] = SessionStore;
            Context['App'] = Express();
            Context['App'].use(Session(Options));
            //In a real world production case, you'd want to do some sanitization and error checking on URL input
            //As it is, I trust myself to have no malicious intent with regard to my test server
            Context['App'].post('/:Var/Increment', function(Req, Res) {
                if(Req.session[Req.params.Var])
                {
                    Req.session[Req.params.Var]+=1;
                }
                else
                {
                    Req.session[Req.params.Var]=1;
                }
                Res.end();
            });
            Context['App'].post('/:List/Append/:Var', function(Req, Res) {
                if(!Req.session[Req.params.List])
                {
                    Req.session[Req.params.List]=[];
                }
                Req.session[Req.params.List].push(Req.session[Req.params.Var]);
                Res.end();
            });
            Context['App'].get('/:Var', function(Req, Res) {
                Res.json({'Value': Req.session[Req.params.Var]});
            });
            Context['App'].put('/Session/Regeneration', function(Req, Res) {
                Req.session.regenerate(function(Err) {
                    Res.end();
                });
            });
            Context['App'].put('/Session/Destruction', function(Req, Res) {
                Req.session.destroy(function(Err) {
                    Res.end();
                });
            });
            Context['App'].put('/Session/Reload/:Var', function(Req, Res) {
                //<Var> shouldn't be changed. 
                //It was put here to enable testing of the desired functionality.
                if(Req.session[Req.params.Var])
                {
                    Req.session[Req.params.Var]+=1;
                }
                else
                {
                    Req.session[Req.params.Var]=1;
                }
                Req.session.reload(function(Err) {
                    Res.end();
                });
            });
            Context['App'].put('/Session/Save/:Var', function(Req, Res) {
                //<Var> should be changed incremented. 
                //It was put here to enable testing of the desired functionality.
                if(Req.session[Req.params.Var])
                {
                    Req.session[Req.params.Var]+=1;
                }
                else
                {
                    Req.session[Req.params.Var]=1;
                }
                Req.session.save(function(Err) {
                    Req.session.reload(function(Err) {
                        Res.end();
                    });
                });
            });
            Context['App'].use(function(Err, Req, Res, Next) {
                console.error('Error on test server: '+Err);
            });
            Context['Server'] = Http.createServer(Context['App']);
            Context['Server'].listen(8080, function() {
                Callback();
            });
        });
    });
}

function TearDown(Callback)
{
    Context['Server'].close(function() {
        Context.DB.dropDatabase(function(Err, Result) {
            Context.DB.close();
            Callback();
        });
    });
}

function RequestHandler()
{
    this.SessionID = null;
    if(!RequestHandler.prototype.SetSessionID)
    {
        RequestHandler.prototype.SetSessionID = function(Headers) {
            if(Headers["set-cookie"])
            {
                var SessionCookie = Headers["set-cookie"][0];
                SessionCookie = SessionCookie.slice(String("connect.sid=").length, SessionCookie.indexOf(';'));
                this.SessionID = SessionCookie;
            }
        };
        
        RequestHandler.prototype.Request = function(Method, Path, GetBody, Callback) {
            var Self = this;
            var RequestObject = {'hostname': 'localhost', 'port': 8080, 'method': Method, 'path': Path, 'headers': {'Accept': 'application/json'}};
            if(this.SessionID)
            {
                RequestObject['headers']['cookie'] = 'connect.sid='+this.SessionID;
            }
            var Req = Http.request(RequestObject, function(Res) {
                Res.setEncoding('utf8');
                var Body = "";
                if(!GetBody)
                {
                    Res.resume();
                }
                else
                {
                    Res.on('data', function (Chunk) {
                        Body+=Chunk;
                    });
                }
                Res.on('end', function() {
                    Self.SetSessionID(Res.headers);
                    Body = GetBody ? JSON.parse(Body) : null;
                    Callback(Body);
                });
            });
            Req.end();
        };
    }
}

exports.BasicSetup = {
    'setUp': function(Callback) {
        Setup({'secret': 'qwerty!'}, Callback);
    },
    'tearDown': function(Callback) {
        TearDown(Callback);
    },
    'TestObjectAPI': function(Test) {
        Test.expect(2);
        var Handler = new RequestHandler();
        Handler.Request('POST', '/Test/Increment', false, function() {
            Handler.Request('GET', '/Test', true, function(Body) {
                Test.ok(Body['Value']==1,'Confirming basic session manipulation works');
                Handler.Request('POST', '/TestArray/Append/Test', false, function() {
                    Handler.Request('POST', '/Test/Increment', false, function() {
                        Handler.Request('POST', '/TestArray/Append/Test', false, function() {
                            Handler.Request('GET', '/TestArray', true, function(Body) {
                                Test.ok(Body['Value'].length && Body['Value'].length ==2 && Body['Value'][0]==1 && Body['Value'][1]==2,'Confirming that session data is preserved and returned over several requests.');
                                Test.done();
                            });
                        });
                    });
                });
            });
        });
    },
    'TestRegenerateMethod': function(Test) {
        Test.expect(2);
        var Handler = new RequestHandler();
        Handler.Request('POST', '/Test/Increment', false, function() {
            Handler.Request('POST', '/Test/Increment', false, function() {
                var PreviousSessionID = Handler.SessionID;
                Handler.Request('PUT', '/Session/Regeneration', false, function() {
                    Test.ok(Handler.SessionID != PreviousSessionID, "Confirming that a new session ID has been generated.");
                    Handler.Request('POST', '/Test/Increment', false, function() {
                        Handler.Request('GET', '/Test', true, function(Body) {
                            Test.ok(Body['Value']==1,'Confirming the session was reset.');
                            Test.done();
                        });
                    });
                });
            });
        });
    },
    'TestDestroyMethod': function(Test) {
        Test.expect(3);
        var Handler = new RequestHandler();
        Handler.Request('POST', '/Test/Increment', false, function() {
            Handler.Request('POST', '/Test/Increment', false, function() {
                var PreviousSessionID = Handler.SessionID;
                Handler.Request('PUT', '/Session/Destruction', false, function() {
                    Test.ok(Handler.SessionID == PreviousSessionID, "Confirming that a new session ID has not been generated.");
                    Handler.Request('POST', '/Test/Increment', false, function() {
                        Test.ok(Handler.SessionID != PreviousSessionID, "Confirming that a new session ID has been generated.");
                        Handler.Request('GET', '/Test', true, function(Body) {
                            Test.ok(Body['Value']==1,'Confirming the session was reset.');
                            Test.done();
                        });
                    });
                });
            });
        });
    },
    'TestReloadMethod': function(Test) {
        Test.expect(1);
        var Handler = new RequestHandler();
        Handler.Request('POST', '/Test/Increment', false, function() {
            Handler.Request('PUT', '/Session/Reload/Test', false, function() {
                Handler.Request('GET', '/Test', true, function(Body) {
                    Test.ok(Body['Value']==1,'Confirming that session was proprerly reloaded.');
                    Test.done();
                });
            });
        });
    },
    'TestSaveMethod': function(Test) {
        Test.expect(1);
        var Handler = new RequestHandler();
        Handler.Request('POST', '/Test/Increment', false, function() {
            Handler.Request('PUT', '/Session/Save/Test', false, function() {
                Handler.Request('GET', '/Test', true, function(Body) {
                    Test.ok(Body['Value']==2,'Confirming that session was proprerly saved.');
                    Test.done();
                });
            });
        });
    }
};
