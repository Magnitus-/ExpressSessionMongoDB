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
            //As it is, I trust myself to have no malicious intent on my test requests
            Context['App'].post('/:Var/Increment', function(Req, Res) {
                console.log('Req.params.Var: '+Req.params.Var);
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

function GetSessionID(Headers)
{
    if(Headers["set-cookie"])
    {
        var SessionCookie = Headers["set-cookie"][0];
        SessionCookie = SessionCookie.slice(String("connect.sid=").length, SessionCookie.indexOf(';'));
        return(SessionCookie);
    }
    return(null);
}

exports.BasicSetup = {
    'setUp': function(Callback) {
        Setup({'secret': 'qwerty!'}, Callback);
    },
    'tearDown': function(Callback) {
        TearDown(Callback);
    },
    'TestManipulation': function(Test) {
        Test.expect(1);
        var Req = Http.request({'hostname': 'localhost', 'port': 8080, 'method': 'POST', 'path': '/Test/Increment', 'headers': {'Accept': 'application/json'}}, function(Res) {
            Res.on('data', function (Chunk) {
                //Don't really care about this.
            });
            Res.on('end', function () {
                Context['SessionID'] = GetSessionID(Res.headers);
                Req = Http.request({'hostname': 'localhost', 'port': 8080, 'method': 'GET', 'path': '/Test', 'headers': {'Accept': 'application/json', 'cookie': ('connect.sid='+Context['SessionID'])}}, function(Res) {
                    Res.setEncoding('utf8');
                    Res.on('data', function (Chunk) {
                        var Body = JSON.parse(Chunk);
                        Test.ok(Body['Value']==1,'Confirming basic session manipulation works');
                    });
                    Res.on('end', function () {
                        Test.done();
                    });
                });
                Req.end();
            });
        });
        Req.end();
    }
};
