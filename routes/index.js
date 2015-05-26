var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'MongoDB server-side geo-clustering Proof-of-Concept' });
});

module.exports = router;
