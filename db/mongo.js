/**
 * Created by Ravis on 25/05/15.
 */

var MongoClient = require('mongodb').MongoClient,
  self = this;

if (!process.env['MONGOLAB_URL']) throw new Error('No "MONGOLAB_URL" env variable specified!');
// Use connect method to connect to the Server
MongoClient.connect(process.env['MONGOLAB_URL'], function(err, db) {
  console.log('Connected to MongoLab.');
  self.db = db;
  self.collection = db.collection('points');
});